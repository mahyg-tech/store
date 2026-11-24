import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useToast } from '../context/ToastContext'
import { resolveBackTarget } from '../utils/backNavigation'

/**
 * زرار الرجوع الأصلي بتاع الموبايل (أندرويد): بيرجّع للصفحة اللي "قبلها
 * في ترتيب التطبيق" (القسم → الرئيسية، المنتج → الصفحة اللي فتحته،
 * إتمام الطلب → السلة…) — مش لآخر صفحة اتزارت في تاريخ التصفح. الجدول
 * كله في utils/backNavigation.js.
 *
 * لو إحنا في صفحة جذر (الرئيسية، أو تسجيل الدخول) مفيش "قبلها": أول
 * ضغطة بتوري تنبيه بسيط، والضغطة التانية خلال ثانيتين بتقفل التطبيق
 * فعليًا — عشان محدش يقفل التطبيق بالغلط بضغطة واحدة.
 *
 * محتاج مكتبة @capacitor/app (npm install @capacitor/app + npx cap sync).
 */
export function useHardwareBackButton() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const lastPressRef = useRef(0)

  // الـ listener بيتسجّل مرة واحدة، فبنقرا آخر صفحة/state من ref وقت الضغط
  const locationRef = useRef(location)
  locationRef.current = location
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const { pathname, state } = locationRef.current
      const target = resolveBackTarget(pathname, state)

      if (target) {
        navigateRef.current(target, { replace: true })
        return
      }

      const now = Date.now()
      if (now - lastPressRef.current < 2000) {
        CapacitorApp.exitApp()
        return
      }
      lastPressRef.current = now
      showToast('اضغط رجوع مرة تانية للخروج')
    })

    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [showToast])
}
