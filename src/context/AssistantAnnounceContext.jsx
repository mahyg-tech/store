import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { linesToSpeech } from '../utils/dealAnnouncements'
import { speakEgyptian, stopSpeaking } from '../utils/egyptianVoice'

// =============================================================================
// "المساعد بيكلّم العميل من نفسه": أي جزء في التطبيق ينادي announce({ lines })
// فتظهر فقاعة المساعد (components/AssistantOfferBubble.jsx) وبيتنطق النص
// بالعامية المصرية عن طريق الـ plugin (utils/egyptianVoice.js ←
// capacitor-egyptian-tts): صوت مصري سحابي، وبعده صوت الجهاز، وبعده المتصفح —
// كل ده جوّه الـ plugin، هنا بس بنقول "انطق". مستخدم حاليًا في:
//  - components/DealAnnouncer.jsx (لما صنف عليه عرض يتضاف للسلة)
//  - pages/ProductDetail.jsx (لما العميل يفتح صفحة صنف عليه عرض)
//
// - cooldownMs مع key: نفس الـ key ما يتبلّغش تاني قبل ما الفترة دي تعدّي
//   (عشان العميل لو فتح نفس الصنف كذا مرة ورا بعض ما يسمعش نفس الكلام).
// - أي إعلان جديد بيبدّل القديم (الفقاعة والصوت)، مش بيتراكموا.
// - كتم الصوت (بتفضل الفقاعة ظاهرة) بيتحفظ في localStorage.
// =============================================================================

const MUTE_KEY = 'assistantVoiceMuted'
const MIN_VISIBLE_MS = 7000
const MAX_VISIBLE_MS = 16000

const AssistantAnnounceContext = createContext({
  current: null,
  muted: false,
  voiceSupported: true,
  announce: () => false,
  dismiss: () => {},
  toggleMute: () => {},
})

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function AssistantAnnounceProvider({ children }) {
  const [current, setCurrent] = useState(null) // { id, lines }
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)
  const currentRef = useRef(null)
  const lastByKeyRef = useRef(new Map())
  const hideTimerRef = useRef(null)
  const idRef = useRef(0)

  const dismiss = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    stopSpeaking()
    currentRef.current = null
    setCurrent(null)
  }, [])

  const announce = useCallback(({ key, lines, cooldownMs = 0 }) => {
    const clean = (lines || []).filter(Boolean)
    if (clean.length === 0) return false

    const now = Date.now()
    if (key) {
      const last = lastByKeyRef.current.get(key)
      if (last && now - last < cooldownMs) return false
      lastByKeyRef.current.set(key, now)
    }

    clearTimeout(hideTimerRef.current)
    idRef.current += 1
    const entry = { id: idRef.current, lines: clean }
    currentRef.current = entry
    setCurrent(entry)

    if (mutedRef.current) stopSpeaking()
    else speakEgyptian(linesToSpeech(clean))

    const chars = clean.join(' ').length
    const visibleMs = Math.min(MAX_VISIBLE_MS, Math.max(MIN_VISIBLE_MS, 3000 + chars * 70))
    hideTimerRef.current = setTimeout(() => {
      currentRef.current = null
      setCurrent(null)
    }, visibleMs)
    return true
  }, [])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0')
    } catch {
      /* تجاهل */
    }
    if (next) stopSpeaking()
    else if (currentRef.current) speakEgyptian(linesToSpeech(currentRef.current.lines))
  }, [])

  useEffect(
    () => () => {
      clearTimeout(hideTimerRef.current)
      stopSpeaking()
    },
    [],
  )

  const value = useMemo(
    // voiceSupported دايمًا true: الـ plugin نفسه بيتصرف (سحابي ← جهاز ← متصفح)
    () => ({ current, muted, voiceSupported: true, announce, dismiss, toggleMute }),
    [current, muted, announce, dismiss, toggleMute],
  )

  return <AssistantAnnounceContext.Provider value={value}>{children}</AssistantAnnounceContext.Provider>
}

export function useAssistantAnnounce() {
  return useContext(AssistantAnnounceContext)
}
