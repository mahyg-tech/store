import { useEffect, useRef, useState } from 'react'
import { getConnectivity, subscribeConnectivity } from '../utils/apiCache'
import './OfflineBanner.css'

const BACK_ONLINE_VISIBLE_MS = 8000

/**
 * شريط صغير فوق الشاشة بيقول للعميل إنه بيشوف نسخة محفوظة (مفيش نت أو النت
 * ضعيف جدًا)، ولما النت يرجع بيظهر "رجع النت" مع زرار تحديث — الشاشات اللي
 * اتعرضت من الكاش مبتتحدثش لوحدها، فالزرار بيعيد تحميل التطبيق (السلة محفوظة).
 */
export default function OfflineBanner() {
  const [connectivity, setConnectivity] = useState(getConnectivity)
  const [backOnline, setBackOnline] = useState(false)
  const wasDegradedRef = useRef(false)

  useEffect(() => subscribeConnectivity(setConnectivity), [])

  const degraded = !connectivity.online || connectivity.servingCache

  useEffect(() => {
    if (degraded) {
      wasDegradedRef.current = true
      setBackOnline(false)
      return undefined
    }
    if (wasDegradedRef.current) {
      wasDegradedRef.current = false
      setBackOnline(true)
      const timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_VISIBLE_MS)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [degraded])

  if (degraded) {
    return (
      <div className="offline-banner offline-banner--offline" role="status">
        {connectivity.online
          ? 'النت ضعيف — بتشوف آخر بيانات محفوظة'
          : 'مفيش نت — بتشوف آخر بيانات محفوظة'}
      </div>
    )
  }

  if (backOnline) {
    return (
      <div className="offline-banner offline-banner--online" role="status">
        <span>رجع النت</span>
        <button type="button" className="offline-banner__action" onClick={() => window.location.reload()}>
          حدّث البيانات
        </button>
      </div>
    )
  }

  return null
}
