import * as api from '../api/client'

// =============================================================================
// صندوق رسايل المساعد (اللي الأدمن بيبعتها من لوحة التحكم "بلسان المساعد").
//
// الرسالة بتوصل العميل بطريقتين:
//   1) إشعار Push برّه التطبيق (assistant-messages-helpers.php → FCM)
//   2) الرسالة نفسها بتتجاب من assistant-messages.php أول ما التطبيق يفتح —
//      دي الأساس؛ حتى لو الإشعار ماوصلش (إذن مرفوض، جهاز من غير خدمات جوجل…)
//      المساعد بيفتح لوحده ويعرضها.
//
// الوحدة دي بتقرر "إيه الجديد اللي يتعرض" (planInbox) وبتفتكر اللي اتعرض
// (لكل عميل)، وبتوفّر قناة أحداث بسيطة (requestInboxCheck) عشان أي مكان في
// التطبيق (زي إشعار وصل والتطبيق مفتوح) يقول للمساعد "شوف في رسايل جديدة".
// =============================================================================

// المفتاح القديم (رقم واحد = "آخر id اتعرض"): لسه بنقراه للعملاء اللي شافوا رسايل
// قبل التحديث ده — أي id أقل منه أو يساويه بنعتبره اتشاف.
const LEGACY_SEEN_KEY = 'assistantMessagesLastSeenId'
// المفتاح الجديد (لكل عميل): مجموعة الـ ids اللي اتعرضت. مجموعة مش "رقم أقصى"
// لأن الرسالة المجدولة بتاخد id وقت ما الأدمن يكتبها (ممكن من أيام) لكنها بتظهر
// للعميل وقت الإرسال — فبتظهر بـ id أقل من رسايل اتشافت قبلها، ولو كنا بنقارن
// برقم أقصى عمرها ما كانت هتتعرض.
const SEEN_KEY = 'assistantMessagesSeen'
const SEEN_MAX_IDS = 100

// أقصى عدد رسايل بتتعرض في المرة الواحدة (لو العميل غاب فترة وفيه تراكم)
export const MAX_SHOWN = 5

// أول مرة على الجهاز (مفيش سجل بالمشاهدة): بنعرض بس الرسايل الحديثة. رسالة
// بث قديمة (من قبل ما العميل يسجّل أصلاً) مالهاش داعي تفتح المساعد فجأة.
export const FIRST_RUN_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

// ---------------------------------------------------------------- المشاهدة

function currentSeenKey() {
  let id = null
  try {
    id = api.getStoredCustomer?.()?.id ?? null
  } catch {
    /* تجاهل */
  }
  return id != null ? `${SEEN_KEY}:${id}` : SEEN_KEY
}

function readStored() {
  try {
    const raw = localStorage.getItem(currentSeenKey())
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      const ids = Array.isArray(parsed?.ids) ? parsed.ids.map(Number).filter(Number.isFinite) : []
      return { known: true, floor: Number(parsed?.floor) || 0, ids }
    }
    const legacy = localStorage.getItem(LEGACY_SEEN_KEY)
    if (legacy !== null) return { known: true, floor: Number(legacy) || 0, ids: [] }
  } catch {
    /* تجاهل — بنعتبره أول مرة */
  }
  return { known: false, floor: 0, ids: [] }
}

/**
 * اللي اتشاف للعميل ده: { known, floor, ids:Set }. known=false = أول مرة على
 * الجهاز (مفيش أي سجل). floor = أكبر id اتشاف قبل التحديث ده (كل اللي أقل منه
 * أو يساويه اتشاف).
 */
export function getSeenState() {
  const { known, floor, ids } = readStored()
  return { known, floor, ids: new Set(ids) }
}

/** بيسجّل إن الرسالة (أو الرسايل) دي اتعرضت. بيحتفظ بآخر SEEN_MAX_IDS بس. */
export function markSeen(idOrIds) {
  const incoming = (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).map(Number).filter(Number.isFinite)
  if (incoming.length === 0) return
  try {
    const { floor, ids } = readStored()
    const merged = [...ids.filter((id) => !incoming.includes(id)), ...incoming].slice(-SEEN_MAX_IDS)
    localStorage.setItem(currentSeenKey(), JSON.stringify({ floor, ids: merged }))
  } catch {
    /* تجاهل */
  }
}

// ---------------------------------------------------------------- الجلب

async function fallbackFetch() {
  if (USE_MOCK || !API_BASE_URL) return []
  const token = api.getToken?.()
  if (!token) return []
  const res = await fetch(`${API_BASE_URL}/assistant-messages.php`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`assistant-messages HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/**
 * بيجيب رسايل المساعد. لو client.js فيه fetchAssistantMessages بنستخدمها،
 * وإلا (نسخة client.js قديمة من غيرها) بنجيبها بنفسنا من نفس الـ endpoint —
 * عشان الميزة ماتتعطّلش بصمت بسبب دالة ناقصة.
 */
export async function fetchInbox() {
  if (typeof api.fetchAssistantMessages === 'function') {
    const list = await api.fetchAssistantMessages()
    return Array.isArray(list) ? list : []
  }
  return fallbackFetch()
}

// ---------------------------------------------------------------- التخطيط

function parseCreatedAt(value) {
  if (!value) return NaN
  // "2026-09-21 03:00:00" (شكل MySQL) → ISO عشان كل الـ WebViews تفهمه
  return Date.parse(String(value).replace(' ', 'T'))
}

// الترتيب الزمني: وقت الإرسال، وعند التساوي/الجهل بالوقت الـ id
function byTimeline(a, b) {
  if (Number.isFinite(a.createdAtMs) && Number.isFinite(b.createdAtMs) && a.createdAtMs !== b.createdAtMs) {
    return a.createdAtMs - b.createdAtMs
  }
  return a.id - b.id
}

/**
 * بيحدد إيه اللي يتعرض دلوقتي.
 *  - toShow:  الرسايل اللي تتعرض (بترتيب زمني، الأقدم الأول، بحد أقصى MAX_SHOWN)
 *  - markNow: ids الرسايل الجديدة اللي مش هتتعرض (قديمة في أول مرة، أو زيادة
 *             عن الحد الأقصى) — بتتسجّل "اتشافت" فورًا. اللي في toShow
 *             بتتسجّل واحدة واحدة بعد ما تتعرض فعلاً، فلو التطبيق اتقفل في
 *             النص، الباقي يتعرض المرة الجاية.
 * seen = نتيجة getSeenState() (أو null/undefined = أول مرة).
 */
export function planInbox(list, seen, now = Date.now()) {
  const seenIds = seen?.ids instanceof Set ? seen.ids : new Set(seen?.ids || [])
  const floor = Number(seen?.floor) || 0
  const firstRun = !seen || !seen.known

  const unseen = (Array.isArray(list) ? list : [])
    .filter((m) => m && m.id != null && String(m.message ?? '').trim() !== '')
    .map((m) => ({ id: Number(m.id), message: String(m.message), createdAtMs: parseCreatedAt(m.createdAt) }))
    .filter((m) => Number.isFinite(m.id) && m.id > floor && !seenIds.has(m.id))
    .sort(byTimeline)

  // أول مرة: الحديث بس. تاريخ مش مفهوم (NaN) بنعتبره حديث بدل ما نخفي رسالة ممكن تكون مهمة
  const candidates = firstRun
    ? unseen.filter((m) => !Number.isFinite(m.createdAtMs) || now - m.createdAtMs <= FIRST_RUN_MAX_AGE_MS)
    : unseen

  const toShow = candidates.slice(-MAX_SHOWN)
  const shown = new Set(toShow.map((m) => m.id))
  const markNow = unseen.filter((m) => !shown.has(m.id)).map((m) => m.id)
  return { toShow, markNow }
}

// ---------------------------------------------------------------- الأحداث

const listeners = new Set()

/** أي مكان بيقول للمساعد "فيه رسالة جديدة، شوفها" (زي وصول إشعار مساعد). */
export function requestInboxCheck(reason = 'manual') {
  for (const cb of [...listeners]) {
    try {
      cb(reason)
    } catch {
      /* تجاهل */
    }
  }
}

/** المساعد بيشترك هنا. بيرجّع دالة إلغاء الاشتراك. */
export function onInboxCheckRequested(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
