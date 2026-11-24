// =============================================================================
// كتالوج الأوفلاين — نسخة محلية من كل المنتجات (محفوظة بمفتاح catalog-snapshot
// في utils/apiCache.js، وبتتملا من utils/offlineSync.js). بتخلّي من غير نت:
//   - البحث يشتغل على كل المنتجات (مش بس اللي اتبحث عنها قبل كده)
//   - أي صفحة منتج تتفتح، حتى لو مااتزارتش قبل كده
//   - أي قسم يتفتح بمنتجاته
//
// منطق البحث نفس منطق search.php على السيرفر (الجملة كاملة في الاسم → الألقاب
// → كل الكلمات بأي ترتيب)، بس بتجاهل اختلاف الهمزات/التاء المربوطة/الياء.
// =============================================================================

import { peekCache, writeCache } from './apiCache'
import { normalizeArabic } from './fuzzyMatch'

export const CATALOG_KEY = 'catalog-snapshot'
const MAX_RESULTS = 30

let indexedFor = null
let byId = new Map()

/** كل المنتجات المحفوظة، أو null لو مفيش كتالوج محلي لسه. */
export async function loadCatalog() {
  const catalog = await peekCache(CATALOG_KEY)
  return Array.isArray(catalog) && catalog.length > 0 ? catalog : null
}

export async function saveCatalog(products) {
  await writeCache(CATALOG_KEY, products)
}

export async function findOfflineProduct(productId) {
  const catalog = await loadCatalog()
  if (!catalog) return null
  if (indexedFor !== catalog) {
    byId = new Map(catalog.map((p) => [String(p.id), p]))
    indexedFor = catalog
  }
  return byId.get(String(productId)) || null
}

export async function productsForCategoryOffline(categoryId) {
  const catalog = await loadCatalog()
  if (!catalog) return null
  return catalog.filter((p) => p.categoryId === categoryId)
}

/** وارد حديثًا / رشحنالك من الكتالوج المحلي (الأكثر مبيعًا مبتتحسبش أوفلاين → null). */
export async function sectionProductsOffline(type) {
  const flag = type === 'new' ? 'isNew' : type === 'recommended' ? 'recommended' : null
  if (!flag) return null
  const catalog = await loadCatalog()
  if (!catalog) return null
  const inStock = (p) => (p.units || []).reduce((sum, u) => sum + (u.stock || 0), 0) > 0
  return catalog.filter((p) => p[flag] && inStock(p)).slice(0, 100)
}

/** بيجمّع كتالوج من قوائم الأقسام (لو سيرفر المزامنة الكاملة مش متاح). */
export function buildCatalogFromLists(lists) {
  const seen = new Map()
  for (const list of lists) {
    for (const product of list || []) {
      if (product && product.id != null && !seen.has(String(product.id))) seen.set(String(product.id), product)
    }
  }
  return [...seen.values()]
}

/**
 * بحث أوفلاين. aliases = نفس شكل fetchProductAliases ([{phrases, productIds}]).
 * بترجّع مصفوفة (ممكن تبقى فاضية) أو null لو مفيش كتالوج محلي أصلًا.
 */
export async function searchOfflineCatalog(query) {
  const catalog = await loadCatalog()
  if (!catalog) return null

  const q = normalizeArabic(query)
  if (!q) return []
  const names = new Map(catalog.map((p) => [p.id, normalizeArabic(p.name)]))

  // المرحلة ١: الجملة كاملة جوه اسم الصنف
  const matched = []
  for (const p of catalog) {
    if (names.get(p.id).includes(q)) {
      matched.push(p)
      if (matched.length >= MAX_RESULTS) return matched
    }
  }
  if (matched.length > 0) return matched

  // المرحلة ٢: الألقاب المسجلة من لوحة التحكم + كل الكلمات بأي ترتيب
  const aliases = (await peekCache('product-aliases')) || []
  const aliasIds = new Set()
  for (const alias of aliases) {
    for (const phrase of alias.phrases || []) {
      const p = normalizeArabic(phrase)
      if (p && (p.includes(q) || q.includes(p))) {
        for (const id of alias.productIds || []) aliasIds.add(String(id))
        break
      }
    }
  }

  const words = q.split(' ').filter(Boolean)
  for (const p of catalog) {
    if (aliasIds.has(String(p.id))) {
      matched.push(p)
    } else if (words.length >= 2 && words.every((w) => names.get(p.id).includes(w))) {
      matched.push(p)
    }
    if (matched.length >= MAX_RESULTS) break
  }
  return matched
}
