// =============================================================================
// مزامنة الأوفلاين — بتنزّل الكتالوج والعروض وبيانات العميل ورا الكواليس عشان
// التطبيق يفتح كامل من غير نت. (withCache لوحده بيحفظ بس اللي العميل زاره؛ هنا
// بنملا الكاش بكل حاجة مقدمًا.)
//
// بتشتغل أوتوماتيك (hooks/useOfflineSync.js) أول ما العميل يفتح التطبيق وفيه نت،
// ولو آخر مزامنة عدّى عليها 6 ساعات، وكمان من زرار "حدّث دلوقتي" في الحساب.
//
// الخطوات:
//   1) بيانات الشاشات: أقسام، سلايدر، عروض، إعدادات، بوب أب، فيديوهات، كروت عروض،
//      وارد حديثًا، مقترحات، ألقاب المساعد، وبيانات العميل (أوردرات/محفظة).
//   2) الكتالوج الكامل: طلب واحد (catalog-snapshot.php) → منه بنملا قوائم كل
//      قسم وصفحة كل منتج والبحث. لو السيرفر مارفعش الملف ده لسه، بنرجع
//      لتحميل قوائم الأقسام واحدة واحدة (بنفس النتيجة، لكن المنتجات اللي مش
//      متصنفة في أي قسم مش هتتلاقي في البحث).
//   3) الصور: صور الواجهة (أقسام/سلايدر/بوب أب/عروض) + صور وارد حديثًا والمقترحة
//      دايمًا؛ وباقي صور المنتجات بس لو includeAllImages (زرار يدوي — بيستهلك باقة).
// =============================================================================

import * as api from '../api/client'
import { getConnectivity, writeCacheMany } from './apiCache'
import { buildCatalogFromLists, saveCatalog } from './offlineCatalog'
import { prefetchImages } from './imageCache'

const META_KEY = 'elmahi_cash_offline_meta'
export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000
const RECENT_ORDERS_TO_CACHE = 10

let running = null

export function getSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

function saveSyncMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...getSyncMeta(), ...meta }))
  } catch {
    /* تجاهل */
  }
}

export function shouldAutoSync(now = Date.now()) {
  if (api.IS_MOCK_MODE) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const { lastSyncAt } = getSyncMeta()
  return !lastSyncAt || now - lastSyncAt > AUTO_SYNC_INTERVAL_MS
}

export function isSyncRunning() {
  return Boolean(running)
}

/**
 * بتشغّل المزامنة. onProgress({ phase, done, total, label }).
 * بترجّع { ok, skipped?, failed: [أسماء الخطوات اللي فشلت], products, images }.
 * لو مزامنة شغالة بالفعل بترجّع نفس الـ Promise (مفيش مزامنتين بالتوازي).
 */
export function syncOfflineData({ includeAllImages = false, onProgress } = {}) {
  if (running) return running
  running = runSync({ includeAllImages, onProgress }).finally(() => {
    running = null
  })
  return running
}

async function runSync({ includeAllImages, onProgress }) {
  if (api.IS_MOCK_MODE) return { ok: true, skipped: 'mock', failed: [], products: 0, images: { total: 0, cached: 0 } }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, skipped: 'offline', failed: [], products: 0, images: { total: 0, cached: 0 } }
  }

  const report = (patch) => onProgress && onProgress(patch)
  const failed = []
  // أخطاء "مؤقتة" (مفيش اتصال / السيرفر واقع 5xx) بتخلي المزامنة غير مكتملة فتتعاد
  // قريب. أخطاء 4xx (ميزة مقفولة من الأدمن مثلًا، زي شحن المحفظة) دايمة، فمبنعطّلش
  // علامة الاكتمال بسببها — وإلا هنعيد تنزيل كل حاجة مع كل فتح للتطبيق.
  let transientFailures = 0
  async function attempt(label, fn) {
    try {
      return await fn()
    } catch (err) {
      console.warn(`offlineSync: "${label}" failed —`, err && err.message)
      failed.push(label)
      const status = err && typeof err.status === 'number' ? err.status : null
      if (status === null || status === 0 || status >= 500) transientFailures++
      return null
    }
  }

  // كل نداءات المزامنة هنا بتبعت forceNetwork:true عمدًا — الهدف من
  // المزامنة أصلاً إنها تتأكد من نسخة فعلية جديدة من السيرفر (وتحدّث
  // الكاش بيها لكل الشاشات اللي بتستخدمه)، مش إنها ترجع نسخة قديمة فورًا
  // زي السلوك الافتراضي الجديد لـ withCache (utils/apiCache.js).
  const FORCE = { forceNetwork: true }

  const imageUrls = { ui: [], newAndRecommended: [], rest: [] }
  const pushUi = (list, key = 'image') => (list || []).forEach((x) => x && x[key] && imageUrls.ui.push(x[key]))

  // ---------------------------------------------------------- 1) الشاشات
  const screenSteps = [
    ['categories', async () => {
      const cats = await api.fetchCategories(FORCE)
      pushUi(cats, 'iconImage')
      return cats
    }],
    ['promos', async () => pushUi(await api.fetchPromos(FORCE))],
    ['deals', () => api.fetchDeals(FORCE)],
    ['settings', () => api.fetchSettings(FORCE)],
    ['welcome-popup', async () => pushUi(await api.fetchWelcomePopup(FORCE))],
    ['home-videos', () => api.fetchHomeVideos(FORCE)],
    ['grid-promos', async () => pushUi(await api.fetchGridPromos('home', undefined, FORCE))],
    ['partners', async () => {
      const list = await api.fetchPartners(FORCE)
      pushUi(list)
      return list
    }],
    ['custom-sections', async () => {
      const list = await api.fetchCustomSections(FORCE)
      list.forEach((s) => pushUi(s.products))
      return list
    }],
    ['product-aliases', () => api.fetchProductAliases(FORCE)],
    ['assistant-replies', () => api.fetchAssistantReplies(FORCE)],
    ['new-arrivals', async () => (imageUrls.newAndRecommended.push(...(await api.fetchNewArrivals(FORCE)).map((p) => p.image).filter(Boolean)), null)],
    ['recommended', async () => (imageUrls.newAndRecommended.push(...(await api.fetchRecommended(FORCE)).map((p) => p.image).filter(Boolean)), null)],
    ['best-sellers', async () => (imageUrls.newAndRecommended.push(...(await api.fetchBestSellers(FORCE)).map((p) => p.image).filter(Boolean)), null)],
    // صفحات "المزيد" (كل منتجات كل رف) عشان تفتح من غير نت
    ['section:new', () => api.fetchSectionProducts('new', FORCE)],
    ['section:recommended', () => api.fetchSectionProducts('recommended', FORCE)],
    ['section:best', () => api.fetchSectionProducts('best', FORCE)],
    // بيانات العميل نفسه
    ['wallet', () => api.fetchWallet(FORCE)],
    ['wallet-topups', () => api.fetchWalletTopups(FORCE)],
    ['stock-notify', () => api.fetchMyStockNotifyRequests(FORCE)],
  ]

  let categories = []
  let partners = []
  let customSections = []
  const totalDataSteps = screenSteps.length + 5 // + أوردرات + كتالوج + أقسام (كروت العروض) + منتجات الشركاء + منتجات الأقسام المخصصة
  let doneSteps = 0
  for (const [label, fn] of screenSteps) {
    report({ phase: 'data', done: doneSteps, total: totalDataSteps, label })
    const result = await attempt(label, fn)
    if (label === 'categories' && Array.isArray(result)) categories = result
    if (label === 'partners' && Array.isArray(result)) partners = result
    if (label === 'custom-sections' && Array.isArray(result)) customSections = result
    doneSteps++
  }

  report({ phase: 'data', done: doneSteps++, total: totalDataSteps, label: 'orders' })
  await attempt('orders', async () => {
    const orders = await api.fetchOrders(FORCE)
    for (const order of (orders || []).slice(0, RECENT_ORDERS_TO_CACHE)) {
      await attempt(`order:${order.id}`, () => api.fetchOrder(String(order.id), FORCE))
    }
  })

  report({ phase: 'data', done: doneSteps++, total: totalDataSteps, label: 'category-promos' })
  for (const cat of categories) {
    await attempt(`grid-promos:${cat.id}`, async () => pushUi(await api.fetchGridPromos('category', cat.id, FORCE)))
  }

  // صفحة كل شركة ("شركاء النجاح") عشان تفتح من غير نت برضو
  report({ phase: 'data', done: doneSteps++, total: totalDataSteps, label: 'partner-products' })
  for (const partner of partners) {
    await attempt(`partner-products:${partner.id}`, () => api.fetchPartnerProducts(partner.id, FORCE))
  }

  // صفحة "المزيد" لكل قسم مخصص بالرئيسية عشان تفتح من غير نت برضو
  report({ phase: 'data', done: doneSteps++, total: totalDataSteps, label: 'custom-section-products' })
  for (const section of customSections) {
    await attempt(`custom-section-products:${section.id}`, () => api.fetchCustomSectionProducts(section.id, FORCE))
  }

  // ---------------------------------------------------------- 2) الكتالوج
  report({ phase: 'data', done: doneSteps++, total: totalDataSteps, label: 'catalog' })
  let products = []
  // مش بنعتبرها فشل لو السيرفر مارفعش catalog-snapshot.php — بنرجع لقوائم الأقسام تحت
  let snapshot = null
  try {
    snapshot = await api.fetchCatalogSnapshot(FORCE)
  } catch (err) {
    console.warn('offlineSync: catalog-snapshot unavailable, falling back to per-category lists —', err && err.message)
  }
  if (Array.isArray(snapshot) && snapshot.length > 0) {
    products = snapshot
    const entries = []
    for (const cat of categories) {
      entries.push([`products-by-category:${cat.id}`, snapshot.filter((p) => p.categoryId === cat.id)])
    }
    for (const p of snapshot) entries.push([`product:${p.id}`, p])
    await writeCacheMany(entries)
  } else {
    // السيرفر مفيهوش catalog-snapshot.php لسه (أو رجّع فاضي) — نجمّع من قوائم الأقسام
    const lists = []
    for (const cat of categories) {
      const list = await attempt(`products:${cat.id}`, () => api.fetchProductsByCategory(cat.id, FORCE))
      if (Array.isArray(list)) lists.push(list)
    }
    products = buildCatalogFromLists(lists)
    if (products.length > 0) {
      await saveCatalog(products)
      await writeCacheMany(products.map((p) => [`product:${p.id}`, p]))
    }
  }

  const priority = new Set(imageUrls.newAndRecommended)
  for (const p of products) if (p.image && !priority.has(p.image)) imageUrls.rest.push(p.image)

  // ---------------------------------------------------------- 3) الصور
  const toFetch = [...imageUrls.ui, ...imageUrls.newAndRecommended, ...(includeAllImages ? imageUrls.rest : [])]
  const images = await prefetchImages(toFetch, {
    concurrency: 4,
    onProgress: (done, total) => report({ phase: 'images', done, total, label: 'images' }),
  })

  // لو الطلبات اتخدمت من الكاش بسبب مشكلة اتصال في النص، المزامنة مش كاملة فعليًا
  const fullyOnline = !getConnectivity().servingCache
  const ok = failed.length === 0 && fullyOnline && products.length > 0
  const complete = fullyOnline && transientFailures === 0 && products.length > 0 && categories.length > 0
  if (complete) {
    saveSyncMeta({
      lastSyncAt: Date.now(),
      productCount: products.length,
      imagesCached: images.cached,
      allImages: includeAllImages || getSyncMeta().allImages || false,
    })
  }
  return { ok, failed, products: products.length, images }
}
