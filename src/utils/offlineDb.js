// =============================================================================
// تخزين الأوفلاين — IndexedDB بدل localStorage
// -----------------------------------------------------------------------------
// ليه؟ localStorage حدّه حوالي 5 ميجا للتطبيق كله ومتزامن (بيبطّأ الشاشة)،
// وكتالوج بالحجم ده (مئات/آلاف الأصناف + الصور) مش هيتحمّل. IndexedDB
// حدّه بالمئات من الميجا، وبيخزّن الصور (Blob) كمان.
//
// مخزنين:
//   api    → ردود الـ API   { key, data, savedAt }
//   images → الصور          { url, blob, size, savedAt }
//
// لو IndexedDB مش متاح خالص (وضع خصوصية في متصفح قديم مثلاً) بنرجع لتخزين
// في الذاكرة بس (بيشتغل طول ما التطبيق مفتوح) بدل ما نكسر حاجة.
// =============================================================================

const DB_NAME = 'elmahi_cash_offline'
const DB_VERSION = 1
const KEY_PATHS = { api: 'key', images: 'url' }

let dbPromise = null
const memoryStores = { api: new Map(), images: new Map() }

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      for (const [store, keyPath] of Object.entries(KEY_PATHS)) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run(db, store, mode, action) {
  return new Promise((resolve, reject) => {
    let result
    const tx = db.transaction(store, mode)
    const req = action(tx.objectStore(store))
    if (req) req.onsuccess = () => { result = req.result }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function idbGet(store, key) {
  const db = await openDb()
  if (!db) return memoryStores[store].get(key) ?? null
  try {
    return (await run(db, store, 'readonly', (s) => s.get(key))) ?? null
  } catch {
    return null
  }
}

export async function idbPut(store, record) {
  const db = await openDb()
  if (!db) {
    memoryStores[store].set(record[KEY_PATHS[store]], record)
    return true
  }
  try {
    await run(db, store, 'readwrite', (s) => s.put(record))
    return true
  } catch {
    return false // مساحة ممتلئة أو غيره — الكاش ميزة إضافية مش أساسية
  }
}

/** بيكتب مجموعة سجلات في معاملة واحدة (أسرع بكتير من واحد واحد). */
export async function idbPutMany(store, records) {
  if (!records.length) return true
  const db = await openDb()
  if (!db) {
    for (const record of records) memoryStores[store].set(record[KEY_PATHS[store]], record)
    return true
  }
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      const os = tx.objectStore(store)
      for (const record of records) os.put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

export async function idbDelete(store, key) {
  const db = await openDb()
  if (!db) return void memoryStores[store].delete(key)
  try {
    await run(db, store, 'readwrite', (s) => s.delete(key))
  } catch {
    /* تجاهل */
  }
}

export async function idbClear(store) {
  const db = await openDb()
  if (!db) return void memoryStores[store].clear()
  try {
    await run(db, store, 'readwrite', (s) => s.clear())
  } catch {
    /* تجاهل */
  }
}

export async function idbGetAll(store) {
  const db = await openDb()
  if (!db) return [...memoryStores[store].values()]
  try {
    return (await run(db, store, 'readonly', (s) => s.getAll())) || []
  } catch {
    return []
  }
}

export async function idbKeys(store) {
  const db = await openDb()
  if (!db) return [...memoryStores[store].keys()]
  try {
    return (await run(db, store, 'readonly', (s) => s.getAllKeys())) || []
  } catch {
    return []
  }
}
