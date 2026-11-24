import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import * as api from '../api/client'
import AppIcon from './AppIcon'
import { cumulativeOffsets, stageWidth, resolveSwipe } from '../utils/popupCarousel'
import { spawnShatterEffect } from '../utils/shatterEffect'
import './WelcomePopup.css'
import CachedImage from './CachedImage'
import { setPopupStatus } from '../utils/popupBridge'

// مدة تأثير "الفرقعة" (utils/shatterEffect.js) — نفس القيمة مستخدمة هنا
// وجوه الدالة نفسها (قيمتها الافتراضية) عشان نستنى بالظبط لحد ما تخلص
// قبل ما نشيل الكومبوننت كله
const SHATTER_DURATION_MS = 650

const SESSION_KEY = 'elmahi_welcome_popup_shown'

// مقاس أيقونة القايمة (lucide) بالبكسل، متسق مع حجم الـ icon-chip بتاعه
// في CSS لكل مقاس (شوف .welcome-popup-card__icon-chip في الـ CSS)
const POPUP_ICON_SIZE = { small: 22, medium: 28, large: 36 }

// أد إيه لازم يسحب عشان نعتبرها سحبة قصده يكمّل بيها، مش لمسة عرضية
const SWIPE_THRESHOLD = 80
// أقل حركة تعتبر "سحب فعلي" (بنستخدمها لمنع الـ click اللي بيحصل بعد
// السحب مباشرة من إنه "يقفز" لكارت تاني بالغلط لمجرد إن الماوس اتحرك شوية)
const DRAG_CLICK_GUARD = 6

/**
 * بيعرض كل البوب أبات النشطة (زي ما اتحطوا في لوحة التحكم) كشريط أفقي —
 * زي شرايط الإعلانات (سلايدر): الكارت الحالي ظاهر كامل، وجزء من اللي
 * بعده ظاهر على جنبه، وتقدر تسحب بينهم زي أي سلايدر. api.fetchWelcomePopup()
 * بترجّع مصفوفة (حتى لو بوب أب واحد بس نشط)، فالكومبوننت ده شغال دايمًا
 * على طابور، مش عنصر واحد.
 *
 * ------------------------------------------------------------------------
 * ليه الشريط (.welcome-popup-track) بياخد direction: ltr صراحةً مع إن
 * التطبيق كله RTL (شوف theme/global.css):
 *
 * الرياضة بتاعة السحب/الإزاحة (transform: translateX) دايمًا بمساحة
 * بكسل فيزيائية (سالب = يمين، موجب = شمال) — مبتفهمش RTL. لو سبنا الشريط
 * يورث RTL من الصفحة، الـ flexbox هيقلب ترتيب الكروت بصريًا (الكارت
 * الأول يظهر يمين، اللي بعده شماله) بس رياضة الـ transform هتفضل زي ما
 * هي، فالنتيجة هتبقى معكوسة ومربكة. تثبيت الشريط على ltr بيخلي "كارت 0
 * على الشمال، كارت 1 على يمينه، وهكذا" ثابت ومتوقع دايمًا، وده بالظبط
 * اللي بيخلي "اسحب لليسار = قدّام" (نفس اتجاه السحب القديم في النسخة
 * قبل التعديل ده) يفتح الكارت اللي بعده من على اليمين — بالظبط زي
 * سلايدر عادي بيتحرك مع صباعك.
 *
 * النص جوه كل كارت (`.welcome-popup-card`) بيرجّع direction: rtl تاني
 * عشان العربي يتكتب صح — بس ترتيب/موضع الكروت نفسها فاضل بمنطق الـ ltr
 * بتاع الشريط.
 * ------------------------------------------------------------------------
 */
export default function WelcomePopup({ onClose }) {
  const [queue, setQueue] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const backdropRef = useRef(null)
  const cardRefs = useRef(new Map()) // index -> DOM node
  const [cardSizes, setCardSizes] = useState({}) // index -> { width, height }
  const geometryRef = useRef({ gap: 14, peek: 26 }) // احتياطي؛ بيتقرا من الـ CSS تحت

  const closingRef = useRef(false) // closeAll اتنادى بالفعل؟ (يمنع الفرقعة مرتين)
  const closeAllRef = useRef(null)
  const touchStartRef = useRef(null)
  const dragXRef = useRef(0) // مرآة لـ dragX نقدر نقراها فورًا جوه endDrag()
  const draggedRef = useRef(false) // آخر إفلات كان فيه حركة سحب فعلية؟ (يمنع click بعد السحب)

  // تحميل الطابور مرة واحدة بس، لو لسه معرضش في السيشن ده
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setPopupStatus('none')
      return
    }
    setPopupStatus('pending')
    let active = true
    api
      .fetchWelcomePopup()
      .then((data) => {
        if (!active) return
        const popups = Array.isArray(data) ? data : data ? [data] : []
        if (popups.length > 0) setQueue(popups)
        else setPopupStatus('none')
      })
      .catch((err) => {
        console.error('fetchWelcomePopup failed:', err.message)
        setPopupStatus('none')
      })
    return () => {
      active = false
    }
  }, [])

  // أول ما الطابور يوصل، ظهّره بحركة بعد شوية
  useEffect(() => {
    if (queue.length === 0) return
    const timer = setTimeout(() => {
      setVisible(true)
      setPopupStatus('shown')
    }, 400)
    return () => clearTimeout(timer)
  }, [queue])

  // ------------------------------------------------------------ القياس

  const setCardRef = useCallback(
    (index) => (node) => {
      if (node) cardRefs.current.set(index, node)
      else cardRefs.current.delete(index)
    },
    [],
  )

  const measureAll = useCallback(() => {
    if (backdropRef.current) {
      const style = getComputedStyle(backdropRef.current)
      const gap = parseFloat(style.getPropertyValue('--popup-gap'))
      const peek = parseFloat(style.getPropertyValue('--popup-peek'))
      geometryRef.current = {
        gap: Number.isFinite(gap) ? gap : geometryRef.current.gap,
        peek: Number.isFinite(peek) ? peek : geometryRef.current.peek,
      }
    }
    const next = {}
    cardRefs.current.forEach((node, index) => {
      next[index] = { width: node.offsetWidth, height: node.offsetHeight }
    })
    setCardSizes(next)
  }, [])

  // بنقيس فورًا بعد أي تغيير في الطابور (قبل ما المتصفح يرسم — بيمنع أي
  // "فلاش" لمقاس غلط لحظة قبل أول قياس)
  useLayoutEffect(() => {
    measureAll()
  }, [queue, measureAll])

  // وبعد كده أي تغيير في حجم الشاشة (تدوير الموبايل، تصغير نافذة
  // المتصفح…) — عشان مقاس large (min(400px, 92vw)) بيعتمد على عرض
  // الشاشة الفعلي
  useEffect(() => {
    if (queue.length === 0) return
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureAll)
      return () => window.removeEventListener('resize', measureAll)
    }
    const ro = new ResizeObserver(measureAll)
    cardRefs.current.forEach((node) => ro.observe(node))
    return () => ro.disconnect()
  }, [queue, measureAll])

  // ------------------------------------------------------------ التنقل/الإغلاق

  function closeAll() {
    if (closingRef.current) return
    closingRef.current = true
    setPopupStatus('none')
    // الكارت النشط بس (اللي العميل شايفه فعلًا) هو اللي بيتفرقع؛ أي كارت
    // تاني في الطابور (بيك جزء منه بس) بيختفي عادي مع خلفية الـ backdrop
    const activeNode = cardRefs.current.get(activeIndex)
    if (activeNode) {
      spawnShatterEffect(activeNode, { duration: SHATTER_DURATION_MS })
      // نخفي الكارت الحقيقي فورًا — القطع المتطايرة بقت في مكانه بالظبط،
      // فمفيش لحظة يتشافوا فيها الاتنين مع بعض
      activeNode.style.opacity = '0'
    }
    setVisible(false)
    sessionStorage.setItem(SESSION_KEY, '1')
    // نبلّغ الصفحة إن البوب أب بيتقفل — بنستنى نص مدة الفرقعة تقريبًا عشان
    // أنيميشن الأقسام يبدأ والخلفية لسه بتفتح، فيبان إنه طالع من ورا البوب أب
    setTimeout(() => onClose?.(), SHATTER_DURATION_MS * 0.5)
    // بنستنى تأثير "الفرقعة" يخلص قبل ما نشيل الكومبوننت خالص
    setTimeout(() => setClosed(true), SHATTER_DURATION_MS)
  }

  function goTo(index) {
    setActiveIndex(index)
    setDragX(0)
    dragXRef.current = 0
  }

  function handleSwipeResult(result) {
    if (result === 'next') goTo(activeIndex + 1)
    else if (result === 'prev') goTo(activeIndex - 1)
    else if (result === 'close') closeAll()
    else {
      setDragX(0)
      dragXRef.current = 0
    }
  }

  // ------------------------------------------------------------ السحب

  function updateDragX(x) {
    dragXRef.current = x
    setDragX(x)
  }

  function startDrag(x, y) {
    touchStartRef.current = { x, y }
    setIsDragging(true)
  }

  function moveDrag(x, y) {
    if (!touchStartRef.current) return
    const dx = x - touchStartRef.current.x
    const dy = y - touchStartRef.current.y
    // سحبة رأسية أكتر منها أفقية؟ متعتبرهاش سحبة سلايدر
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) > DRAG_CLICK_GUARD) draggedRef.current = true
    updateDragX(dx)
  }

  function endDrag() {
    if (!touchStartRef.current) return
    touchStartRef.current = null
    setIsDragging(false)
    handleSwipeResult(resolveSwipe(dragXRef.current, SWIPE_THRESHOLD, activeIndex, queue.length))
  }

  function handleTouchStart(e) {
    const t = e.touches[0]
    startDrag(t.clientX, t.clientY)
  }
  function handleTouchMove(e) {
    const t = e.touches[0]
    moveDrag(t.clientX, t.clientY)
  }
  function handleTouchEnd() {
    endDrag()
  }

  // نفس السحب بالظبط بس بالماوس، عشان يشتغل وقت تجربة التطبيق من متصفح
  // الديسك توب. بنسمع الحركة والإفلات على النافذة كلها مش بس على
  // الستايدج، عشان السحب يفضل شغال حتى لو المؤشر خرج برا حدوده.
  function handleMouseDown(e) {
    startDrag(e.clientX, e.clientY)
    const handleMove = (ev) => moveDrag(ev.clientX, ev.clientY)
    const handleUp = () => {
      endDrag()
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // لمسة على الكارت اللي ظاهر جزء منه بس (مش النشط) بتنقلك له فورًا —
  // زي أي سلايدر بتلمس فيه الصورة الجاية فتتنقل لها
  function handleCardClick(index) {
    if (draggedRef.current) {
      // ده click جه بعد سحب فعلي (مش نقرة حقيقية) — نتجاهله مرة واحدة بس
      draggedRef.current = false
      return
    }
    if (index !== activeIndex) goTo(index)
  }

  // الجولة التعريفية بتقفل البوب أب بالحدث ده بعد ما تشرحه
  closeAllRef.current = closeAll
  useEffect(() => {
    const handler = () => closeAllRef.current?.()
    window.addEventListener('elmahi:close-welcome-popup', handler)
    return () => window.removeEventListener('elmahi:close-welcome-popup', handler)
  }, [])

  if (closed || queue.length === 0) return null

  const { gap, peek } = geometryRef.current
  const offsets = cumulativeOffsets(
    queue.map((_, i) => cardSizes[i]?.width),
    gap,
  )
  const baseOffset = -(offsets[activeIndex] ?? 0)
  const trackX = (baseOffset === 0 ? 0 : baseOffset) + dragX

  const activeSize = cardSizes[activeIndex]
  const hasNext = activeIndex < queue.length - 1
  const stageStyle = {
    width: stageWidth(activeSize?.width, hasNext, peek) || undefined,
    height: activeSize?.height || undefined,
  }

  return (
    <div
      ref={backdropRef}
      className={`welcome-popup-backdrop${visible ? ' welcome-popup-backdrop--visible' : ''}`}
      onClick={closeAll}
      role="presentation"
    >
      {/* الإطار (frame) هو اللي بيشيل زرار الإغلاق والستايدج جنب بعض — الزرار
          لازم يبقى برّه الستايدج (اللي overflow: hidden) وإلا حرف الـ × كان
          بيتقصّ نصه ومبيظهرش كامل. الإطار نفسه من غير overflow فالزرار بيبان
          كامل حتى وهو طالع شوية برّه حافة الكارت. */}
      <div className="welcome-popup-frame" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="welcome-popup-close" onClick={closeAll} aria-label="إغلاق">
          <X size={20} strokeWidth={2.4} />
        </button>

        <div
          className="welcome-popup-stage"
          style={stageStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div
            className="welcome-popup-track"
            style={{
              transform: `translateX(${trackX}px)`,
              transition: isDragging ? 'transform 0s linear' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: isDragging ? 'none' : 'auto',
            }}
          >
            {queue.map((popup, index) => {
              const sizeClass = ['small', 'medium', 'large'].includes(popup.size) ? popup.size : 'medium'
              const isActive = index === activeIndex
              return (
                <div
                  key={popup.id ?? index}
                  ref={setCardRef(index)}
                  data-popup-id={popup.id ?? index}
                  data-index={index}
                  className={`welcome-popup-card welcome-popup-card--${sizeClass}${isActive ? ' welcome-popup-card--active' : ''}${visible ? ' welcome-popup-card--visible' : ''}`}
                  role={isActive ? 'dialog' : undefined}
                  aria-hidden={isActive ? undefined : true}
                  aria-modal={isActive ? 'true' : undefined}
                  aria-labelledby={isActive && !popup.image ? 'welcome-popup-title' : undefined}
                  aria-label={isActive && popup.image ? popup.title || undefined : undefined}
                  onClick={() => handleCardClick(index)}
                >
                  {popup.image && (
                    <div className="welcome-popup-card__image-wrap">
                      <CachedImage
                        src={popup.image}
                        alt={popup.title || ''}
                        className="welcome-popup-card__image"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    </div>
                  )}
                  <div className="welcome-popup-card__body">
                    {!popup.image && (
                      <>
                        <span className="welcome-popup-card__icon-chip">
                          <AppIcon name={popup.icon} size={POPUP_ICON_SIZE[sizeClass]} color="var(--color-ink-900)" strokeWidth={1.6} />
                        </span>
                        <h2 id={isActive ? 'welcome-popup-title' : undefined} className="welcome-popup-card__title">
                          {popup.title}
                        </h2>
                        <p className="welcome-popup-card__subtitle">{popup.subtitle}</p>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn--primary btn--block"
                      tabIndex={isActive ? 0 : -1}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSwipeResult(activeIndex < queue.length - 1 ? 'next' : 'close')
                      }}
                    >
                      {popup.ctaLabel || 'تمام'}
                    </button>
                  </div>
                </div>
              )
            })}
            </div>
        </div>
      </div>
    </div>
  )
}
