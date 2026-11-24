// "قيّم التطبيق" — طلب تقييم عام للتطبيق (مش لطلب بعينه، شوف RatingPromptModal
// للمقارنة)، بيظهر أول مرة بعد 15 يوم تقويمي من أول تسجيل دخول للعميل على
// الجهاز ده، ولو دوس "لاحقًا" بيتكرر السؤال تاني كل 15 يوم لحد ما يقيّم
// فعليًا (ساعتها مابيتسألش تاني أبدًا). كله محلي على الجهاز (localStorage)،
// بنفس فكرة utils/onboardingTour.js — المفتاح بيعتمد على id العميل (أو رقمه)
// عشان لو عميل تاني سجل دخول على نفس الجهاز يبقى له عداده الخاص.
//
// ملحوظة: العداد ده بيبدأ من "أول مرة الجهاز ده شاف العميل ده"، مش من تاريخ
// إنشاء حسابه الفعلي على السيرفر — لو مسح بيانات التطبيق أو بدّل جهاز
// وسجّل دخول تاني، العداد بيبدأ من جديد. ده قرار مقصود (بنفس أسلوب باقي
// حالات العميل المحفوظة محليًا زي الجولة التعريفية وآخر 5 عمليات بحث)، مش
// حاجة محتاجة تعديل في السيرفر.
const PREFIX = 'elmahi_app_rating:'
const INTERVAL_DAYS = 15
const INTERVAL_MS = INTERVAL_DAYS * 24 * 60 * 60 * 1000

function keyFor(customer) {
  const id = customer?.id ?? customer?.phone
  return id ? PREFIX + id : null
}

function readState(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    /* التخزين مش شغال — منزعجش العميل، هيتفحص تاني في المرة الجاية */
  }
}

// بتتنده مرة كل ما يسجل دخول/يفتح التطبيق. أول مرة نشوف العميل ده على الجهاز،
// بتسجل دلوقتي كـ"أول استخدام" وبترجع false على طول (أول سؤال هيبقى بعد 15
// يوم من اللحظة دي، مش فورًا).
export function isAppRatingDue(customer) {
  const key = keyFor(customer)
  if (!key) return false

  const state = readState(key)
  const now = Date.now()

  if (!state) {
    writeState(key, { firstSeenAt: now, ratedAt: null, nextPromptAt: now + INTERVAL_MS })
    return false
  }

  if (state.ratedAt) return false // قيّم قبل كده — مابيتسألش تاني خالص
  return now >= (state.nextPromptAt ?? Infinity)
}

// العميل دوس "لاحقًا" — نسأله تاني بعد 15 يوم من دلوقتي بالظبط
export function postponeAppRating(customer) {
  const key = keyFor(customer)
  if (!key) return
  const state = readState(key) || { firstSeenAt: Date.now(), ratedAt: null }
  state.nextPromptAt = Date.now() + INTERVAL_MS
  writeState(key, state)
}

// العميل قيّم فعليًا (أي عدد نجوم من 1 لـ 5) — مابيتسألش تاني أبدًا بعد كده
export function markAppRated(customer) {
  const key = keyFor(customer)
  if (!key) return
  const state = readState(key) || { firstSeenAt: Date.now() }
  state.ratedAt = Date.now()
  writeState(key, state)
}
