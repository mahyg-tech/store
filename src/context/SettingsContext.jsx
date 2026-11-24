import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api/client'

// نفس القيمة الافتراضية اللي في PromoSlider — لحد ما رد settings.php يوصل
export const DEFAULT_PROMO_AUTOPLAY_MS = 4200

const SettingsContext = createContext({ promoAutoplayMs: DEFAULT_PROMO_AUTOPLAY_MS, promoDirection: 'side' })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ promoAutoplayMs: DEFAULT_PROMO_AUTOPLAY_MS, promoDirection: 'side' })

  useEffect(() => {
    api
      .fetchSettings({ onUpdate: (data) => data && setSettings((s) => ({ ...s, ...data })) })
      .then((data) => data && setSettings((s) => ({ ...s, ...data })))
      .catch((err) => console.error('fetchSettings failed:', err.message))
  }, [])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
