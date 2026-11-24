// =============================================================================
// طبقة الاتصال بالـ API
// -----------------------------------------------------------------------------
// الوضع الحالي: MOCK — بيرجع بيانات محلية من src/data/mockData.js عشان تقدر
// تشغل وتجرب التطبيق فورًا من غير سيرفر.
//
// لما تجهز الـ API الحقيقي (فولدر elmahi-cash-api اللي بيقرا من قاعدة بيانات
// elmahi-sales):
//   1) خلي VITE_USE_MOCK=false في ملف .env
//   2) حط رابط الـ API في VITE_API_BASE_URL
//      (مثال: https://maahy.abis-hypermarket.com/cash-api)
//
// أسماء المسارات تحت مطابقة بالظبط لأسماء ملفات PHP في elmahi-cash-api —
// لو غيّرت اسم ملف هناك، غيّره هنا كمان.
//
// العمل أوفلاين + السرعة: كل نداءات القراءة (كتالوج/عروض/أوردرات) متلفوفة
// بـ withCache (utils/apiCache.js). لو فيه نسخة محفوظة من قبل، بترجع فورًا
// من غير ما تستنى الشبكة خالص (التطبيق يفتح سريع من المرة التانية)، وبتتحدّث
// في الخلفية هادي من غير أي حاجة يدوية — التحديث بيبان في المرة الجاية اللي
// نفس الشاشة تتفتح فيها، مش فجأة وهي قدامك. لسه فيه مزامنة كاملة دورية كل 6
// ساعات (utils/offlineSync.js عن طريق hooks/useAutoOfflineSync.js) بتجبر
// تحديث فعلي من السيرفر للكتالوج والصور كلها، وكمان "اسحب للتحديث" في
// الرئيسية — الاتنين دول بيمرروا { forceNetwork: true } عشان يستنوا نتيجة
// فعلية من السيرفر بدل ما يكتفوا بالمحفوظ. لو مفيش نت خالص، بيرجع آخر نسخة
// متخزنة بدل ما الشاشة تفضل فاضية. عمليات زي تسجيل الدخول أو إنشاء أوردر
// لسه محتاجة نت فعلي ومش متلفوفة بالكاش.
// =============================================================================

import {
  CATEGORIES,
  PRODUCTS,
  PROMOS,
  DEALS,
  WELCOME_POPUPS,
  APP_SETTINGS,
  GRID_PROMOS,
  HOME_VIDEOS,
  PARTNERS,
  CUSTOM_SECTIONS,
  WALLET_MOCK,
  POINTS_MOCK,
  COMPETITION_MOCK,
  REGIONS_MOCK,
  MOCK_ADDRESS_STORE,
  findProductsByCategory,
  findProduct,
  searchProducts,
  findNewArrivals,
  findRecommended,
  findBestSellers,
} from '../data/mockData'

import { withCache, clearApiCache, clearCustomerCache } from '../utils/apiCache'
import {
  findOfflineProduct,
  searchOfflineCatalog,
  productsForCategoryOffline,
  sectionProductsOffline,
} from '../utils/offlineCatalog'
import { PRODUCT_ALIASES as MOCK_PRODUCT_ALIASES } from '../data/productAliases'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
// بتتستخدم في مزامنة الأوفلاين (utils/offlineSync.js): في وضع الـ mock مفيش سيرفر
// نزامن منه
export const IS_MOCK_MODE = USE_MOCK
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://REPLACE_ME.example.com/cash-api'

const TOKEN_KEY = 'elmahi_cash_customer_token'
const CUSTOMER_KEY = 'elmahi_cash_customer_profile'

function mockDelay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredCustomer() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null')
  } catch {
    return null
  }
}

function setStoredCustomer(customer) {
  if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer))
  else localStorage.removeItem(CUSTOMER_KEY)
}

function buildAuthHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const hadToken = Boolean(getToken())

  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? buildAuthHeaders() : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // مفيش اتصال (طيارة، واي فاي من غير نت، السيرفر مش واصل ليه). status = 0
    // بيميّز الحالة دي عن أخطاء السيرفر — الكاش (utils/apiCache.js) بيعتمد عليه،
    // والشاشات بتعرض الرسالة دي بدل "Failed to fetch" الخام.
    throw new ApiError('مفيش اتصال بالنت — اتأكد من الاتصال وحاول تاني', 0, { offline: true })
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const baseMessage = errBody.message || 'حصل خطأ، حاول تاني'
    // لو APP_DEBUG شغالة في config.php، السيرفر بيبعت تفاصيل إضافية —
    // نلزّقها في نفس رسالة الخطأ عشان تبان في الـ Console على طول من
    // غير ما تحتاج تفتح تاب Network.
    const fullMessage = errBody.debug ? `${baseMessage} — ${errBody.debug}` : baseMessage

    // لو كان فيه توكن اتبعت فعلاً والسيرفر رفضه بـ 401، يبقى التوكن ده بايظ
    // (منتهي، أو فاضل من جلسة mock قديمة) — امسحه عشان الشاشات اللي بتتحقق
    // من isAuthenticated() تعرف ترجّع المستخدم لتسجيل الدخول بدل ما تفضل
    // تحاول بتوكن ميت كل مرة.
    if (res.status === 401 && auth && hadToken) {
      setToken(null)
      setStoredCustomer(null)
    }

    throw new ApiError(fullMessage, res.status, errBody)
  }

  return res.json()
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.status = status
    this.data = data
  }
}

// -----------------------------------------------------------------------------
// المصادقة
// - requestOtp + verifyOtp: تسجيل عميل جديد بس (OTP بيثبت رقم الموبايل، وبتحدد
//   باسورد وقتها)
// - login: دخول عميل مسجل قبل كده، برقم الموبايل والباسورد بدون OTP
// -----------------------------------------------------------------------------

export async function requestOtp(phone) {
  if (USE_MOCK) {
    await mockDelay()
    if (!/^01[0-2,5]\d{8}$/.test(phone)) {
      throw new ApiError('رقم الموبايل مش صحيح', 422)
    }
    return { sent: true }
  }
  return request('/request-otp.php', { method: 'POST', body: { phone }, auth: false })
}

// coords اختياري: { latitude, longitude } من getCurrentCoords() — إحداثيات
// موقع العميل وقت التسجيل، بنفس فكرة رفع الموقع في elmahi-sales.
// regionId اختياري: id المنطقة اللي العميل اختارها من قايمة fetchRegions().
export async function fetchRegions() {
  if (USE_MOCK) {
    await mockDelay(150)
    return REGIONS_MOCK
  }
  return request('/regions.php', { auth: false })
}

export async function verifyOtp(phone, code, password, name, coords, regionId) {
  if (USE_MOCK) {
    await mockDelay()
    if (code !== '1234') {
      throw new ApiError('الكود غلط، جرب تاني', 401)
    }
    if (!password || password.length < 6) {
      throw new ApiError('الباسورد لازم يكون 6 حروف/أرقام على الأقل', 422)
    }
    const customer = { id: 'c_demo', name: name || 'عميل الماحي', phone, balancePoints: 0 }
    setToken('mock-token-' + phone)
    setStoredCustomer(customer)
    return { token: 'mock-token-' + phone, customer }
  }
  const data = await request('/verify-otp.php', {
    method: 'POST',
    body: {
      phone,
      code,
      password,
      name,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      regionId: regionId || null,
    },
    auth: false,
  })
  setToken(data.token)
  setStoredCustomer(data.customer)
  return data
}

export async function login(phone, password) {
  if (USE_MOCK) {
    await mockDelay()
    if (!password || password.length < 6) {
      throw new ApiError('رقم الموبايل أو الباسورد غلط', 401)
    }
    const customer = { id: 'c_demo', name: 'عميل الماحي', phone, balancePoints: 0 }
    setToken('mock-token-' + phone)
    setStoredCustomer(customer)
    return { token: 'mock-token-' + phone, customer }
  }
  const data = await request('/login.php', { method: 'POST', body: { phone, password }, auth: false })
  setToken(data.token)
  setStoredCustomer(data.customer)
  return data
}

export function logout() {
  setToken(null)
  setStoredCustomer(null)
  // أوردرات/محفظة العميل اللي خرج مايفضلوش في الكاش — عميل تاني ممكن يسجل دخول
  // على نفس الجهاز (خصوصًا لأن الأوفلاين بيعرض المحفوظ من غير ما يسأل السيرفر)
  clearCustomerCache().catch(() => {})
}

export function isAuthenticated() {
  return Boolean(getToken())
}

// -----------------------------------------------------------------------------
// الكتالوج
// -----------------------------------------------------------------------------

// بيجرب الطلب العادي (اللي فيه الكاش)، ولو فشل بسبب مفيش اتصال/سيرفر واقع
// ومفيش نسخة محفوظة للمفتاح ده، بيدور في الكتالوج المحلي الكامل
// (utils/offlineCatalog.js) قبل ما يرمي الخطأ. أخطاء السيرفر المنطقية
// (404/422/401) بتتعرض زي ما هي.
async function withOfflineFallback(primary, offlineLookup) {
  try {
    return await primary()
  } catch (err) {
    const status = err && typeof err.status === 'number' ? err.status : null
    if (status !== null && status !== 0 && status < 500) throw err
    const local = await offlineLookup()
    if (local !== null && local !== undefined) return local
    throw err
  }
}

// opts.forceNetwork = true بتجبر طلب شبكة حقيقي يتستنى (بدل الرجوع
// الفوري من الكاش) — شوف utils/apiCache.js. بتتستخدم من "اسحب للتحديث"
// في الرئيسية ومن مزامنة الأوفلاين (utils/offlineSync.js)، عشان الاتنين
// دول محتاجين يتأكدوا من نتيجة فعلية من السيرفر، مش نسخة قديمة.
export async function fetchCategories(opts) {
  if (USE_MOCK) {
    await mockDelay(250)
    return CATEGORIES
  }
  return withCache('categories', () => request('/categories.php'), opts)
}

export async function fetchPromos(opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    return PROMOS
  }
  return withCache('promos', () => request('/promos.php'), opts)
}

export async function fetchDeals(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return DEALS
  }
  return withCache('deals', () => request('/deals.php'), opts)
}

// ألقاب/جمل بديلة للمنتجات (المساعد الصوتي) — بتتدار من لوحة التحكم
// (تاب "ألقاب المنتجات")، مش ملف ثابت في الكود؛ شوف utils/voiceCommand.js
// (resolveAlias / setProductAliases) وcomponents/VoiceAssistant.jsx.
// في وضع الـ mock بترجع القائمة الافتراضية في data/productAliases.js.
export async function fetchProductAliases(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return MOCK_PRODUCT_ALIASES
  }
  return withCache('product-aliases', () => request('/product-aliases.php'), opts)
}

// ردود مخصصة للمساعد الصوتي (أسئلة عامة زي "امتى تقفلوا") — بتتدار من
// لوحة التحكم (تاب "المساعد الصوتي")؛ شوف utils/voiceCommand.js
// (resolveCustomReply / setAssistantReplies) وcomponents/VoiceAssistant.jsx.
export async function fetchAssistantReplies(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return []
  }
  return withCache('assistant-replies', () => request('/assistant-replies.php'), opts)
}

// رسائل بلسان المساعد بعتها الأدمن من لوحة التحكم للعميل ده بالذات (أو
// بث عام لكل العملاء) — شوف admin-assistant-messages-send.php على
// السيرفر. المساعد الصوتي بيتأكد منها كل مرة الشات يتفتح (مش مرة واحدة
// بس)، فمقصود عمدًا إنها مش متلفوفة بـ withCache عشان تفضل طازة كل مرة
// (شوف components/VoiceAssistant.jsx). في وضع الـ mock بترجع قائمة
// فاضية دايمًا — مفيش رسائل أدمن محاكاة هنا.
export async function fetchAssistantMessages() {
  if (USE_MOCK) {
    await mockDelay(150)
    return []
  }
  return request('/assistant-messages.php')
}

export async function fetchProductsByCategory(categoryId, opts) {
  if (USE_MOCK) {
    await mockDelay(300)
    return findProductsByCategory(categoryId)
  }
  return withOfflineFallback(
    () =>
      withCache(
        `products-by-category:${categoryId}`,
        () => request(`/products-by-category.php?category_id=${encodeURIComponent(categoryId)}`),
        opts
      ),
    () => productsForCategoryOffline(categoryId)
  )
}

export async function fetchProduct(productId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const product = findProduct(productId)
    if (!product) throw new ApiError('المنتج ده مش موجود', 404)
    return product
  }
  return withOfflineFallback(
    () => withCache(`product:${productId}`, () => request(`/product.php?id=${encodeURIComponent(productId)}`), opts),
    () => findOfflineProduct(productId)
  )
}

export async function fetchSearch(query, source = 'search', opts) {
  if (USE_MOCK) {
    await mockDelay(300)
    return searchProducts(query)
  }
  return withOfflineFallback(
    () =>
      withCache(
        `search:${source}:${query}`,
        () => request(`/search.php?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}`),
        opts
      ),
    () => searchOfflineCatalog(query)
  )
}

// كل المنتجات النشطة في رد واحد — بتتحمّل في الخلفية عشان الكتالوج كله يشتغل
// أوفلاين (utils/offlineSync.js). لو السيرفر مارفعش catalog-snapshot.php لسه،
// المزامنة بترجع تلقائيًا لتحميل قوائم الأقسام واحدة واحدة.
export async function fetchCatalogSnapshot(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return []
  }
  return withCache('catalog-snapshot', () => request('/catalog-snapshot.php'), opts)
}

export async function fetchNewArrivals(opts) {
  if (USE_MOCK) {
    await mockDelay(300)
    return findNewArrivals()
  }
  return withCache('new-arrivals', () => request('/new-arrivals.php'), opts)
}

// الأكثر مبيعًا — تلقائي من أوردرات التطبيق (best-sellers.php). الرف في الرئيسية
// بيعرض أول 20.
export async function fetchBestSellers(opts) {
  if (USE_MOCK) {
    await mockDelay(300)
    return findBestSellers()
  }
  return withCache('best-sellers', () => request('/best-sellers.php'), opts)
}

// كل منتجات رف من رفوف الرئيسية (صفحة "المزيد"): type = 'new' | 'recommended' | 'best'.
// الرف نفسه محدود بـ 20، وهنا بنطلب ?all=1 (لحد 100). لو مفيش نت ومفيش نسخة محفوظة،
// وارد حديثًا ورشحنالك بيتجابوا من الكتالوج المحلي.
const SECTION_ENDPOINTS = {
  new: '/new-arrivals.php',
  recommended: '/recommended.php',
  best: '/best-sellers.php',
}

export async function fetchSectionProducts(type, opts) {
  if (!Object.prototype.hasOwnProperty.call(SECTION_ENDPOINTS, type)) {
    throw new ApiError('القسم ده مش موجود', 404)
  }
  if (USE_MOCK) {
    await mockDelay(300)
    return type === 'new' ? findNewArrivals() : type === 'recommended' ? findRecommended() : findBestSellers()
  }
  return withOfflineFallback(
    () => withCache(`section:${type}`, () => request(`${SECTION_ENDPOINTS[type]}?all=1`), opts),
    () => sectionProductsOffline(type)
  )
}

export async function fetchRecommended(opts) {
  if (USE_MOCK) {
    await mockDelay(300)
    return findRecommended()
  }
  return withCache('recommended', () => request('/recommended.php'), opts)
}

// بترجّع كل البوب أبات النشطة كمصفوفة (مش بوب أب واحد) — الفرونت إند
// (WelcomePopup.jsx) هو اللي بيعرضهم واحد ورا التاني للعميل.
export async function fetchWelcomePopup(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return WELCOME_POPUPS
  }
  return withCache('welcome-popup', () => request('/welcome-popup.php'), opts)
}

// -----------------------------------------------------------------------------
// إعدادات عامة (مثال: سرعة أوتوبلاي السلايدرات) — قابلة للتحكم من لوحة التحكم
// -----------------------------------------------------------------------------

export async function fetchSettings(opts) {
  if (USE_MOCK) {
    await mockDelay(100)
    return APP_SETTINGS
  }
  return withCache('settings', () => request('/settings.php', { auth: false }), opts)
}

// -----------------------------------------------------------------------------
// كروت عروض بحجم كارت المنتج، بتتحط كقسم مستقل بين أقسام الصفحة —
// page: 'home' | 'category' (categoryId مطلوب وقتها). بترجّع كل الكروت
// النشطة للصفحة دي مرة واحدة، كل واحد فيهم عنده anchor بيحدد مكانه.
// -----------------------------------------------------------------------------

export async function fetchGridPromos(page, categoryId, opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return GRID_PROMOS.filter((p) => p.page === page && (page !== 'category' || p.categoryId === categoryId))
  }
  const qs = page === 'category' ? `?page=${page}&category_id=${encodeURIComponent(categoryId)}` : `?page=${page}`
  return withCache(`grid-promos:${page}:${categoryId || ''}`, () => request('/grid-promos.php' + qs), opts)
}

// بترجّع المنتجات اللي كارت عرض معين (لينك نوعه 'products') بيفتحهم
// لما يتضغط عليه.
export async function fetchGridPromoProducts(promoId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const promo = GRID_PROMOS.find((p) => p.id === promoId)
    if (!promo || promo.linkType !== 'products') {
      throw new ApiError('الكارت ده مش بيفتح مجموعة منتجات', 404)
    }
    return {
      title: promo.title,
      products: promo.linkProductIds.map(findProduct).filter(Boolean),
    }
  }
  return withCache(
    `grid-promo-products:${promoId}`,
    () => request('/grid-promo-products.php?id=' + encodeURIComponent(promoId)),
    opts
  )
}

// بترجّع المنتجات اللي شريحة سلايدر معينة (linkType: 'products') بتفتحهم
// لما تتضغط — نفس شكل fetchGridPromoProducts بالظبط.
export async function fetchPromoProducts(promoId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const promo = PROMOS.find((p) => p.id === promoId)
    if (!promo || promo.linkType !== 'products') {
      throw new ApiError('الشريحة دي مش بتفتح مجموعة منتجات', 404)
    }
    return {
      title: promo.title,
      products: (promo.linkProductIds || []).map(findProduct).filter(Boolean),
    }
  }
  return withCache(
    `promo-products:${promoId}`,
    () => request('/promo-products.php?id=' + encodeURIComponent(promoId)),
    opts
  )
}

// -----------------------------------------------------------------------------
// فيديو (أو أكتر) في الصفحة الرئيسية، بلينك بس (يوتيوب/فيميو/لينك مباشر)
// — كل واحد عنده anchor بيحدد مكانه، بالظبط زي كروت عروض الشبكة. مفيش
// تشغيل تلقائي أبدًا (شوف utils/video.js وHomeVideoSection.jsx).
// -----------------------------------------------------------------------------

export async function fetchHomeVideos(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return HOME_VIDEOS
  }
  return withCache('home-videos', () => request('/home-videos.php'), opts)
}

// -----------------------------------------------------------------------------
// "شركاء النجاح" — قسم في الرئيسية بيعرض شعارات الشركات (الموردين/العلامات
// التجارية) النشطة، وفتح شركة بيعرض بس المنتجات المربوطة بيها.
// -----------------------------------------------------------------------------

export async function fetchPartners(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return PARTNERS.map((p) => ({ id: p.id, name: p.name, image: p.image }))
  }
  return withCache('partners', () => request('/partners.php'), opts)
}

export async function fetchPartnerProducts(partnerId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const partner = PARTNERS.find((p) => p.id === partnerId)
    if (!partner) {
      throw new ApiError('الشريك ده مش موجود', 404)
    }
    return {
      partner: { id: partner.id, name: partner.name, image: partner.image },
      products: partner.productIds.map(findProduct).filter(Boolean),
    }
  }
  return withCache(
    `partner-products:${partnerId}`,
    () => request('/partner-products.php?partner_id=' + encodeURIComponent(partnerId)),
    opts
  )
}

// -----------------------------------------------------------------------------
// أقسام مخصصة بالرئيسية — رف منتجات زي "رشحنالك" بالظبط بس الأدمن هو اللي
// بيختار عنوانه ومكانه (anchor) ومنتجاته من لوحة التحكم. بترجّع كل
// الأقسام النشطة مرة واحدة بمنتجاتها جاهزة (ready) عشان الرئيسية تعرضها
// على طول من غير طلب إضافي لكل قسم.
// -----------------------------------------------------------------------------

export async function fetchCustomSections(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    return CUSTOM_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      anchor: s.anchor,
      sortOrder: s.sortOrder,
      products: s.productIds.map(findProduct).filter(Boolean),
    }))
  }
  return withCache('custom-sections', () => request('/custom-sections.php'), opts)
}

// بترجّع كل منتجات قسم مخصص معين (لصفحة "المزيد" بتاعته) — نفس شكل
// fetchPartnerProducts بالظبط.
export async function fetchCustomSectionProducts(sectionId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const section = CUSTOM_SECTIONS.find((s) => s.id === sectionId)
    if (!section) {
      throw new ApiError('القسم ده مش موجود', 404)
    }
    return {
      title: section.title,
      products: section.productIds.map(findProduct).filter(Boolean),
    }
  }
  return withCache(
    `custom-section-products:${sectionId}`,
    () => request('/custom-section-products.php?id=' + encodeURIComponent(sectionId)),
    opts
  )
}

// -----------------------------------------------------------------------------
// الأوردرات
// -----------------------------------------------------------------------------

export async function submitOrder(order) {
  if (USE_MOCK) {
    await mockDelay(600)

    // لو العميل طلب الدفع من المحفظة، بنحاكي نفس منطق السيرفر بالظبط:
    // المبلغ الفعلي = أقل حاجة بين رصيده الحالي وإجمالي الأوردر، والباقي
    // (لو فيه) بيتحول لدفع كاش عند الاستلام.
    let walletApplied = 0
    if (order.useWallet) {
      const { balance } = getMockWalletState()
      walletApplied = Math.round(Math.min(balance, order.total) * 100) / 100
    }
    const cashDue = Math.round((order.total - walletApplied) * 100) / 100
    const paymentMethod = walletApplied <= 0 ? 'cash' : (cashDue <= 0.001 ? 'wallet' : 'mixed')

    const saved = {
      id: 'ord_' + Date.now(),
      status: 'قيد المراجعة',
      createdAt: new Date().toISOString(),
      ...order,
      walletAmount: walletApplied,
      cashDue,
      paymentMethod,
    }
    const existing = JSON.parse(localStorage.getItem('elmahi_cash_orders') || '[]')
    existing.unshift(saved)
    localStorage.setItem('elmahi_cash_orders', JSON.stringify(existing))

    if (walletApplied > 0) {
      const { balance, transactions } = getMockWalletState()
      const newBalance = Math.round((balance - walletApplied) * 100) / 100
      const newTx = {
        id: 'wtx_' + Date.now(),
        amount: -walletApplied,
        type: 'order_payment',
        note: null,
        orderId: saved.id,
        balanceAfter: newBalance,
        createdAt: new Date().toISOString(),
      }
      setMockWalletState(newBalance, [newTx, ...transactions])
    }

    return saved
  }
  return request('/orders-create.php', { method: 'POST', body: order })
}

export async function fetchOrders(opts) {
  if (USE_MOCK) {
    await mockDelay(250)
    return JSON.parse(localStorage.getItem('elmahi_cash_orders') || '[]')
  }
  return withCache('orders-list', () => request('/orders-list.php'), opts)
}

export async function fetchOrder(orderId, opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const orders = JSON.parse(localStorage.getItem('elmahi_cash_orders') || '[]')
    const order = orders.find((o) => o.id === orderId)
    if (!order) throw new ApiError('الطلب ده مش موجود', 404)
    return order
  }
  return withCache(`order:${orderId}`, () => request(`/order-detail.php?id=${encodeURIComponent(orderId)}`), opts)
}

// إلغاء طلب لسه متسلّمش — السبب إجباري (السيرفر بيرفض لو فاضي). بيرجّع
// الأصناف للمخزون وفلوس المحفظة (لو اتدفع منها) تلقائيًا. مش متلفوف بكاش
// لأنه عملية تعديل.
export async function cancelOrder(orderId, reason) {
  const trimmed = String(reason || '').trim()
  if (trimmed.length < 3) throw new ApiError('لازم تكتب سبب الإلغاء', 422)
  if (USE_MOCK) {
    await mockDelay(300)
    const orders = JSON.parse(localStorage.getItem('elmahi_cash_orders') || '[]')
    const order = orders.find((o) => o.id === orderId)
    if (!order) throw new ApiError('الطلب ده مش موجود', 404)
    if (['اتسلم', 'ملغي', 'مرتجع بالكامل'].includes(order.status)) {
      throw new ApiError('مينفعش تلغي الطلب ده في حالته الحالية', 422)
    }
    order.status = 'ملغي'
    order.cancelReason = trimmed
    localStorage.setItem('elmahi_cash_orders', JSON.stringify(orders))
    return { id: orderId, status: 'ملغي', cancelReason: trimmed }
  }
  // القراءات network-first (utils/apiCache.js)، فنسخة الطلب بعد الإلغاء
  // بتتجاب طازة من السيرفر مش من الكاش
  return request('/order-cancel.php', {
    method: 'POST',
    body: { id: orderId, reason: trimmed },
  })
}

// بيمسح كل نسخ الكتالوج/العروض/الأوردرات المتخزنة محليًا للعمل أوفلاين
// (شوف utils/apiCache.js) — مش لازم يتستخدم في التشغيل العادي، الكاش
// بيتحدث لوحده أول ما يكون فيه نت. متاحة هنا لو حابب تضيف زرار "تفريغ
// الكاش" في صفحة البروفايل مستقبلًا.
export { clearApiCache }

// -----------------------------------------------------------------------------
// "أخبرني لما يتوفر" — العميل بيسجل رغبته في وحدة نافدة، وبيتبعتله إشعار
// Push حقيقي (مش SMS) لما تتوفر تاني (شوف stock-notify-check.php على
// السيرفر). في وضع MOCK بنحاكي التسجيل والقائمة بس محليًا — مفيش سيرفر
// حقيقي هنا يرجّع الصنف متاح تاني تلقائيًا.
// -----------------------------------------------------------------------------

const STOCK_NOTIFY_KEY = 'elmahi_cash_stock_notify_requests'

export async function requestStockNotify({ unitId, productName, unitLabel }) {
  if (USE_MOCK) {
    await mockDelay(200)
    const existing = JSON.parse(localStorage.getItem(STOCK_NOTIFY_KEY) || '[]')
    if (!existing.some((r) => r.unitId === unitId)) {
      existing.push({ unitId, productName, unitLabel, requestedAt: new Date().toISOString() })
      localStorage.setItem(STOCK_NOTIFY_KEY, JSON.stringify(existing))
    }
    return { requested: true }
  }
  return request('/stock-notify-request.php', { method: 'POST', body: { unitId, productName, unitLabel } })
}

export async function fetchMyStockNotifyRequests(opts) {
  if (USE_MOCK) {
    await mockDelay(150)
    const existing = JSON.parse(localStorage.getItem(STOCK_NOTIFY_KEY) || '[]')
    return existing.map((r) => r.unitId)
  }
  return withCache('stock-notify-my-requests', () => request('/stock-notify-my-requests.php'), opts)
}

// -----------------------------------------------------------------------------
// عناويني — عناوين توصيل محفوظة (المنزل/الشغل...)، تظهر في بروفايل
// العميل وفي الشيك آوت كاختيار سريع بدل كتابة العنوان من الصفر كل مرة
// -----------------------------------------------------------------------------

// نسخة من سلة العميل بتتبعت للسيرفر (للعرض في لوحة التحكم بس — تاب
// "العملاء" → "السلة"). السلة الأصلية لسه على الموبايل. مفيش حاجة
// بتحصل في وضع الديمو (mock).
export async function syncCart(lines) {
  if (USE_MOCK) return { synced: true }
  return request('/cart-sync.php', { method: 'POST', body: { items: lines } })
}

// المنتج اتفتح من نتايج البحث — بيتسجل عشان رسالة المساعد التلقائية
// "شوفت المنتج ومضفتوش للسلة" (لو الأدمن مشغّلها). مفيش حاجة في الديمو.
export async function trackProductView({ productRef, name }) {
  if (USE_MOCK) return { tracked: false }
  return request('/product-view-track.php', { method: 'POST', body: { productRef, name } })
}

// رسايل شات المساعد الجديدة بتتبعت للسيرفر عشان تظهر في لوحة التحكم (7
// أيام بس). مفيش حاجة في الديمو.
export async function logAssistantChat(messages) {
  if (USE_MOCK) return { saved: 0 }
  return request('/assistant-chat-log.php', { method: 'POST', body: { messages } })
}

// تقييم الخدمة بعد تسليم الطلب — المساعد الرقمي بيطلبه بعد ما الأدمن
// يحوّل حالة الطلب لـ "اتسلم". مفيش حاجة في وضع الديمو.
export async function fetchPendingRating() {
  if (USE_MOCK) return null
  return request('/order-rating-pending.php')
}

export async function submitOrderRating({ orderId, stars, comment }) {
  if (USE_MOCK) return { saved: true }
  return request('/order-rating-submit.php', { method: 'POST', body: { orderId, stars, comment } })
}

export async function dismissOrderRating(orderId) {
  if (USE_MOCK) return { dismissed: true }
  return request('/order-rating-dismiss.php', { method: 'POST', body: { orderId } })
}

// تقييم عام للتطبيق (مش لطلب بعينه) — بيظهر بعد 15 يوم من أول استخدام
// ويتكرر كل 15 يوم لو العميل أجّله (شوف utils/appRatingPrompt.js
// وcomponents/AppRatingModal.jsx). التوقيت والتكرار محسوبين بالكامل على
// الجهاز (localStorage)؛ الكول ده بس بيسجل التقييم نفسه في لوحة التحكم.
// مفيش حاجة في وضع الديمو.
export async function submitAppRating({ stars, comment }) {
  if (USE_MOCK) return { saved: true }
  return request('/app-rating-submit.php', { method: 'POST', body: { stars, comment } })
}

export async function fetchAddress() {
  if (USE_MOCK) {
    await mockDelay(150)
    return MOCK_ADDRESS_STORE.value
  }
  return request('/addresses-list.php')
}

export async function saveAddress({ addressText, phone, latitude, longitude }) {
  if (USE_MOCK) {
    await mockDelay(200)
    MOCK_ADDRESS_STORE.value = {
      id: MOCK_ADDRESS_STORE.value?.id || Date.now(),
      addressText,
      phone,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      createdAt: new Date().toISOString(),
    }
    return { id: MOCK_ADDRESS_STORE.value.id, saved: true }
  }
  return request('/addresses-save.php', { method: 'POST', body: { addressText, phone, latitude, longitude } })
}

export async function deleteAddress() {
  if (USE_MOCK) {
    await mockDelay(150)
    MOCK_ADDRESS_STORE.value = null
    return { deleted: true }
  }
  return request('/addresses-delete.php', { method: 'POST', body: {} })
}

// -----------------------------------------------------------------------------
// توكن إشعارات Push (Firebase) لجهاز العميل الحالي — بيتسجل لما العميل
// يوافق على الإشعارات، وبيتمسح وقت تسجيل الخروج. شوف utils/pushNotifications.js
// -----------------------------------------------------------------------------

export async function registerPushToken(token, platform = 'android') {
  if (USE_MOCK) {
    await mockDelay(150)
    return { registered: true }
  }
  return request('/push-token-register.php', { method: 'POST', body: { token, platform } })
}

export async function unregisterPushToken(token) {
  if (USE_MOCK) {
    await mockDelay(150)
    return { unregistered: true }
  }
  return request('/push-token-unregister.php', { method: 'POST', body: { token } })
}

// -----------------------------------------------------------------------------
// محفظة العميل — رصيد بيضيفه الأدمن من لوحة التحكم (كاش باك أو أي مبلغ
// تاني) وقابل للاستخدام فعليًا في الدفع عند الأوردر. في وضع MOCK بنحاكيها
// بالكامل محليًا بـ localStorage عشان تقدر تجرب السيناريو كامل (شحن، دفع
// جزئي/كامل، كشف الحساب) من غير سيرفر.
// -----------------------------------------------------------------------------

const WALLET_BALANCE_KEY = 'elmahi_cash_wallet_balance'
const WALLET_TX_KEY = 'elmahi_cash_wallet_transactions'

function getMockWalletState() {
  if (localStorage.getItem(WALLET_BALANCE_KEY) === null) {
    // أول استخدام: نبدأ من بيانات الديمو في mockData.js
    localStorage.setItem(WALLET_BALANCE_KEY, String(WALLET_MOCK.balance))
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(WALLET_MOCK.transactions))
  }
  return {
    balance: parseFloat(localStorage.getItem(WALLET_BALANCE_KEY)),
    transactions: JSON.parse(localStorage.getItem(WALLET_TX_KEY) || '[]'),
  }
}

function setMockWalletState(balance, transactions) {
  localStorage.setItem(WALLET_BALANCE_KEY, String(balance))
  localStorage.setItem(WALLET_TX_KEY, JSON.stringify(transactions))
}

export async function fetchWallet(opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    return getMockWalletState()
  }
  return withCache('wallet', () => request('/wallet.php'), opts)
}

// تحويل رصيد من محفظة العميل الحالي لعميل تاني برقم موبايله — شوف
// wallet-transfer.php على السيرفر (بيقفل صف رصيد المرسل أثناء العملية
// عشان يمنع سحب أكتر من الرصيد الفعلي لو حصل تحويلين متزامنين، وبيرجع
// اسم/رقم المستلم ورصيد المرسل الجديد). مستخدمة من pages/Wallet.jsx
// ومن أمر "حوّل" في المساعد الصوتي (VoiceAssistant.jsx). في وضع الـ
// mock بنخصم من رصيد المرسل المحاكى بس (مفيش عميل مستقبل حقيقي هنا)
// ونضيف سطر "تحويل صادر" في كشف الحساب المحلي.
export async function transferWallet({ phone, amount }) {
  if (USE_MOCK) {
    await mockDelay(300)
    const { balance, transactions } = getMockWalletState()
    if (!amount || amount <= 0) throw new ApiError('المبلغ لازم يكون أكبر من صفر', 422)
    if (amount > balance) throw new ApiError('رصيدك في المحفظة مش كفاية', 422)

    const newBalance = balance - amount
    const entry = {
      id: 'tx_' + Date.now(),
      amount: -amount,
      type: 'transfer_out',
      note: `تحويل لـ ${phone}`,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    }
    setMockWalletState(newBalance, [entry, ...transactions])
    return { transferred: true, amount, recipientName: null, recipientPhone: phone, newBalance }
  }
  return request('/wallet-transfer.php', { method: 'POST', body: { phone, amount } })
}

// -----------------------------------------------------------------------------
// شحن المحفظة يدويًا (محافظ إلكترونية / إنستاباي) — العميل بيرفع صورة
// إيصال التحويل، والأدمن بيراجعها ويضيف الرصيد بنفسه (شوف admin-wallet-
// topup-review.php). الميزة والرسالتين المعروضتين للعميل قابلتين للتحكم
// بالكامل من لوحة التحكم في أي وقت — شوف fetchSettings():
// walletTopupEnabled / walletTopupMessages.
// -----------------------------------------------------------------------------

const WALLET_TOPUPS_KEY = 'elmahi_cash_wallet_topups'

export async function submitWalletTopup({ method, claimedAmount, receiptFile }) {
  if (USE_MOCK) {
    await mockDelay(500)
    const existing = JSON.parse(localStorage.getItem(WALLET_TOPUPS_KEY) || '[]')
    const saved = {
      id: 'topup_' + Date.now(),
      method,
      claimedAmount: claimedAmount ? Number(claimedAmount) : null,
      receiptImage: URL.createObjectURL(receiptFile),
      status: 'pending',
      adminNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    }
    existing.unshift(saved)
    localStorage.setItem(WALLET_TOPUPS_KEY, JSON.stringify(existing))
    return saved
  }

  // الرفع محتاج multipart/form-data (مش JSON زي باقي الـ request())، فبنبني
  // الطلب هنا مباشرة بنفس منطق المصادقة وتفسير الأخطاء المستخدم هناك
  const formData = new FormData()
  formData.append('method', method)
  if (claimedAmount) formData.append('claimedAmount', claimedAmount)
  formData.append('receipt', receiptFile)

  const res = await fetch(`${API_BASE_URL}/wallet-topup-request.php`, {
    method: 'POST',
    headers: buildAuthHeaders(), // من غير Content-Type — المتصفح بيحطه صح مع الـ boundary لوحده
    body: formData,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new ApiError(errBody.message || 'حصل خطأ، حاول تاني', res.status)
  }
  return res.json()
}

export async function fetchWalletTopups(opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    return JSON.parse(localStorage.getItem(WALLET_TOPUPS_KEY) || '[]')
  }
  return withCache('wallet-topups', () => request('/wallet-topup-requests-list.php'), opts)
}

// -----------------------------------------------------------------------------
// نقاط الولاء — رصيد بيتضاف تلقائيًا لما أوردر العميل يبقى "اتسلم" (مش
// وقت تسجيل الطلب)، وقابل للاستبدال بشحن في المحفظة على القيمة النقدية
// اللي الأدمن بيحددها من لوحة التحكم. نفس فكرة محفظة العميل فوق بالظبط —
// في وضع MOCK بنحاكيها محليًا بـ localStorage.
// -----------------------------------------------------------------------------

const POINTS_BALANCE_KEY = 'elmahi_cash_points_balance'
const POINTS_TX_KEY = 'elmahi_cash_points_transactions'

function getMockPointsState() {
  if (localStorage.getItem(POINTS_BALANCE_KEY) === null) {
    localStorage.setItem(POINTS_BALANCE_KEY, String(POINTS_MOCK.balance))
    localStorage.setItem(POINTS_TX_KEY, JSON.stringify(POINTS_MOCK.transactions))
  }
  return {
    balance: parseInt(localStorage.getItem(POINTS_BALANCE_KEY), 10) || 0,
    transactions: JSON.parse(localStorage.getItem(POINTS_TX_KEY) || '[]'),
  }
}

function setMockPointsState(balance, transactions) {
  localStorage.setItem(POINTS_BALANCE_KEY, String(balance))
  localStorage.setItem(POINTS_TX_KEY, JSON.stringify(transactions))
}

export async function fetchPoints(opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    const { balance, transactions } = getMockPointsState()
    return { balance, transactions, settings: APP_SETTINGS.points }
  }
  return withCache('points', () => request('/points.php'), opts)
}

// بتستبدل عدد نقطة معين بشحن في المحفظة، على القيمة النقدية الحالية
// (points.settings.redeemValue). مستخدمة من pages/Points.jsx ("نقاطي").
export async function redeemPoints(points) {
  if (USE_MOCK) {
    await mockDelay(300)
    const { balance, transactions } = getMockPointsState()
    const redeemValue = APP_SETTINGS.points?.redeemValue ?? 0.05
    if (!points || points <= 0) throw new ApiError('عدد النقاط غير صحيح', 422)
    if (points > balance) throw new ApiError(`رصيد نقاطك مش كفاية — رصيدك دلوقتي ${balance} نقطة`, 422, { code: 'points_insufficient', balance })

    const cashValue = Math.round(points * redeemValue * 100) / 100
    const newPointsBalance = balance - points
    const entry = {
      id: 'ptx_' + Date.now(),
      points: -points,
      type: 'redeem',
      note: 'استبدال بشحن محفظة',
      orderId: null,
      balanceAfter: newPointsBalance,
      createdAt: new Date().toISOString(),
    }
    setMockPointsState(newPointsBalance, [entry, ...transactions])

    // شحن المحفظة المحاكاة كمان (نفس تأثير points-redeem.php الحقيقي) —
    // شوف getMockWalletState فوق
    const { balance: walletBalance, transactions: walletTransactions } = getMockWalletState()
    const newWalletBalance = walletBalance + cashValue
    const walletEntry = {
      id: 'wtx_' + Date.now(),
      amount: cashValue,
      type: 'points_redeem',
      note: `شحن محفظة باستبدال ${points} نقطة`,
      balanceAfter: newWalletBalance,
      createdAt: new Date().toISOString(),
    }
    setMockWalletState(newWalletBalance, [walletEntry, ...walletTransactions])

    return { pointsRedeemed: points, cashValue, newPointsBalance, newWalletBalance }
  }
  return request('/points-redeem.php', { method: 'POST', body: { points } })
}

// -----------------------------------------------------------------------------
// نظام المسابقات — مسابقة واحدة بس تقدر تكون فعّالة في كل وقت. تقدم العميل
// فيها = إجمالي قيمة (بالجنيه) كل فواتيره اللي وصلت "اتسلم"، بيُحسب بأثر
// رجعي من كل تاريخه (مش بس من تاريخ تفعيل المسابقة). كل ما يوصل لدرجة من
// الدرجات، مبلغها بيتضاف لمحفظته أوتوماتيك من السيرفر — الصفحة هنا للعرض بس.
// في وضع MOCK بترجع نسخة ثابتة من data/mockData.js (شوف الملحوظة هناك).
// -----------------------------------------------------------------------------

export async function fetchCompetition(opts) {
  if (USE_MOCK) {
    await mockDelay(200)
    return JSON.parse(JSON.stringify(COMPETITION_MOCK))
  }
  return withCache('competition', () => request('/competition.php'), opts)
}
