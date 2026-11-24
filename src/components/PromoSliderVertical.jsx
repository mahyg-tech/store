import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppIcon from './AppIcon'
import CachedImage from './CachedImage'
import { useSettings, DEFAULT_PROMO_AUTOPLAY_MS } from '../context/SettingsContext'
import { getPromoLinkPath } from '../utils/promoLinks'
import './PromoSlider.css'

const SWIPE_THRESHOLD = 40
const TAP_SLOP = 8
const DEFAULT_SLIDE_WIDTH_PERCENT = 88
const GAP_PX = 8
const SIZE_BOOST = 1.1 // نفس تكبير السلايدر الجانبي عشان المقاسين يتطابقوا
const TRANSITION_MS = 600

/**
 * نسخة السلايدر اللي بتتحرك "من تحت لفوق": كل سلايد جديد بيطلع من تحت
 * ويدفع القديم لفوق. بتتفعّل من لوحة التحكم (promoDirection = 'up') —
 * شوف PromoSlider.jsx.
 *
 * اللف اللانهائي: بنضيف نسخة من أول سلايد في آخر الشريط. لما الأوتوبلاي
 * يوصل للنسخة دي (بنفس حركة "طلوع لفوق")، بنرجّع الشريط بدون أنيميشن
 * لأول سلايد الحقيقي — فمفيش لحظة السلايدر بيرجع فيها لتحت بسرعة.
 *
 * التنقل اليدوي: سحب أفقي (يمين/شمال) أو نقط التنقّل — السحب الرأسي
 * متساب للصفحة نفسها تتحرك بيه (touch-action: pan-y) عشان السلايدر
 * ما يعطّلش تمرير الصفحة.
 */
export default function PromoSliderVertical({ slides, height = 150, autoPlay = true, intervalMs, slideWidthPercent = DEFAULT_SLIDE_WIDTH_PERCENT, compact = false, half = false }) {
  const SLIDE_WIDTH_PERCENT = slideWidthPercent
  const settings = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const effectiveInterval = intervalMs ?? settings.promoAutoplayMs ?? DEFAULT_PROMO_AUTOPLAY_MS
  const count = slides.length
  // 0..count — القيمة count هي النسخة المكررة من أول سلايد (شوف التعليق فوق)
  const [pos, setPos] = useState(0)
  const [animate, setAnimate] = useState(true)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const lastDxRef = useRef(0)
  const tapRef = useRef({ slideIndex: -1, moved: false })

  const activeIndex = count > 0 ? pos % count : 0

  const goTo = useCallback((i) => setPos(((i % count) + count) % count), [count])

  useEffect(() => {
    if (count > 0 && pos > count) setPos(0)
  }, [count, pos])

  // وصلنا للنسخة المكررة: استنى الحركة تخلص وارجع للأول من غير أنيميشن
  useEffect(() => {
    if (count === 0 || pos !== count) return
    let raf1 = 0
    let raf2 = 0
    const timer = setTimeout(() => {
      setAnimate(false)
      setPos(0)
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setAnimate(true))
      })
    }, TRANSITION_MS + 40)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [pos, count])

  useEffect(() => {
    if (!autoPlay || count <= 1 || pos >= count) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setTimeout(() => setPos((p) => Math.min(p + 1, count)), effectiveInterval)
    return () => clearTimeout(timer)
  }, [pos, autoPlay, count, effectiveInterval])

  function openSlide(slide) {
    const path = getPromoLinkPath(slide)
    if (path) navigate(path, { state: { backTo: location.pathname + location.search } })
  }

  function handlePointerDown(e) {
    draggingRef.current = true
    startXRef.current = e.clientX
    lastDxRef.current = 0
    const slideEl = e.target.closest ? e.target.closest('[data-slide-index]') : null
    tapRef.current = { slideIndex: slideEl ? Number(slideEl.dataset.slideIndex) % count : -1, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return
    const dx = e.clientX - startXRef.current
    lastDxRef.current = dx
    if (Math.abs(dx) > TAP_SLOP) tapRef.current.moved = true
  }

  function endDrag(e) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const dx = lastDxRef.current
    const isTap = e?.type === 'pointerup' && !tapRef.current.moved
    if (dx < -SWIPE_THRESHOLD) setPos(pos >= count ? 1 : Math.min(pos + 1, count))
    else if (dx > SWIPE_THRESHOLD) goTo(pos <= 0 ? count - 1 : (pos >= count ? 0 : pos - 1))
    lastDxRef.current = 0

    if (isTap && tapRef.current.slideIndex >= 0) {
      const slide = slides[tapRef.current.slideIndex]
      if (slide) openSlide(slide)
    }
  }

  function handleKeyDown(e, slide) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openSlide(slide)
    }
  }

  if (count === 0) return null

  // الشريط + نسخة من أول سلايد في الآخر
  const rendered = [...slides, slides[0]]

  return (
    <div
      className={`promo-slider${compact ? ' promo-slider--compact' : ''}${half ? ' promo-slider--half' : ''}`}
      style={{ height: height * SIZE_BOOST }}
    >
      <div
        className="promo-slider__track promo-slider__track--vertical"
        style={{
          gap: GAP_PX,
          // النسبة في translateY بتتحسب من ارتفاع الشريط نفسه (= ارتفاع الحاوية)،
          // فكل سلايد = 100% + المسافة بين السلايدات
          transform: `translateY(calc(${-pos} * (100% + ${GAP_PX}px)))`,
          transition: animate ? undefined : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        {rendered.map((slide, i) => {
          const isClone = i === count
          const isActive = i === pos
          const hasLink = Boolean(getPromoLinkPath(slide))
          return (
            <div
              key={isClone ? `${slide.id}-clone` : slide.id}
              data-slide-index={i}
              aria-hidden={isClone || undefined}
              className={`promo-slider__slide promo-slider__slide--vertical${slide.image ? ' promo-slider__slide--image' : ''}${hasLink ? ' promo-slider__slide--link' : ''}`}
              style={{
                background: slide.image ? undefined : slide.color,
                width: `${SLIDE_WIDTH_PERCENT}%`,
              }}
              {...(hasLink && isActive && !isClone
                ? { role: 'link', tabIndex: 0, onKeyDown: (e) => handleKeyDown(e, slide) }
                : {})}
            >
              {slide.image ? (
                <CachedImage src={slide.image} alt={isClone ? '' : slide.title || ''} className="promo-slider__image" draggable={false} />
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
              aria-selected={i === activeIndex}
              aria-label={`عرض ${i + 1} من ${count}`}
              className={`promo-slider__dot${i === activeIndex ? ' promo-slider__dot--active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
