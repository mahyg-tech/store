// =============================================================================
// منطق زرار الرجوع — بيرجّع للصفحة "اللي قبلها في ترتيب التطبيق" (الصفحة
// الأم)، مش للصفحة اللي اتزارت قبلها في تاريخ التصفح. مثلاً: من صفحة منتج
// بتفتحه من قسم → بيرجّع للقسم ده، ومن القسم → للرئيسية، ومن السلة →
// للرئيسية (حتى لو كنت جاي من البحث)، ومن إتمام الطلب → للسلة، ومن تأكيد
// الطلب → للرئيسية (مش لصفحة إتمام الطلب اللي خلصت خلاص).
//
// منطق بحت (من غير React/DOM) عشان يتختبر لوحده.
//
// أولوية تحديد الوجهة:
//   1) location.state.backTo — الصفحة اللي ضغطت فيها على الرابط فعلًا
//      (كارت منتج، شريحة سلايدر، كارت عرض…) عشان ترجع لنفس المكان.
//   2) override — وجهة بتحددها الصفحة نفسها لما الأب بيعتمد على بيانات
//      محمّلة (مثلاً: قسم فرعي أبوه القسم الرئيسي بتاعه).
//   3) الجدول الثابت (getStaticParent) تحت.
// =============================================================================

const TAB_ROOTS = ['/search', '/cart', '/orders', '/profile']
const PROFILE_CHILDREN = ['/wallet', '/addresses', '/contact', '/about']

function normalize(pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '')
  return path === '' ? '/' : path
}

/**
 * الصفحة الأم الثابتة لمسار معين، أو null لو ده جذر (الرئيسية / تسجيل
 * الدخول) — يعني مفيش "قبلها" والزرار هنا بيعمل منطق الخروج من التطبيق.
 */
export function getStaticParent(pathname) {
  const path = normalize(pathname)
  if (path === '/' || path === '/login') return null
  if (path === '/verify') return '/login'
  if (TAB_ROOTS.includes(path)) return '/'
  if (path === '/checkout') return '/cart'
  if (path.startsWith('/order-success/')) return '/'
  if (/^\/orders\/[^/]+$/.test(path)) return '/orders'
  if (path === '/wallet/topup') return '/wallet'
  if (PROFILE_CHILDREN.includes(path)) return '/profile'
  // أقسام، منتجات، صفحات منتجات العروض، وأي صفحة تانية: الرئيسية
  return '/'
}

// وجهة بتسجّلها الصفحة الحالية (شوف useBackTarget). متربوطة بالمسار عشان
// ماتتسربش لصفحة تانية لو الصفحة اتقفلت من غير ما تنضّف.
let override = null

export function setBackOverride(pathname, target) {
  override = target ? { pathname: normalize(pathname), target } : null
}

export function clearBackOverride(pathname) {
  if (override && override.pathname === normalize(pathname)) override = null
}

function isSafeTarget(target, currentPath) {
  // مسار داخلي بس: لازم يبدأ بـ "/" ومايبدأش بـ "//" (ده رابط خارجي بنفس البروتوكول)
  return (
    typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\') &&
    normalize(target.split('?')[0]) !== currentPath
  )
}

/**
 * الوجهة اللي زرار الرجوع يروحلها من الصفحة الحالية، أو null لو دي صفحة
 * جذر (الخروج من التطبيق).
 */
export function resolveBackTarget(pathname, state) {
  const current = normalize(pathname)

  const backTo = state && state.backTo
  if (isSafeTarget(backTo, current)) return backTo

  if (override && override.pathname === current && isSafeTarget(override.target, current)) {
    return override.target
  }

  return getStaticParent(current)
}
