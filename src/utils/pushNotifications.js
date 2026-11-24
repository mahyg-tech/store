import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import * as api from '../api/client'

const PUSH_TOKEN_KEY = 'elmahi_cash_push_token'

// قناة إشعارات أندرويد الخاصة برسايل المساعد — نفس الاسم اللي السيرفر بيبعته
// في android.notification.channel_id (assistant-messages-helpers.php). من غير
// قناة بأهمية عالية، أندرويد 8+ بيعرض الإشعار كأيقونة هادية في الشريط من غير
// popup ولا صوت مسموع.
export const ASSISTANT_CHANNEL_ID = 'assistant_messages'

// نوع الإشعار اللي السيرفر بيحطه في data لرسايل المساعد
export const ASSISTANT_PUSH_TYPE = 'assistant_message'

// نطلب إذن الإشعارات مرة واحدة أول ما العميل يفتح التطبيق بعد تسجيل الدخول.
// من غير الإذن مفيش توكن، ومن غير توكن الأدمن مايقدرش يبعتله إشعار برّه
// التطبيق. (قبل كده الإذن كان بيتطلب بس لما العميل يدوس "أخبرني لما يتوفر"،
// فأغلب العملاء ماكانوش بيوصلهم أي إشعار.) لو عايز ترجّع الطلب في سياق تاني
// بس، خلّيها false.
const ASK_PERMISSION_ON_START = true
const PERMISSION_ASK_DELAY_MS = 2500 // نسيب الشاشة الرئيسية تظهر الأول
const PUSH_ASKED_KEY = 'elmahi_cash_push_permission_asked'

export function getStoredPushToken() {
  return localStorage.getItem(PUSH_TOKEN_KEY)
}

function setStoredPushToken(token) {
  if (token) localStorage.setItem(PUSH_TOKEN_KEY, token)
  else localStorage.removeItem(PUSH_TOKEN_KEY)
}

let listenersReady = false
// آخر callbacks اتمرّرت. الـ listeners بتقراها وقت وصول الحدث، مش وقت التسجيل —
// عشان لو initPushNotifications اتنادت تاني بـ callbacks جديدة (navigate
// اتغيّرت مثلاً) ماننشدش على النسخة الأولى القديمة.
let handlers = {}

function alreadyAsked() {
  try {
    return localStorage.getItem(PUSH_ASKED_KEY) === '1'
  } catch {
    return false
  }
}

function markAsked() {
  try {
    localStorage.setItem(PUSH_ASKED_KEY, '1')
  } catch {
    /* تجاهل */
  }
}

async function createAssistantChannel() {
  try {
    await PushNotifications.createChannel({
      id: ASSISTANT_CHANNEL_ID,
      name: 'رسائل المساعد',
      description: 'رسائل وعروض من المساعد الذكي',
      importance: 5, // أعلى أهمية: popup + صوت
      visibility: 1,
      vibration: true,
      lights: true,
    })
  } catch {
    /* أندرويد بس — على iOS/ويب مش مدعومة */
  }
}

/**
 * بتتنده لما العميل يكون مسجّل دخول (شوف App.jsx) — بتسجّل الـ listeners مرة
 * واحدة، وبتجهّز قناة الإشعارات، وبتعيد تسجيل التوكن لو الإذن متمنوح، أو
 * بتطلب الإذن (مرة واحدة بس) لو لسه ماتطلبش.
 *
 * $handlers:
 *   onNotificationTap(notification)         العميل ضغط على إشعار (والتطبيق
 *                                            مقفول أو في الخلفية)
 *   onForegroundNotification(notification)  إشعار وصل والتطبيق مفتوح قدام العميل
 *                                            (أندرويد مابيعرضوش لوحده)
 */
export function initPushNotifications({ onNotificationTap, onForegroundNotification } = {}) {
  if (!Capacitor.isNativePlatform()) return
  handlers = { onNotificationTap, onForegroundNotification }

  if (!listenersReady) {
    listenersReady = true

    PushNotifications.addListener('registration', (token) => {
      setStoredPushToken(token.value)
      api.registerPushToken(token.value).catch(() => {})
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration failed:', err)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handlers.onNotificationTap?.(action.notification)
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      handlers.onForegroundNotification?.(notification)
    })

    createAssistantChannel()
  }

  PushNotifications.checkPermissions()
    .then(async (res) => {
      let status = res.receive
      const canAsk = status === 'prompt' || status === 'prompt-with-rationale'
      if (canAsk && ASK_PERMISSION_ON_START && !alreadyAsked()) {
        markAsked() // مرة واحدة بس، حتى لو رفض أو قفل الشاشة
        await new Promise((resolve) => setTimeout(resolve, PERMISSION_ASK_DELAY_MS))
        status = (await PushNotifications.requestPermissions()).receive
      }
      if (status === 'granted') {
        await PushNotifications.register()
      }
    })
    .catch((err) => console.error('Push permission flow failed:', err))
}

/**
 * بتتنده وقت ما العميل يضغط \"أخبرني لما يتوفر\" — تطلب إذن الإشعارات في
 * سياقه لو لسه ما اتطلبش (initPushNotifications بتطلبه كمان مرة واحدة أول
 * ما التطبيق يفتح، عشان رسايل المساعد توصل لكل العملاء). بترجع true لو فيه توكن جاهز
 * فعليًا (سواء كان موجود قبل كده أو المفروض يوصل خلال ثواني)، وfalse لو
 * رفض الإذن أو مش على تطبيق موبايل أصلاً.
 */
export async function ensurePushPermission() {
  if (!Capacitor.isNativePlatform()) return false
  if (getStoredPushToken()) return true

  const current = await PushNotifications.checkPermissions()
  let status = current.receive
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    markAsked()
    const requested = await PushNotifications.requestPermissions()
    status = requested.receive
  }

  if (status !== 'granted') return false

  await PushNotifications.register()
  // التوكن نفسه بيوصل بعدين عن طريق listener('registration') فوق (مش
  // فورًا) وبيتبعت للسيرفر تلقائيًا من هناك.
  return true
}

export async function unregisterPushToken() {
  const token = getStoredPushToken()
  if (!token) return
  setStoredPushToken(null)
  try {
    await api.unregisterPushToken(token)
  } catch {
    // مش حرج — لو فشل، الملكية هتتحدث تلقائيًا لو حد تاني سجّل دخول على
    // نفس الجهاز بعدين (شوف push-token-register.php)
  }
}
