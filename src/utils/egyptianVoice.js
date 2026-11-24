import { getToken } from '../api/client'

// =============================================================================
// نقطة الدخول الوحيدة للنطق بالعامية المصرية في التطبيق (بتلف plugin
// capacitor-egyptian-tts). بتظبطه أول ما يتستخدم من نفس متغيرات البيئة اللي
// api/client.js بيستخدمها، وبتضمن إن أي فشل نطق ما يكسّرش الشاشة — النطق
// إضافة، مش شرط لشغل التطبيق.
//
//  - الصوت المصري السحابي (Azure) بيعدّي على سيرفرك: ${VITE_API_BASE_URL}/tts.php
//    بنفس توكن دخول العميل (المفتاح السري بتاع Azure ماوصلش التطبيق أبدًا).
//  - في وضع الـ mock (VITE_USE_MOCK=true) مفيش سيرفر، فبيشتغل نطق الجهاز بس.
// =============================================================================

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim()

let configured = false

// الـ plugin (capacitor-egyptian-tts) لازم يكون متعرّف كـ EgyptianTts. في الملفات
// اللي اتبعتلي مفيش import ولا تعريف ليه، فأي نداء كان بيرمي ReferenceError
// واتبلع في الـ catch = صمت تام. typeof بيحمينا من الخطأ ده، ولو الـ plugin مش
// متاح بنكمّل بنطق المتصفح/الجهاز (Web Speech API) بدل ما نسكت.
function getPlugin() {
  // eslint-disable-next-line no-undef
  return typeof EgyptianTts !== 'undefined' ? EgyptianTts : null
}

/** نطق احتياطي بصوت الجهاز (عربي مصري لو متاح، وإلا أي صوت عربي). */
function browserSpeak(text) {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      resolve(null)
      return
    }
    try {
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ar-EG'
      const voices = synth.getVoices() || []
      const voice =
        voices.find((v) => /^ar[-_]EG/i.test(v.lang)) || voices.find((v) => /^ar/i.test(v.lang))
      if (voice) utter.voice = voice
      utter.rate = 0.95
      utter.onend = () => resolve(true)
      utter.onerror = () => resolve(null)
      synth.speak(utter)
    } catch {
      resolve(null)
    }
  })
}

function ensureConfigured() {
  if (configured) return
  configured = true
  const plugin = getPlugin()
  if (!plugin) return

  // شيل السلاش الأخير عشان مايطلعش "//tts.php"
  const endpoint = !USE_MOCK && API_BASE_URL ? `${API_BASE_URL.replace(/\/+$/, '')}/tts.php` : ''

  plugin.configure({
    endpoint,
    getToken: () => getToken(),
    voice: 'salma', // غيّرها لـ 'shakir' لو عايز صوت رجالي
  })
}

/** بينطق النص بالعامية المصرية. مابيرميش أبدًا (بيرجّع null لو فشل). */
export async function speakEgyptian(text, options) {
  try {
    const plugin = getPlugin()
    if (!plugin) return await browserSpeak(text)
    ensureConfigured()
    return await plugin.speak(text, options)
  } catch (err) {
    console.warn('speakEgyptian failed:', err?.code || '', err?.message || err)
    return null
  }
}

export async function stopSpeaking() {
  try {
    const plugin = getPlugin()
    if (plugin) await plugin.stop()
    else if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  } catch {
    /* تجاهل */
  }
}

/** بينزّل صوت جمل مقدّمًا عشان تشتغل فورًا لما تتنطق (مابيرميش أبدًا). */
export async function prefetchSpeech(texts) {
  try {
    const plugin = getPlugin()
    if (!plugin) return null // النطق الاحتياطي مفيهوش تحميل مسبق
    ensureConfigured()
    return await plugin.prefetch(texts)
  } catch {
    return null
  }
}
