// جسر بسيط بين البوب أب الترحيبي (components/WelcomePopup.jsx) والجولة التعريفية
// (components/OnboardingTour.jsx) عشان الجولة تعرف:
//  - 'pending': البوب أب لسه بيتحمّل (الجولة تستنى)
//  - 'shown'  : فيه بوب أب ظاهر (الجولة تبدأ بخطوة تشرحه وبعدين تقفله)
//  - 'none'   : مفيش بوب أب (اتعرض قبل كده في السيشن / مفيش إعلانات / فشل التحميل)
let status = 'pending'
const listeners = new Set()

export function setPopupStatus(next) {
  if (status === next) return
  status = next
  listeners.forEach((fn) => fn(next))
}

export function getPopupStatus() {
  return status
}

export function onPopupStatus(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// الجولة شغالة/مستنية تبدأ؟ المساعد (VoiceAssistant.jsx) مابيفتحش نفسه تلقائياً
// فوقها، ويفتح بعدها لو عنده رسايل جديدة.
let tourBusy = false

export function setTourBusy(next) {
  tourBusy = Boolean(next)
}

export function isTourBusy() {
  return tourBusy
}

// الجولة بتطلب من البوب أب يقفل نفسه (بنفس حركة الفرقعة بتاعته)
export function requestClosePopup() {
  window.dispatchEvent(new Event('elmahi:close-welcome-popup'))
}
