import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api/client'
import { useAuth } from './AuthContext'

const DealsContext = createContext({ deals: [], loading: true })

export function DealsProvider({ children }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth()

  // deals.php بيطلب تسجيل دخول (require_auth) — فلو العميل سجّل دخول (أو
  // اتسجّل كعميل جديد) بعد ما التطبيق فتح، الجلب الأول كان بيفشل بـ 401 ومفيش
  // حاجة بتعيده، فالعروض كانت بتفضل فاضية لحد ما التطبيق يتقفل ويتفتح. دلوقتي
  // بنجيبها أول ما isAuthenticated يبقى true (ولو كان مسجّل أصلاً بيجيبها
  // فورًا زي الأول).
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    api
      .fetchDeals()
      .then((data) => {
        if (!cancelled) setDeals(data || [])
      })
      .catch((err) => console.error('fetchDeals failed:', err.message))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  return <DealsContext.Provider value={{ deals, loading }}>{children}</DealsContext.Provider>
}

export function useDeals() {
  return useContext(DealsContext)
}
