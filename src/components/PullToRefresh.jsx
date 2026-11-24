import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import './PullToRefresh.css'

// مبني من الصفر بـ touch events + CSS عادي (من غير أي مكتبة) لأن صفحة
// الهوم بتعمل scroll على مستوى الصفحة كلها (document body)، مش جوه
// container بارتفاع ثابت وoverflow خاص بيه — فمكتبات الـ pull-to-refresh
// الجاهزة المبنية على افتراض container بيعمل scroll لوحده متكونش شغالة صح هنا.
const PULL_THRESHOLD = 70 // بكسل السحب اللازم عشان الريفريش "يتحرر"
const MAX_PULL = 110 // أقصى مسافة سحب مسموح بيها بصريًا (بعدها مقاومة كاملة)
const RESISTANCE = 0.45 // كل بكسل سحب فعلي بيترجم لنسبة من ده بس (إحساس مطاطي)

// عناصر الشاشات الكاملة اللي ليها scroll داخلي خاص بيها (شات المساعد
// الصوتي، بوب أب الترحيب) — لو السحب بدأ جواها منسيبها تتصرف عادي
// ومنبدأش نتابع pull-to-refresh فوقها
const IGNORE_SELECTOR = '.voice-assistant-backdrop, .welcome-popup-backdrop'

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(null)
  const pullingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const setPull = useCallback((value) => {
    pullDistanceRef.current = value
    setPullDistance(value)
  }, [])

  useEffect(() => {
    function isAtTop() {
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 0
    }

    function onTouchStart(e) {
      if (refreshingRef.current || !isAtTop()) return
      if (e.target.closest && e.target.closest(IGNORE_SELECTOR)) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = true
    }

    function onTouchMove(e) {
      if (!pullingRef.current || startYRef.current === null) return

      const delta = e.touches[0].clientY - startYRef.current

      // لو اتحرك لفوق تاني أو الصفحة بقت متسحبة لتحت، بطّل السحب
      if (delta <= 0 || !isAtTop()) {
        pullingRef.current = false
        setPull(0)
        return
      }

      // منع الـ bounce الطبيعي للـ WebView/المتصفح أثناء السحب اليدوي بتاعنا
      e.preventDefault()
      setPull(Math.min(delta * RESISTANCE, MAX_PULL))
    }

    async function onTouchEnd() {
      if (!pullingRef.current) return
      pullingRef.current = false
      startYRef.current = null

      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPull(PULL_THRESHOLD)
        try {
          await onRefreshRef.current?.()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
          setPull(0)
        }
      } else {
        setPull(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [setPull])

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const showIndicator = pullDistance > 0 || refreshing

  return (
    <div className="ptr">
      {showIndicator && (
        <div className="ptr__indicator" style={{ height: `${pullDistance || PULL_THRESHOLD}px` }}>
          <RefreshCw
            size={20}
            strokeWidth={1.8}
            className={refreshing ? 'ptr__icon ptr__icon--spin' : 'ptr__icon'}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${progress * 180}deg)`, opacity: 0.4 + progress * 0.6 }
            }
          />
        </div>
      )}
      <div
        className="ptr__content"
        style={pullDistance ? { transform: `translateY(${pullDistance}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
