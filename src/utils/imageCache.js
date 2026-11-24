// =============================================================================
// كاش الصور للعمل بدون نت
// -----------------------------------------------------------------------------
// الصور (منتجات، أقسام، سلايدر، بوب أب) بتتحمّل من السيرفر، فبدون كاش بتختفي
// أوفلاين. هنا بنخزّن كل صورة اتحمّلت كـ Blob في IndexedDB (utils/offlineDb.js)
// ونعرضها منه (object URL) لو موجودة — شوف components/CachedImage.jsx.
//
//   cacheImage(url)        بتحمّل الصورة وتخزنها (مرة واحدة، حتى لو اتنادت
//                          بالتوازي). بتتجاهل أي صورة مش بترد CORS صح.
//   getCachedImageUrl(url) رابط محلي (blob:) للصورة لو متخزنة، وإلا null.
//   prefetchImages(urls)   تحميل مجموعة صور بعدد محدود من الطلبات المتوازية.
//
// الحد الأقصى للمساحة 150 ميجا؛ لو عدّته بنمسح الأقدم الأول.
// =============================================================================

import { idbGet, idbPut, idbDelete, idbGetAll, idbClear } from './offlineDb'

export const MAX_IMAGE_CACHE_BYTES = 150 * 1024 * 1024
const MAX_SINGLE_IMAGE_BYTES = 6 * 1024 * 1024

const objectUrls = new Map() // الرابط الأصلي → blob: URL (للذاكرة، عشان نتفادى القراءة المتكررة)
const inFlight = new Map() // الرابط الأصلي → Promise (تفادي تحميل نفس الصورة مرتين)

/** رابط محلي لو الصورة في الذاكرة بالفعل (متزامن)، وإلا undefined. */
export function peekImageUrl(url) {
  return objectUrls.get(url)
}

export async function getCachedImageUrl(url) {
  if (!url) return null
  const inMemory = objectUrls.get(url)
  if (inMemory) return inMemory

  const record = await idbGet('images', url)
  if (!record || !record.blob) return null

  const objectUrl = URL.createObjectURL(record.blob)
  objectUrls.set(url, objectUrl)
  return objectUrl
}

async function enforceBudget() {
  const all = await idbGetAll('images')
  let total = all.reduce((sum, r) => sum + (r.size || 0), 0)
  if (total <= MAX_IMAGE_CACHE_BYTES) return
  all.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
  for (const record of all) {
    if (total <= MAX_IMAGE_CACHE_BYTES * 0.9) break
    await idbDelete('images', record.url)
    const objectUrl = objectUrls.get(record.url)
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrls.delete(record.url)
    }
    total -= record.size || 0
  }
}

export function cacheImage(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:') || url.startsWith('blob:')) {
    return Promise.resolve(false)
  }
  if (inFlight.has(url)) return inFlight.get(url)

  const job = (async () => {
    if (objectUrls.has(url) || (await idbGet('images', url))) return true
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
      if (!res.ok) return false
      const blob = await res.blob()
      if (!blob.size || blob.size > MAX_SINGLE_IMAGE_BYTES) return false
      if (blob.type && !blob.type.startsWith('image/')) return false
      const stored = await idbPut('images', { url, blob, size: blob.size, savedAt: Date.now() })
      if (stored) enforceBudget().catch(() => {})
      return stored
    } catch {
      return false // مفيش نت أو السيرفر مش بيسمح بـ CORS — الصورة هتتعرض من الشبكة عادي
    }
  })().finally(() => inFlight.delete(url))

  inFlight.set(url, job)
  return job
}

/**
 * بتحمّل مجموعة صور بعدد طلبات متوازية محدود (عشان مانخنقش النت/السيرفر).
 * onProgress(done, total) بتتنادي بعد كل صورة.
 */
export async function prefetchImages(urls, { concurrency = 4, onProgress, shouldStop } = {}) {
  const unique = [...new Set((urls || []).filter(Boolean))]
  let index = 0
  let done = 0
  let cached = 0

  async function worker() {
    while (index < unique.length) {
      if (shouldStop && shouldStop()) return
      const url = unique[index++]
      if (await cacheImage(url)) cached++
      done++
      if (onProgress) onProgress(done, unique.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker))
  return { total: unique.length, cached }
}

/** للاختبارات: بيحاكي إعادة فتح التطبيق (بيفضّي ذاكرة الروابط المحلية). */
export function _resetImageMemoryForTests() {
  objectUrls.clear()
  inFlight.clear()
}

export async function getImageCacheStats() {
  const all = await idbGetAll('images')
  return { count: all.length, bytes: all.reduce((sum, r) => sum + (r.size || 0), 0) }
}

export async function clearImageCache() {
  for (const objectUrl of objectUrls.values()) URL.revokeObjectURL(objectUrl)
  objectUrls.clear()
  await idbClear('images')
}
