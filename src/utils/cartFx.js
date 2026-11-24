// =============================================================================
// تأثيرات السلة: "الصنف بيطير للسلة" + "السلة بتتحرك"
// -----------------------------------------------------------------------------
// مكان واحد مركزي بدل ما نعدّل كل زرار "إضافة" لوحده:
//   - CartContext بينادي notifyItemAdded() لما سطر جديد يتضاف للسلة، و
//     notifyQtyIncreased() لما كمية صنف موجود أصلًا تزيد.
//   - BottomNav بيسجّل عنصر أيقونة السلة (registerCartTarget) عشان نعرف
//     نطيّر الصنف ناحيته ونفتح غطاها.
//   - مكان الصنف اللي بيطير بنعرفه من آخر ضغطة (pointerdown) على زرار جوه كارت
//     منتج أو صفحة منتج (بنقرأ مكان صورة المنتج وقتها). لو مفيش ضغطة قريبة
//     (مثلًا الإضافة جت من المساعد الصوتي) بنفتح السلة ونحرّكها من غير طيران.
// كل ده بيتعمل بـ DOM مباشر (Web Animations) مش state في React، فمفيش
// إعادة رسم لأي شاشة ومفيش أي تأثير على سرعة الضغط.
// =============================================================================

const FLY_MS = 640
const ORIGIN_TTL_MS = 1500
const FLY_MIN_PX = 38
const FLY_MAX_PX = 60

let target = null
let lastOrigin = null

export function registerCartTarget(el) {
  target = el || null
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------- مكان البداية
function captureOrigin(e) {
  const pressed = e.target && e.target.closest ? e.target.closest('button, a, [role="button"]') : null
  if (!pressed) {
    lastOrigin = null
    return
  }
  const card = pressed.closest('.product-card')
  const img = card
    ? card.querySelector('.product-card__image')
    : pressed.closest('.pd')?.querySelector('.pd__image')
  const imgRect = img ? img.getBoundingClientRect() : null
  const hasImage = Boolean(img && imgRect && imgRect.width > 0)
  lastOrigin = {
    t: Date.now(),
    src: hasImage ? img.currentSrc || img.src : null,
    rect: hasImage ? imgRect : pressed.getBoundingClientRect(),
  }
}

if (typeof window !== 'undefined') {
  // capture=true: نقرا المكان قبل ما أي handler يغيّر الـ DOM (مثلًا زرار "+"
  // بيتبدّل بعداد الكمية أول ما الصنف يتضاف)
  window.addEventListener('pointerdown', captureOrigin, true)
  window.addEventListener('click', (e) => {
    // ضغطة كيبورد/قارئ شاشة (من غير pointerdown) — نسجّل هنا لو مفيش تسجيل حديث
    if (!lastOrigin || Date.now() - lastOrigin.t > 400) captureOrigin(e)
  }, true)
}

function takeOrigin() {
  const o = lastOrigin && Date.now() - lastOrigin.t < ORIGIN_TTL_MS ? lastOrigin : null
  lastOrigin = null
  return o
}

// ------------------------------------------------------------------ أدوات صغيرة
function pulse(cls, ms) {
  if (!target) return
  target.classList.remove(cls)
  void target.offsetWidth // يعيد تشغيل الأنيميشن لو لسه شغّال
  target.classList.add(cls)
  setTimeout(() => target && target.classList.remove(cls), ms)
}

function later(fn, ms) {
  setTimeout(() => {
    if (target) fn()
  }, ms)
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))

// الصنف نفسه بيطير: مسار منحني (bezier تربيعي) من مكان الصورة لحد فتحة السلة،
// بيصغّر وهو راكب، وبيختفي في آخر لحظة وهو "داخل" السلة.
function flyThumbnail(origin) {
  const t = target.getBoundingClientRect()
  const endX = t.left + t.width / 2
  const endY = t.top + t.height * 0.38
  const startX = origin.rect.left + origin.rect.width / 2
  const startY = origin.rect.top + origin.rect.height / 2
  const size = Math.max(FLY_MIN_PX, Math.min(FLY_MAX_PX, Math.min(origin.rect.width, origin.rect.height)))

  const el = document.createElement('div')
  el.className = 'cart-fly'
  el.setAttribute('aria-hidden', 'true')
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`
  if (origin.src) el.style.backgroundImage = `url("${origin.src.replace(/"/g, '%22')}")`
  else el.classList.add('cart-fly--plain')
  document.body.appendChild(el)

  // نقطة التحكم: فوق أعلى نقطتين شوية، فالصنف "يتقوّس" لفوق وبعدين ينزل في السلة
  const ctrlX = (startX + endX) / 2
  const ctrlY = Math.min(startY, endY) - 70
  const frames = []
  const STEPS = 16
  for (let i = 0; i <= STEPS; i += 1) {
    const raw = i / STEPS
    const p = easeInOut(raw)
    const x = (1 - p) * (1 - p) * startX + 2 * (1 - p) * p * ctrlX + p * p * endX
    const y = (1 - p) * (1 - p) * startY + 2 * (1 - p) * p * ctrlY + p * p * endY
    const scale = 1 - 0.68 * p
    frames.push({
      transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${(p * 18).toFixed(1)}deg)`,
      opacity: raw > 0.88 ? Math.max(0, 1 - (raw - 0.88) / 0.12) : 1,
      offset: raw,
    })
  }
  const anim = el.animate(frames, { duration: FLY_MS, easing: 'linear', fill: 'forwards' })
  const cleanup = () => el.remove()
  anim.onfinish = cleanup
  anim.oncancel = cleanup
  setTimeout(cleanup, FLY_MS + 400) // أمان لو onfinish ماتنفّذش
}

// ---------------------------------------------------------------- واجهة الاستخدام
/** سطر جديد اتضاف للسلة: الصنف يطير → الغطا يتفتح → الصنف يدخل → الغطا يتقفل */
export function notifyItemAdded() {
  const origin = takeOrigin()
  if (!target || reducedMotion()) return
  if (origin) {
    flyThumbnail(origin)
    later(() => target.classList.add('cart-fx-open'), FLY_MS * 0.45)
    later(() => pulse('cart-fx-gulp', 480), FLY_MS)
    later(() => target.classList.remove('cart-fx-open'), FLY_MS + 170)
  } else {
    target.classList.add('cart-fx-open')
    later(() => pulse('cart-fx-gulp', 480), 220)
    later(() => target.classList.remove('cart-fx-open'), 400)
  }
}

/** كمية صنف موجود في السلة زادت: السلة تتحرك (هزّة + نطّة) */
export function notifyQtyIncreased() {
  lastOrigin = null
  if (!target || reducedMotion()) return
  pulse('cart-fx-bump', 560)
}
