// =============================================================================
// كاش الـ API للعمل بدون نت + فتح سريع من غير ما ننتظر الشبكة كل مرة
// -----------------------------------------------------------------------------
// withCache(key, fetcher, { forceNetwork } = {}):
//   - فيه نسخة محفوظة ومفيش forceNetwork: بترجعها فورًا من غير ما تستنى
//     الشبكة خالص (التطبيق يفتح سريع من المرة التانية)، وفي نفس الوقت
//     بتبعت طلب تحديث صامت في الخلفية (stale-while-revalidate) — التحديث
//     بيحصل لوحده من غير أي حاجة يدوية، بس بيبان في المرة الجاية اللي
//     المفتاح ده يتطلب فيها (مش في نفس اللحظة، لأن الصفحة غالبًا خلصت
//     الرسم بتاعها قبل ما الرد يوصل).
//   - forceNetwork=true (مستخدمة من "اسحب للتحديث" في الرئيسية ومن مزامنة
//     الأوفلاين utils/offlineSync.js)، أو مفيش نسخة محفوظة خالص: بترجع
//     للسلوك القديم بالظبط — بتستنى الشبكة فعليًا (بمهلة قصيرة لو فيه
//     نسخة قديمة لترجعها بدالًا منها لو الشبكة اتأخرت)، عشان الاتنين دول
//     لازم يتأكدوا من نتيجة فعلية من السيرفر مش نسخة قديمة.
//   - مفيش نت خالص (واضح من الجهاز): الكاش فورًا لو موجود من غير أي محاولة شبكة.
//   - مبنخبّيش الأخطاء المنطقية: 401 (جلسة منتهية) و404/422… بتتعرض زي ما هي.
//     الكاش بيتفعّل بس لو مفيش اتصال أو السيرفر واقع (5xx) أو رد بايظ.
//
// التخزين: IndexedDB (utils/offlineDb.js) + نسخة في الذاكرة للسرعة. ردود
// النسخة القديمة اللي كانت في localStorage بتتقرا وتتنقل تلقائيًا.
// =============================================================================

import { idbGet, idbPut, idbPutMany, idbClear, idbKeys, idbDelete } from './offlineDb'

const LEGACY_PREFIX = 'elmahi_cash_api_cache:'
const NORMAL_TIMEOUT_MS = 6000
const AFTER_FAILURE_TIMEOUT_MS = 1500 // لو النت وقع من أقل من نص دقيقة، منستناش كتير
const RECENT_FAILURE_WINDOW_MS = 30000

// ردود خاصة بالعميل الحالي — لازم تتمسح لما يتغيّر الحساب (تسجيل خروج) عشان
// عميل تاني على نفس الجهاز مايشوفش أوردرات/محفظة اللي قبله
const CUSTOMER_SCOPED_PREFIXES = [
  'orders-list',
  'order:',
  'wallet',
  'wallet-topups',
  'stock-notify-my-requests',
  'competition',
  // العروض والسلايدرات والمسابقة بتتفلتر بمنطقة العميل في السيرفر، فلازم
  // الكاش يتمسح لما عميل تاني (بمنطقة تانية) يسجّل دخول على نفس الجهاز
  'promos',
  'deals',
  'grid-promos',
]

const memory = new Map() // key → { data, savedAt }
const TIMEOUT = Symbol('timeout')
const noop = () => {}

// ---------------------------------------------------------------- الاتصال
let state = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  servingCache: false, // آخر رد اتعرض كان من الكاش بسبب مشكلة اتصال
}
let lastFailureAt = 0
const listeners = new Set()

function setState(patch) {
  const next = { ...state, ...patch }
  if (next.online === state.online && next.servingCache === state.servingCache) return
  state = next
  listeners.forEach((fn) => fn(state))
}

export function getConnectivity() {
  return state
}

export function subscribeConnectivity(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => setState({ online: true }))
  window.addEventListener('offline', () => setState({ online: false, servingCache: true }))
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function currentTimeoutMs() {
  return Date.now() - lastFailureAt < RECENT_FAILURE_WINDOW_MS ? AFTER_FAILURE_TIMEOUT_MS : NORMAL_TIMEOUT_MS
}

// الكاش يتفعّل لمشاكل الاتصال/السيرفر بس، مش لأخطاء منطقية (401/403/404/422…)
function shouldFallBack(err) {
  const status = err && typeof err.status === 'number' ? err.status : null
  if (status === null) return true // خطأ شبكة خام أو رد مش JSON
  return status === 0 || status >= 500
}

// ---------------------------------------------------------------- التخزين
async function readEntry(key) {
  const inMemory = memory.get(key)
  if (inMemory) return inMemory

  const stored = await idbGet('api', key)
  if (stored) {
    const entry = { data: stored.data, savedAt: stored.savedAt }
    memory.set(key, entry)
    return entry
  }

  // نسخة قديمة من localStorage (قبل ما نعدّي على IndexedDB) — ننقلها
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + key)
    if (raw) {
      const legacy = JSON.parse(raw)
      if (legacy && 'data' in legacy) {
        const entry = { data: legacy.data, savedAt: legacy.savedAt || Date.now() }
        memory.set(key, entry)
        idbPut('api', { key, ...entry })
        localStorage.removeItem(LEGACY_PREFIX + key)
        return entry
      }
    }
  } catch {
    /* تجاهل */
  }
  return null
}

async function writeEntry(key, data) {
  const entry = { data, savedAt: Date.now() }
  memory.set(key, entry)
  await idbPut('api', { key, ...entry })
}

/** نسخة محفوظة (أو null) من غير أي طلب شبكة. */
export async function peekCache(key) {
  const entry = await readEntry(key)
  return entry ? entry.data : null
}

/** بيحفظ نسخة يدويًا (بيستخدمها مزامنة الأوفلاين عشان تملا مفاتيح مشتقة). */
export async function writeCache(key, data) {
  await writeEntry(key, data)
}

/** بيحفظ مجموعة نسخ مرة واحدة: [[key, data], ...] — للمزامنة الكبيرة. */
export async function writeCacheMany(entries) {
  const savedAt = Date.now()
  for (const [key, data] of entries) memory.set(key, { data, savedAt })
  await idbPutMany(
    'api',
    entries.map(([key, data]) => ({ key, data, savedAt }))
  )
}

/** وقت آخر حفظ لمفتاح (ms) أو null. */
export async function getCacheSavedAt(key) {
  const entry = await readEntry(key)
  return entry ? entry.savedAt : null
}

// تحديث صامت في الخلفية: بيجيب نسخة جديدة ويحفظها بدل القديمة من غير ما
// حد يستناها ومن غير ما يرمي أي خطأ لحد — لو فشلت، هتتعاد تاني المرة
// الجاية (فتح الصفحة تاني، سحب للتحديث، أو مزامنة الأوفلاين الدورية).
//
// onUpdate (اختياري): لو النسخة الجديدة مختلفة عن المحفوظة اللي اترجعت
// فورًا، بيتنادى بالنسخة الجديدة عشان الشاشة تتحدث في نفس الفتحة بدل ما
// التغيير (ترتيب أقسام/فيديوهات/شركاء...) ميظهرش غير في الفتحة اللي بعدها.
function refreshInBackground(key, fetcher, shownData, onUpdate) {
  Promise.resolve()
    .then(fetcher)
    .then(async (data) => {
      lastFailureAt = 0
      setState({ online: true, servingCache: false })
      await writeEntry(key, data)
      if (onUpdate && JSON.stringify(data) !== JSON.stringify(shownData)) onUpdate(data)
    })
    .catch(noop)
}

export async function withCache(key, fetcher, { forceNetwork = false, onUpdate } = {}) {
  const cachedPromise = readEntry(key)

  // مفيش نت (واضح من الجهاز): الكاش فورًا لو موجود
  if (isOffline()) {
    const cached = await cachedPromise
    if (cached) {
      setState({ online: false, servingCache: true })
      return cached.data
    }
    // مفيش نسخة — نجرب الشبكة برضو (navigator.onLine أحيانًا بيغلط)
  }

  const cached = await cachedPromise

  // المسار السريع: فيه نسخة محفوظة ومحدش طالب تحديث قسري — رجّعها فورًا
  // وحدّثها في الخلفية هادي، من غير ما نستنى الشبكة خالص.
  if (cached && !forceNetwork) {
    refreshInBackground(key, fetcher, cached.data, onUpdate)
    return cached.data
  }

  const network = Promise.resolve()
    .then(fetcher)
    .then(async (data) => {
      lastFailureAt = 0
      setState({ online: true, servingCache: false })
      await writeEntry(key, data)
      return data
    })
  network.catch(noop) // لو الكاش اتعرض والطلب فشل بعدها، مانعملش unhandled rejection

  if (!cached) {
    try {
      return await network
    } catch (err) {
      if (shouldFallBack(err)) lastFailureAt = Date.now()
      throw err
    }
  }

  // لسه هنا يبقى forceNetwork=true وفيه نسخة قديمة — استنى الشبكة فعليًا
  // (بمهلة قصيرة ترجع للمحفوظ لو اتأخرت)، نفس السلوك القديم بالظبط.
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), currentTimeoutMs())
  })

  try {
    const result = await Promise.race([network, timeout])
    if (result === TIMEOUT) {
      lastFailureAt = Date.now()
      setState({ servingCache: true })
      return cached.data // الطلب لسه شغال في الخلفية وهيحدّث الكاش لما يوصل
    }
    return result
  } catch (err) {
    if (!shouldFallBack(err)) throw err
    lastFailureAt = Date.now()
    setState({ servingCache: true })
    return cached.data
  } finally {
    clearTimeout(timer)
  }
}

async function deleteKeys(predicate) {
  for (const key of [...memory.keys()]) if (predicate(key)) memory.delete(key)
  for (const key of await idbKeys('api')) if (predicate(key)) await idbDelete('api', key)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LEGACY_PREFIX) && predicate(k.slice(LEGACY_PREFIX.length))) localStorage.removeItem(k)
    }
  } catch {
    /* تجاهل */
  }
}

/** للاختبارات: بيحاكي إعادة فتح التطبيق (بيفضّي نسخة الذاكرة وبيفضل IndexedDB). */
export function _resetMemoryCacheForTests() {
  memory.clear()
  lastFailureAt = 0
  state = { online: true, servingCache: false }
}

/** بتمسح كل الكاش المحفوظ (كتالوج/عروض/أوردرات). مش لازمة في التشغيل العادي. */
export async function clearApiCache() {
  memory.clear()
  await idbClear('api')
  await deleteKeys(() => true)
}

/** بتمسح بس الحاجات الخاصة بالعميل (أوردرات/محفظة…) — بتتنادي عند تسجيل الخروج. */
export async function clearCustomerCache() {
  await deleteKeys((key) => CUSTOMER_SCOPED_PREFIXES.some((p) => key === p || key.startsWith(p)))
}
