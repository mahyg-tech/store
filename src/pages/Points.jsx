import { useEffect, useState } from 'react'
import { Star, Repeat } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import { useToast } from '../context/ToastContext'
import './Points.css'

const TYPE_LABELS = {
  earn: 'نقاط أوردر',
  reverse: 'سحب نقاط (إلغاء/مرتجع)',
  redeem: 'استبدال بشحن محفظة',
  admin_credit: 'إضافة من المتجر',
  admin_debit: 'خصم من المتجر',
}

export default function Points() {
  const [points, setPoints] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const [redeemAmount, setRedeemAmount] = useState('')
  const [redeemError, setRedeemError] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => {
    loadPoints()
  }, [])

  function loadPoints() {
    setLoading(true)
    api
      .fetchPoints()
      .then((data) => setPoints(data))
      .catch((err) => setError(err.message || 'حصل خطأ'))
      .finally(() => setLoading(false))
  }

  async function handleRedeem(e) {
    e.preventDefault()
    setRedeemError('')

    const amount = Math.floor(Number(redeemAmount))
    if (!amount || amount <= 0) {
      setRedeemError('اكتب عدد نقاط صحيح')
      return
    }
    if (points && amount > points.balance) {
      setRedeemError('رصيد نقاطك مش كفاية')
      return
    }
    const minPoints = points?.settings?.redeemMinPoints || 0
    if (minPoints > 0 && amount < minPoints) {
      setRedeemError(`أقل عدد نقاط تقدر تستبدله ${minPoints} نقطة`)
      return
    }

    setRedeeming(true)
    try {
      const res = await api.redeemPoints(amount)
      setRedeemAmount('')
      showToast(`تم استبدال ${res.pointsRedeemed} نقطة بـ ${res.cashValue.toFixed(2)} ج.م في محفظتك ✅`)
      loadPoints()
    } catch (err) {
      setRedeemError(err.message || 'حصل خطأ في الاستبدال، جرب تاني')
    } finally {
      setRedeeming(false)
    }
  }

  const settings = points?.settings
  const redeemValue = settings?.redeemValue ?? 0
  const previewCash = redeemAmount ? (Math.floor(Number(redeemAmount)) || 0) * redeemValue : 0

  return (
    <div>
      <PageHeader title="نقاطي" />
      <div className="container points-page">
        {loading && <p className="text-muted">بيتحمّل…</p>}
        {error && !loading && <p className="login__error" role="alert">{error}</p>}

        {points && (
          <>
            <div className="points-balance-card">
              <Star size={26} strokeWidth={1.8} color="var(--color-white)" aria-hidden="true" fill="var(--color-white)" />
              <div>
                <p className="points-balance-card__label">رصيدك من النقاط</p>
                <p className="points-balance-card__amount">{points.balance} نقطة</p>
              </div>
            </div>

            {settings?.isRedeemOpen ? (
              <form className="points-redeem-form" onSubmit={handleRedeem} style={{ marginBottom: 'var(--sp-5)' }}>
                <p className="points-page__section-title">استبدال النقاط بشحن المحفظة</p>
                {redeemValue > 0 && (
                  <p className="text-muted" style={{ margin: '0 0 var(--sp-3)' }}>
                    كل نقطة = {redeemValue} ج.م
                  </p>
                )}
                <div className="field">
                  <label htmlFor="redeem-points">عدد النقاط اللي عايز تستبدلها</label>
                  <input
                    id="redeem-points"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="مثال: 100"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    required
                  />
                </div>
                {redeemAmount && !redeemError && (
                  <p className="text-muted" style={{ margin: '0 0 var(--sp-3)' }}>
                    هتاخد {previewCash.toFixed(2)} ج.م في محفظتك
                  </p>
                )}
                {redeemError && <p className="login__error" role="alert">{redeemError}</p>}
                <button type="submit" className="btn btn--primary btn--block" disabled={redeeming}>
                  <Repeat size={18} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} aria-hidden="true" />
                  {redeeming ? 'جاري الاستبدال…' : 'استبدال الآن'}
                </button>
              </form>
            ) : (
              <p className="text-muted" style={{ marginBottom: 'var(--sp-5)' }}>
                استبدال النقاط مش متاح دلوقتي.
              </p>
            )}

            <p className="points-page__section-title">كشف الحساب</p>
            {points.transactions.length === 0 ? (
              <p className="text-muted">مفيش عمليات على نقاطك لسه</p>
            ) : (
              <ul className="points-transactions">
                {points.transactions.map((t) => (
                  <li key={t.id} className="points-transactions__item">
                    <div>
                      <p className="points-transactions__type">
                        {TYPE_LABELS[t.type] || t.type}
                        {t.note ? ` — ${t.note}` : ''}
                      </p>
                      <p className="points-transactions__date">{formatDate(t.createdAt)}</p>
                    </div>
                    <span
                      className={
                        'points-transactions__amount ' +
                        (t.points >= 0 ? 'points-transactions__amount--credit' : 'points-transactions__amount--debit')
                      }
                    >
                      {t.points >= 0 ? '+' : ''}
                      {t.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
