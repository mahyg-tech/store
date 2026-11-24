import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveBackTarget, setBackOverride, clearBackOverride } from '../utils/backNavigation'

/**
 * بيرجّع دالة "ارجع" بنفس منطق زرار الرجوع الأصلي: للصفحة الأم في ترتيب
 * التطبيق (شوف utils/backNavigation.js)، مش لتاريخ الصفحات المزارة.
 * بترجّع true لو رجعت فعلًا، و false لو دي صفحة جذر (مفيش قبلها).
 * بنستخدم replace عشان تاريخ التصفح ماينفخش — محدش بيعتمد عليه.
 */
export function useGoBack() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    const target = resolveBackTarget(location.pathname, location.state)
    if (!target) return false
    navigate(target, { replace: true })
    return true
  }, [navigate, location.pathname, location.state])
}

/**
 * الصفحة اللي أبوها بيعتمد على بيانات محمّلة (زي القسم الفرعي) بتسجّل
 * وجهة الرجوع بتاعتها من هنا. target = null يعني "استخدم الافتراضي".
 */
export function useBackTarget(target) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!target) return
    setBackOverride(pathname, target)
    return () => clearBackOverride(pathname)
  }, [pathname, target])
}
