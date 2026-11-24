import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import * as api from '../api/client'
import './RatingPromptModal.css'

// أنيميشن ترحيبي بسيط أول ما الكارت يظهر: الخمس نجوم بتتلوّن دهبي واحدة
// واحدة (120ms بين كل نجمة)، بتفضل كده شوية، وبعدين بترجع فاضية تاني —
// مجرد لفتة بصرية تلفت نظر العميل للتقييم، مش اختيار تلقائي لأي تقييم.
// أي تفاعل حقيقي (hover/دوس) من العميل بيلغي الأنيميشن على طول (finishIntroEarly)
// عشان مايحسش إن التطبيق "مش بيستجيب" وهو بيحاول يقيّم فعلاً
const STAR_INTRO_STEP_MS = 120
const STAR_INTRO_HOLD_MS = 550
const STAR_INTRO_FADE_MS = 320

/**
 * بيظهر لما فيه طلب "اتسلم" ولسه ما اتقيّمش (شوف App.jsx — fetchPendingRating).
 * عنوانه "المساعد الرقمي" بالظبط زي الإشعار اللي بيوصل للعميل.
 */
export default function RatingPromptModal({ orderId, onDone }) {
  const [stars, setStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [introStars, setIntroStars] = useState(0)
  const [introDone, setIntroDone] = useState(false)
  const introTimersRef = useRef([])

  useEffect(() => {
    const timers = [1, 2, 3, 4, 5].map((n) =>
      setTimeout(() => setIntroStars(n), STAR_INTRO_STEP_MS * n),
    )
    const resetAt = STAR_INTRO_STEP_MS * 5 + STAR_INTRO_HOLD_MS
    timers.push(setTimeout(() => setIntroStars(0), resetAt))
    timers.push(setTimeout(() => setIntroDone(true), resetAt + STAR_INTRO_FADE_MS))
    introTimersRef.current = timers
    return () => timers.forEach(clearTimeout)
  }, [])

  // أي تفاعل حقيقي من العميل بيوقف الأنيميشن فورًا ويدّي التحكم لحالته
  // الحقيقية (stars/hoverStars) من غير ما يستنى الأنيميشن يخلص
  function finishIntroEarly() {
    if (introDone) return
    introTimersRef.current.forEach(clearTimeout)
    setIntroDone(true)
  }

  async function handleSubmit() {
    if (stars < 1) {
      setError('اختار تقييم من 1 لـ 5 نجوم الأول')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.submitOrderRating({ orderId, stars, comment: comment.trim() })
      onDone()
    } catch (err) {
      setError(err.message || 'حصل خطأ، جرب تاني')
      setSubmitting(false)
    }
  }

  async function handleLater() {
    try {
      await api.dismissOrderRating(orderId)
    } catch {
      /* مش حرج — هتتسأل تاني المرة الجاية لو لسه pending */
    } finally {
      onDone()
    }
  }

  const activeStars = hoverStars || stars
  const displayStars = introDone ? activeStars : introStars

  return (
    <div className="rating-prompt-backdrop" role="presentation">
      <div className="rating-prompt-card" role="dialog" aria-modal="true" aria-labelledby="rating-prompt-title">
        <h2 id="rating-prompt-title" className="rating-prompt-card__title">المساعد الرقمي</h2>
        <p className="rating-prompt-card__text">عرفنا تقييمك للخدمة من 5 نجوم؟</p>

        <div className="rating-prompt-card__stars" onMouseLeave={() => setHoverStars(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`rating-prompt-card__star-btn${n <= displayStars ? ' rating-prompt-card__star-btn--lit' : ''}`}
              onClick={() => {
                finishIntroEarly()
                setStars(n)
              }}
              onMouseEnter={() => {
                finishIntroEarly()
                setHoverStars(n)
              }}
              aria-label={`${n} نجوم`}
            >
              <Star
                size={34}
                strokeWidth={1.6}
                fill={n <= displayStars ? 'var(--color-mango-500, #e8a33d)' : 'none'}
                color={n <= displayStars ? 'var(--color-mango-500, #e8a33d)' : 'var(--color-ink-400)'}
              />
            </button>
          ))}
        </div>

        <textarea
          className="rating-prompt-card__comment"
          rows={3}
          placeholder="تعليقك (اختياري)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {error && <p className="login__error" role="alert">{error}</p>}

        <div className="rating-prompt-card__actions">
          <button type="button" className="btn btn--outline" onClick={handleLater} disabled={submitting} style={{ flex: 1 }}>
            لاحقًا
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
            {submitting ? 'جاري الإرسال…' : 'إرسال'}
          </button>
        </div>
      </div>
    </div>
  )
}
