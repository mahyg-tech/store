import { createContext, useCallback, useContext, useRef, useState } from 'react'
import './ToastContext.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { id, message }
  const timerRef = useRef(null)

  const showToast = useCallback((message, duration = 2400) => {
    clearTimeout(timerRef.current)
    const id = Date.now()
    setToast({ id, message })
    timerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast لازم يتستخدم جوه ToastProvider')
  return ctx
}
