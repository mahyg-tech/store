import { createContext, useContext, useState, useCallback } from 'react'
import * as api from '../api/client'
import { unregisterPushToken } from '../utils/pushNotifications'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(() => api.getStoredCustomer())

  const login = useCallback((customerData) => {
    setCustomer(customerData)
  }, [])

  const logout = useCallback(() => {
    // لازم قبل api.logout() — محتاجة توكن الدخول لسه شغال عشان تقدر
    // تمسح توكن الإشعارات بتاع الجهاز من السيرفر (best-effort، من غير
    // انتظار).
    unregisterPushToken()
    api.logout()
    setCustomer(null)
  }, [])

  const value = {
    customer,
    isAuthenticated: Boolean(customer),
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth لازم يتستخدم جوه AuthProvider')
  return ctx
}
