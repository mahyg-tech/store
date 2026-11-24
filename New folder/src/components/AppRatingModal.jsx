import { useState } from 'react'
import { Star } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import * as api from '../api/client'
import { useSettings } from '../context/SettingsContext'
import { markAppRated, postponeAppRating } from '../utils/appRatingPrompt'
import './AppRatingModal.css'

/**
 * تقييم عام للتطبيق (مش لطلب بعينه — شوف RatingPromptModal.jsx لده).
 * بيظهر بعد 15 يوم من أول استخدام (utils/appRatingPrompt.js)، وبيتكرر كل 15
 * يوم لو العميل دوس "لاحقًا" باستمرار. لو قيّم 4 أو 5 نجوم ومعانا رابط
 * المتجر المناسب لمنصته (من إعدادات لوحة التحكم)، بنعرض عليه يفتحه يقيّمنا
 * فيه كمان؛ أي تقييم (عالي أو واطي) بيتسجل في لوحة التحكم بكل الأحوال.
 */
export default function AppRatingModal({ customer, onDone }) {
  const settings = useSettings()
  const [stars, setStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // 'rate' = بيختار نجومه | 'store' = قيّم عالي ومعروض عليه يفتح المتجر | 'thanks' = خلاص خلص
  const [phase, setPhase] = useState('rate')

  function storeUrlForThisDevice() {
    const platform = Capacitor?.getPlatform?.() ?? 'web'
    const urls = settings?.appRating || {}
    if (platform === 'ios') return urls.appStoreUrl || ''
    return urls.playStoreUrl || ''
  }

  async function handleSubmit() {
    if (stars < 1) {
      setError('اختار تقييم من 1 لـ 5 نجوم الأول')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.submitAppRating({ stars, comment: comment.trim() })
      markAppRated(customer)
      const storeUrl = storeUrlForThisDevice()
      if (stars >= 4 && storeUrl) {
        setPhase('store')
      } else {
        setPhase('thanks')
      }
    } catch (err) {
      setError(err.message || 'حصل خطأ، جرب تاني')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLater() {
    postponeAppRating(customer)
    onDone()
  }

  function handleOpenStore() {
    const storeUrl = storeUrlForThisDevice()
    if (storeUrl) window.open(storeUrl, '_blank')
    onDone()
  }

  const activeStars = hoverStars || stars

  return (
    <div className="app-rating-prompt-backdrop" role="presentation">
      <div className="app-rating-prompt-card" role="dialog" aria-modal="true" aria-labelledby="app-rating-prompt-title">
        {phase === 'rate' && (
          <>
            <h2 id="app-rating-prompt-title" className="app-rating-prompt-card__title">إيه رأيك في تطبيق الماحي؟</h2>
            <p className="app-rating-prompt-card__text">قيّمنا بنجومك، تقييمك بيفرق معانا</p>

            <div className="app-rating-prompt-card__stars" onMouseLeave={() => setHoverStars(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`app-rating-prompt-card__star-btn${n <= activeStars ? ' app-rating-prompt-card__star-btn--lit' : ''}`}
                  onClick={() => setStars(n)}
                  onMouseEnter={() => setHoverStars(n)}
                  aria-label={`${n} نجوم`}
                >
                  <Star
                    size={34}
                    strokeWidth={1.6}
                    fill={n <= activeStars ? 'var(--color-mango-500, #e8a33d)' : 'none'}
                    color={n <= activeStars ? 'var(--color-mango-500, #e8a33d)' : 'var(--color-ink-400)'}
                  />
                </button>
              ))}
            </div>

            <textarea
              className="app-rating-prompt-card__comment"
              rows={3}
              placeholder="تعليقك (اختياري)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {error && <p className="login__error" role="alert">{error}</p>}

            <div className="app-rating-prompt-card__actions">
              <button type="button" className="btn btn--outline" onClick={handleLater} disabled={submitting} style={{ flex: 1 }}>
                لاحقًا
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                {submitting ? 'جاري الإرسال…' : 'إرسال'}
              </button>
            </div>
          </>
        )}

        {phase === 'store' && (
          <>
            <h2 className="app-rating-prompt-card__title">شكرًا لتقييمك! 🌟</h2>
            <p className="app-rating-prompt-card__text">
              تحب تقيّمنا على المتجر كمان؟ تقييمك هناك بيساعدنا نوصل لعملاء أكتر
            </p>
            <div className="app-rating-prompt-card__actions">
              <button type="button" className="btn btn--outline" onClick={onDone} style={{ flex: 1 }}>
                لأ، شكرًا
              </button>
              <button type="button" className="btn btn--primary" onClick={handleOpenStore} style={{ flex: 1 }}>
                قيّمنا على المتجر
              </button>
            </div>
          </>
        )}

        {phase === 'thanks' && (
          <>
            <h2 className="app-rating-prompt-card__title">شكرًا لتقييمك!</h2>
            <p className="app-rating-prompt-card__text">رأيك وصلنا وهيساعدنا نحسّن التطبيق أكتر</p>
            <div className="app-rating-prompt-card__actions">
              <button type="button" className="btn btn--primary" onClick={onDone} style={{ flex: 1 }}>
                تمام
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
