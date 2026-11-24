import { useEffect, useState } from 'react'
import { Trophy, Check, Clock3 } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import './Competition.css'

// صفحة المسابقة ("تحت نقاطي" في حسابي، وكمان أي سلايدر/كارت عرض اتحدد
// لينكه "يفتح صفحة المسابقة" — شوف utils/promoLinks.js وcomponents/GridPromoCard.jsx).
// تقدم العميل = إجمالي قيمة مشترياته (بالجنيه) اللي وصلت "اتسلم"، بيحسبه
// ويصرف مكافآت درجاته السيرفر أوتوماتيك — الصفحة دي للعرض الحماسي بس.
export default function Competition() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .fetchCompetition()
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'حصل خطأ'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="المسابقة" />
      <div className="container competition-page">
        {loading && <p className="text-muted">بيتحمّل…</p>}
        {error && !loading && <p className="login__error" role="alert">{error}</p>}

        {!loading && !error && data && !data.active && (
          <div className="competition-empty">
            <Trophy size={40} strokeWidth={1.6} color="var(--color-ink-400)" aria-hidden="true" />
            <p className="competition-empty__title">مفيش مسابقة شغالة دلوقتي</p>
            <p className="text-muted">تابعنا قريبًا — المسابقة الجاية ممكن تكسب منها كاش في محفظتك!</p>
          </div>
        )}

        {!loading && !error && data && data.active && (
          <CompetitionView data={data} />
        )}
      </div>
    </div>
  )
}

function CompetitionView({ data }) {
  const target = Number(data.targetAmount) || 0
  const amount = Number(data.amount) || 0
  const pct = target > 0 ? Math.max(0, Math.min(100, (amount / target) * 100)) : 0
  const tiers = [...(data.tiers || [])].sort((a, b) => a.threshold - b.threshold)
  const daysLeft = daysRemaining(data.endsAt)

  return (
    <>
      <div className="competition-hero">
        <Trophy size={30} strokeWidth={1.8} color="var(--color-white)" fill="var(--color-white)" aria-hidden="true" />
        <div>
          <p className="competition-hero__title">{data.title}</p>
          {data.subtitle && <p className="competition-hero__subtitle">{data.subtitle}</p>}
        </div>
      </div>

      {daysLeft !== null && (
        <p className="competition-countdown">
          <Clock3 size={15} strokeWidth={2} aria-hidden="true" />
          {daysLeft > 0 ? `باقي ${daysLeft} يوم على نهاية المسابقة` : 'المسابقة بتنتهي النهاردة'}
        </p>
      )}

      <div className="competition-progress">
        <div className="competition-progress__track">
          <div className="competition-progress__fill" style={{ width: `${pct}%` }} />
          {tiers.map((t) => {
            const tPct = target > 0 ? Math.max(0, Math.min(100, (t.threshold / target) * 100)) : 0
            return (
              <div
                key={t.id}
                className={'competition-progress__marker' + (t.reached ? ' competition-progress__marker--reached' : '')}
                style={{ insetInlineStart: `${tPct}%` }}
              >
                {t.reached && <Check size={11} strokeWidth={3} color="var(--color-white)" aria-hidden="true" />}
              </div>
            )
          })}
        </div>
        <div className="competition-progress__labels">
          <span>{amount.toFixed(0)} ج.م</span>
          <span className="text-muted">الهدف: {target.toFixed(0)} ج.م</span>
        </div>
      </div>

      <p className="competition-page__section-title">درجات المكافآت</p>
      <ul className="competition-tiers">
        {tiers.map((t) => (
          <li key={t.id} className={'competition-tier' + (t.credited ? ' competition-tier--credited' : '')}>
            <div className={'competition-tier__badge' + (t.reached ? ' competition-tier__badge--reached' : '')}>
              {t.reached ? <Check size={16} strokeWidth={3} color="var(--color-white)" aria-hidden="true" /> : <Trophy size={16} strokeWidth={1.8} color="var(--color-mango-600)" aria-hidden="true" />}
            </div>
            <div style={{ flex: 1 }}>
              <p className="competition-tier__label">{t.label || `عند ${t.threshold} ج.م مشتريات`}</p>
              <p className="competition-tier__detail">
                عند {t.threshold} ج.م مشتريات — مكافأة {t.reward} ج.م كاش في محفظتك
              </p>
            </div>
            {t.credited ? (
              <span className="competition-tier__status competition-tier__status--done">اتصرفت ✅</span>
            ) : (
              <span className="competition-tier__status">
                متبقي {Math.max(0, t.threshold - amount).toFixed(0)} ج.م
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function daysRemaining(endsAtIso) {
  if (!endsAtIso) return null
  const end = new Date(endsAtIso).getTime()
  if (Number.isNaN(end)) return null
  const diffMs = end - Date.now()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / 86400000)
}
