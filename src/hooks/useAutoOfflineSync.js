import { useEffect } from 'react'
import { shouldAutoSync, syncOfflineData } from '../utils/offlineSync'

const START_DELAY_MS = 4000 // بعد ما الرئيسية تخلص تحميلها، عشان المزامنة ماتنافسهاش

/**
 * بتشغّل مزامنة الأوفلاين (utils/offlineSync.js) في الخلفية: بعد فتح التطبيق
 * بكام ثانية لو آخر مزامنة قديمة (أو مفيش)، وكمان أول ما النت يرجع بعد ما كان
 * مقطوع. enabled = العميل مسجل دخول.
 */
export function useAutoOfflineSync(enabled) {
  useEffect(() => {
    if (!enabled) return undefined

    const trigger = () => {
      if (shouldAutoSync()) syncOfflineData().catch(() => {})
    }

    const timer = setTimeout(trigger, START_DELAY_MS)
    window.addEventListener('online', trigger)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', trigger)
    }
  }, [enabled])
}
