import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../api/client'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { ensurePushPermission } from '../utils/pushNotifications'

const StockNotifyContext = createContext(null)

export function StockNotifyProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [pendingIds, setPendingIds] = useState(() => new Set())

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingIds(new Set())
      return
    }
    let active = true
    api
      .fetchMyStockNotifyRequests()
      .then((ids) => {
        if (active) setPendingIds(new Set(ids || []))
      })
      .catch(() => {}) // مش حرج — الزرار هيفضل شغال عادي، بس من غير حالة "متسجل" محفوظة
    return () => {
      active = false
    }
  }, [isAuthenticated])

  const isPending = useCallback((unitId) => pendingIds.has(unitId), [pendingIds])

  const requestNotify = useCallback(
    async (unitId, productName, unitLabel) => {
      if (pendingIds.has(unitId)) return

      const hasPushReady = await ensurePushPermission()

      try {
        await api.requestStockNotify({ unitId, productName, unitLabel })
        setPendingIds((prev) => new Set(prev).add(unitId))
        showToast(
          hasPushReady
            ? 'تمام، هنبعتلك إشعار لما يتوفر 🔔'
            : 'اتسجل طلبك — فعّل الإشعارات من إعدادات الموبايل عشان توصلك 🔔'
        )
      } catch (err) {
        showToast(err.message || 'حصل خطأ، حاول تاني')
      }
    },
    [pendingIds, showToast]
  )

  return (
    <StockNotifyContext.Provider value={{ isPending, requestNotify }}>
      {children}
    </StockNotifyContext.Provider>
  )
}

export function useStockNotify() {
  const ctx = useContext(StockNotifyContext)
  if (!ctx) throw new Error('useStockNotify لازم يتستخدم جوه StockNotifyProvider')
  return ctx
}
