import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX, ShoppingBag, Clock, X } from 'lucide-react'
import * as api from '../api/client'
import ProductCard from '../components/ProductCard'
import EmptyState from '../components/EmptyState'
import { getRecentSearches, addRecentSearch, removeRecentSearch } from '../utils/recentSearches'
import './CategoryPage.css'
import './SearchPage.css'

export default function SearchPage() {
  // بيدعم فتح الصفحة برابط فيه ?q=... — مستخدم من المساعد الصوتي (VoiceAssistant)
  // لما مايلاقيش الصنف تلقائيًا ويحب يفتحلك البحث بنفس اللي قولته
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [loadError, setLoadError] = useState('')

  // آخر 5 حاجات دور عليهم — بتظهر لما تدوس على الخانة، وبتتفلتر مع كل
  // حرف جديد تكتبه (بتفضل بس اللي فيها الحروف اللي كتبتها)
  const [recent, setRecent] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimerRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setLoadError('')
    const timer = setTimeout(() => {
      api
        .fetchSearch(query)
        .then((data) => {
          setResults(data)
          addRecentSearch(query)
        })
        .catch((err) => setLoadError(err.message || 'حصل خطأ في البحث'))
        .finally(() => {
          setLoading(false)
          setSearched(true)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function handleFocus() {
    clearTimeout(blurTimerRef.current)
    setRecent(getRecentSearches())
    setShowSuggestions(true)
  }

  function handleBlur() {
    // تأخير بسيط عشان نضمن إن ضغطة على اقتراح (onMouseDown) تتسجل قبل ما
    // القايمة تتخفي بسبب فقدان الفوكس (blur)
    blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150)
  }

  function pickSuggestion(term) {
    setQuery(term)
    setShowSuggestions(false)
  }

  function clearSuggestion(e, term) {
    e.stopPropagation()
    removeRecentSearch(term)
    setRecent((list) => list.filter((t) => t !== term))
  }

  const filteredSuggestions = query.trim()
    ? recent.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()))
    : recent

  return (
    <div className="container">
      <div className="search-page__input-wrap canopy">
        <div className="search-bar">
          <Search size={20} strokeWidth={2.5} aria-hidden="true" />
          <input
            type="search"
            placeholder="دور على منتج، ماركة، أو صنف…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="search-suggestions">
            {filteredSuggestions.map((term) => (
              <li key={term} className="search-suggestions__item" onMouseDown={() => pickSuggestion(term)}>
                <Clock size={15} strokeWidth={1.8} color="var(--color-ink-400)" aria-hidden="true" />
                <span className="search-suggestions__text">{term}</span>
                <button
                  type="button"
                  className="search-suggestions__remove"
                  onMouseDown={(e) => clearSuggestion(e, term)}
                  aria-label={`شيل "${term}" من الأخيرة`}
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 'var(--sp-5)' }}>
        {loading ? (
          <div className="category-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={loadError ? 'حصل خطأ في البحث' : 'مفيش نتايج'}
            subtitle={loadError || `مالقناش حاجة بالاسم ده "${query}"`}
          />
        ) : results.length > 0 ? (
          <div className="category-grid">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} linkState={{ from: 'search' }} />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShoppingBag} title="دور على أي منتج" subtitle="اكتب اسم الصنف أو الماركة اللي محتاجها" />
        )}
      </div>
    </div>
  )
}
