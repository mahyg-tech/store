// آخر 5 حاجات دور عليهم العميل في خانة البحث — محفوظين على الجهاز بس
// (localStorage)، مش على السيرفر. الأحدث أول واحد، ومفيش تكرار (لو دور
// على نفس الكلمة تاني بتتنقل لأول القايمة بدل ما تتضاف مرة تانية).
const KEY = 'elmahi_recent_searches'
const MAX = 5

export function getRecentSearches() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function addRecentSearch(term) {
  const clean = term.trim()
  if (!clean) return
  try {
    const list = getRecentSearches().filter((t) => t.toLowerCase() !== clean.toLowerCase())
    list.unshift(clean)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* localStorage مش متاح (وضع خاص مثلًا) — تجاهل، مش حرج */
  }
}

export function removeRecentSearch(term) {
  try {
    const list = getRecentSearches().filter((t) => t !== term)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* تجاهل */
  }
}
