import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppIcon from './AppIcon'
import { useSettings, DEFAULT_PROMO_AUTOPLAY_MS } from '../context/SettingsContext'
import { getPromoLinkPath, resolveSlideTap } from '../utils/promoLinks'
import './PromoSlider.css'
import CachedImage from './CachedImage'
import PromoSliderVertical from './PromoSliderVertical'

const SWIPE_THRESHOLD = 40
const TAP_SLOP = 8 // أقل من كده (بالبكسل) يعتبر لمسة مش سحبة
const DEFAULT_SLIDE_WIDTH_PERCENT = 88 // عرض السلايد النشط من عرض الحاوية (السلايدر الكامل)
// الفراغ على كل جنب = (100 - عرض السلايد) / 2 — هو اللي بيخلي السلايد النشط في النص بالظبط
const GAP_PX = 8
const SIDE_SCALE = 0.82 // حجم السلايد اللي مش في النص (السابق/القادم) — أصغر
const SIDE_ROTATE_DEG = 22 // زاوية الميل — بتدّي إحساس إن السلايد الجنبي جزء من دائرة
const SIZE_BOOST = 1.1 // تكبير حجم السلايدر الظاهر على الشاشة 10% زيادة عن أي height بيتبعت من الصفحة المستخدمة له — مركزي هنا عشان يطبّق تلقائيًا على كل الأماكن اللي السلايدر ده مستخدم فيها من غير ما تحتاج تعدّل كل صفحة لوحدها

/**
 * سلايدر عروض متحرك — السلايد الحالي في النص بالظبط بحجمه الكامل، وباين
 * على الجنبين طرف من السلايد السابق والقادم بحجم أصغر. يقبل أي مصفوفة
 * "slides" ({id,title,subtitle,color,icon,image,linkType,linkCategoryId})
 * ويشتغل لوحده (autoplay)، وقابل للسحب بالإيد، وله نقط تنقّل تحت.
 * لمسة على السلايد اللي في النص بتفتح القسم/المنتجات المربوطة بيه (لو
 * الأدمن ربطها من لوحة التحكم) — شوف utils/promoLinks.js.
 *
 * ------------------------------------------------------------------------
 * ليه السلايد كان بيبان على الشمال بدل النص (اتصلّح):
 * النسب المئوية في CSS مش كلها بتتحسب من نفس الحاجة — flex-basis بتتحسب
 * من عرض "المحتوى" جوه الشريط (بعد ما يتشال الـ padding)، لكن translateX
 * بتتحسب من عرض الشريط نفسه كله. الشريط كان واخد padding-inline: 6%،
 * فالسلايد (88% من المحتوى) كان فعليًا ٧٧٪ بس من الحاوية، والإزاحة بين
 * سلايد وسلايد (88%) مختلفة عن المسافة الفعلية بينهم، فالسلايد النشط
 * كان بيبعد عن النص أكتر مع كل سلايد. الحل: شلنا الـ padding خالص،
 * فبقت كل النسب من نفس المرجع (عرض الحاوية)، والتوسيط بقى إزاحة صريحة
 * بـ SLIDE_INSET_PERCENT. وكمان المسافة بين السلايدات بقت `gap` على
 * الشريط (مش margin-inline-end) لأن اتجاه كل سلايد rtl كان بيقلب الـ
 * margin لجهة الشمال.
 * ------------------------------------------------------------------------
 */
// intervalMs اختياري لتحديد سرعة يدوية لسلايدر بعينه؛ من غيره بياخد
// القيمة المتحكم فيها من لوحة التحكم (تبويب "السلايدرات والعروض").
// slideWidthPercent: السلايدر الكامل 88% (بيبان طرف السلايد اللي جنبه)، والسلايدر
// "النص" 100% (حاوية صغيرة، مفيش مكان لأطراف). compact: مقاس مضغوط للنص/الارتفاع
// القصير (padding وخطوط أصغر) — شوف PromoSliderGroup.jsx و PromoSlider.css.
function PromoSliderSide({ slides, height = 150, autoPlay = true, intervalMs, slideWidthPercent = DEFAULT_SLIDE_WIDTH_PERCENT, compact = false, half = false }) {
  const SLIDE_WIDTH_PERCENT = slideWidthPercent
  const SLIDE_INSET_PERCENT = (100 - SLIDE_WIDTH_PERCENT) / 2
  const settings = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const effectiveInterval = intervalMs ?? settings.promoAutoplayMs ?? DEFAULT_PROMO_AUTOPLAY_MS
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [dragDelta, setDragDelta] = useState(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const tapRef = useRef({ slideIndex: -1, moved: false })

  const goTo = useCallback((i) => setIndex(((i % count) + count) % count), [count])

  // لو عدد الشرايح قلّ (الأدمن عطّل واحدة مثلاً) والفهرس بقى برّه المدى
  useEffect(() => {
    if (count > 0 && index >= count) setIndex(0)
  }, [count, index])

  useEffect(() => {
    if (!autoPlay || count <= 1) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setTimeout(() => goTo(index + 1), effectiveInterval)
    return () => clearTimeout(timer)
  }, [index, autoPlay, count, goTo, effectiveInterval])

  function openSlide(slide) {
    const path = getPromoLinkPath(slide)
    // backTo: زرار الرجوع يرجّعه للصفحة اللي ضغط فيها على السلايدر (مش لأي صفحة تانية)
    if (path) navigate(path, { state: { backTo: location.pathname + location.search } })
  }

  function handlePointerDown(e) {
    draggingRef.current = true
    startXRef.current = e.clientX
    const slideEl = e.target.closest ? e.target.closest('[data-slide-index]') : null
    tapRef.current = { slideIndex: slideEl ? Number(slideEl.dataset.slideIndex) : -1, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return
    const dx = e.clientX - startXRef.current
    if (Math.abs(dx) > TAP_SLOP) tapRef.current.moved = true
    setDragDelta(dx)
  }

  function endDrag(e) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const isTap = e?.type === 'pointerup' && !tapRef.current.moved
    if (dragDelta < -SWIPE_THRESHOLD) goTo(index + 1)
    else if (dragDelta > SWIPE_THRESHOLD) goTo(index - 1)
    setDragDelta(0)

    if (isTap) {
      const action = resolveSlideTap(tapRef.current.slideIndex, index, slides)
      if (action === 'open') openSlide(slides[tapRef.current.slideIndex])
      else if (action === 'center') goTo(tapRef.current.slideIndex)
    }
  }

  function handleKeyDown(e, slide) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openSlide(slide)
    }
  }

  if (count === 0) return null

  return (
    <div
      className={`promo-slider${compact ? ' promo-slider--compact' : ''}${half ? ' promo-slider--half' : ''}`}
      style={{ height: height * SIZE_BOOST }}
    >
      <div
        className="promo-slider__track"
        style={{
          gap: GAP_PX,
          transform: `translateX(calc(${SLIDE_INSET_PERCENT}% + ${-index} * (${SLIDE_WIDTH_PERCENT}% + ${GAP_PX}px) + ${dragDelta}px))`,
          transition: draggingRef.current ? 'none' : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        {slides.map((slide, i) => {
          const isActive = i === index
          const offset = i - index
          const transform = isActive
            ? 'scale(1) rotateY(0deg)'
            : `scale(${SIDE_SCALE}) rotateY(${offset < 0 ? SIDE_ROTATE_DEG : -SIDE_ROTATE_DEG}deg)`
          const transformOrigin = isActive ? 'center center' : offset < 0 ? 'right center' : 'left center'
          const hasLink = Boolean(getPromoLinkPath(slide))
          return (
            <div
              key={slide.id}
              data-slide-index={i}
              className={`promo-slider__slide${slide.image ? ' promo-slider__slide--image' : ''}${hasLink ? ' promo-slider__slide--link' : ''}`}
              style={{
                background: slide.image ? undefined : slide.color,
                flexBasis: `${SLIDE_WIDTH_PERCENT}%`,
                transform,
                transformOrigin,
                opacity: isActive ? 1 : 0.85,
              }}
              {...(hasLink && isActive
                ? { role: 'link', tabIndex: 0, onKeyDown: (e) => handleKeyDown(e, slide) }
                : {})}
            >
              {slide.image ? (
                <CachedImage src={slide.image} alt={slide.title || ''} className="promo-slider__image" draggable={false} />
              ) : (
                <>
                  {slide.icon && (
                    <span className="promo-slider__icon-chip">
                      <AppIcon name={slide.icon} size={20} color="var(--color-ink-900)" />
                    </span>
                  )}
                  <div className="promo-slider__text">
                    <p className="promo-slider__title">{slide.title}</p>
                    <p className="promo-slider__subtitle">{slide.subtitle}</p>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <div className="promo-slider__dots" role="tablist" aria-label="عروض">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`عرض ${i + 1} من ${count}`}
              className={`promo-slider__dot${i === index ? ' promo-slider__dot--active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * بيختار اتجاه حركة السلايدر حسب إعداد "promoDirection" من لوحة التحكم:
 *   - 'side' (الافتراضي): الحركة الجانبية المعتادة (PromoSliderSide فوق).
 *   - 'up': السلايد الجديد بيطلع من تحت لفوق (PromoSliderVertical).
 * الإعداد عام لكل السلايدرات في التطبيق، زي سرعة الأوتوبلاي بالظبط.
 */
export default function PromoSlider(props) {
  const { promoDirection } = useSettings()
  if (promoDirection === 'up' && props.slides.length > 1) return <PromoSliderVertical {...props} />
  return <PromoSliderSide {...props} />
}
