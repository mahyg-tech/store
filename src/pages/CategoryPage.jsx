import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import { useBackTarget } from '../hooks/useGoBack'
import ProductCard from '../components/ProductCard'
import PromoSliderGroup from '../components/PromoSliderGroup'
import GridPromoSection from '../components/GridPromoSection'
import EmptyState from '../components/EmptyState'
import AppIcon from '../components/AppIcon'
import './CategoryPage.css'
import CachedImage from '../components/CachedImage'

// نفس مقاسات أيقونة القسم المستخدمة في الصفحة الرئيسية (Home.jsx) —
// لازم يفضلوا متطابقين عشان القسم يبان بنفس الحجم في الصفحتين.
const CATEGORY_ICON_PX = { small: 24, medium: 32, large: 44 }

export default function CategoryPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [promos, setPromos] = useState([])
  const [products, setProducts] = useState([])
  const [gridPromos, setGridPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    api
      .fetchCategories()
      .then((data) => data && setCategories(data))
      .catch((err) => console.error('fetchCategories failed:', err.message))
    api
      .fetchPromos()
      .then((data) => data && setPromos(data))
      .catch((err) => console.error('fetchPromos failed:', err.message))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .fetchProductsByCategory(categoryId)
      .then((data) => {
        if (active) setProducts(data)
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'حصل خطأ في تحميل المنتجات')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    // مستقل عن تحميل المنتجات نفسه — لو فشل، القسم لسه بيبان عادي من غيره
    api
      .fetchGridPromos('category', categoryId)
      .then((data) => {
        if (active) setGridPromos(data || [])
      })
      .catch((err) => console.error('fetchGridPromos failed:', err.message))
    return () => {
      active = false
    }
  }, [categoryId])

  const currentCategory = categories.find((c) => c.id === categoryId)
  // لو القسم ده فرعي، هات بيانات القسم الرئيسي بتاعه عشان البريدكرَمب
  const parentCategory = currentCategory?.parentId
    ? categories.find((c) => c.id === currentCategory.parentId)
    : null
  // لو القسم ده رئيسي، هات الأقسام الفرعية التابعة له (مستوى واحد بس، مفيش تعشيش أعمق)
  const subcategories = categories.filter((c) => c.parentId === categoryId)
  const topLevelCategories = categories.filter((c) => !c.parentId)

  // زرار الرجوع (الأصلي + السهم اللي فوق) من قسم فرعي بيرجّع للقسم الرئيسي
  // بتاعه، ومن قسم رئيسي للرئيسية — مش لآخر صفحة اتزارت
  useBackTarget(parentCategory ? `/category/${parentCategory.id}` : null)
  // عروض مخصصة للقسم ده بالذات (رئيسي كان أو فرعي) — بتظهر هنا بس، مش في الرئيسية
  const categoryPromos = promos.filter((p) => p.categoryId === categoryId)

  return (
    <div>
      <PageHeader title={currentCategory?.name || 'المنتجات'} />

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="top" />}

      {parentCategory ? (
        // بريدكرَمب بسيط لما تكون واقف جوه قسم فرعي — يرجّعك للرئيسي بضغطة واحدة
        <div className="container category-breadcrumb">
          <button
            type="button"
            className="category-breadcrumb__link"
            onClick={() => navigate(`/category/${parentCategory.id}`)}
          >
            {parentCategory.name}
          </button>
          <span className="category-breadcrumb__sep">/</span>
          <span className="category-breadcrumb__current">{currentCategory?.name}</span>
        </div>
      ) : (
        // شريط تنقل سريع بين الأقسام الرئيسية (مش الفرعية، عشان يفضل قصير ومفهوم)
        <div className="scroll-x container" style={{ marginBottom: 'var(--sp-4)' }}>
          {topLevelCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="chip"
              aria-pressed={cat.id === categoryId}
              onClick={() => navigate(`/category/${cat.id}`)}
            >
              {cat.iconImage ? (
                <CachedImage
                  src={cat.iconImage}
                  alt=""
                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', marginInlineEnd: 4 }}
                />
              ) : (
                <AppIcon name={cat.icon} size={16} color="currentColor" style={{ marginInlineEnd: 4 }} />
              )}
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {categoryPromos.length > 0 && (
        <div className="container" style={{ marginBottom: 'var(--sp-4)' }}>
          <PromoSliderGroup slides={categoryPromos} height={150} />
        </div>
      )}

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_promo_slider" />}

      {subcategories.length > 0 && (
        <div className="container" style={{ marginBottom: 'var(--sp-5)' }}>
          <h2 className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>الأقسام الفرعية</h2>
          <div className="category-subgrid">
            {subcategories.map((cat) => {
              const iconSize = ['small', 'medium', 'large'].includes(cat.iconSize) ? cat.iconSize : 'medium'
              return (
                <Link
                  key={cat.id}
                  to={`/category/${cat.id}`}
                  className={`category-subcat-card stall category-subcat-card--${iconSize}`}
                  aria-label={cat.name}
                >
                  {cat.iconImage ? (
                    <CachedImage src={cat.iconImage} alt="" className="category-subcat-card__image" />
                  ) : (
                    <AppIcon name={cat.icon} size={CATEGORY_ICON_PX[iconSize]} color="var(--brand-deep)" className="category-subcat-card__icon" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_subcategories" />}

      <div className="container">
        {subcategories.length > 0 && !loading && products.length > 0 && (
          <h2 className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>
            منتجات {currentCategory?.name || 'القسم'}
          </h2>
        )}
        {loading ? (
          <div className="category-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState icon={PackageOpen} title="حصل خطأ في تحميل المنتجات" subtitle={loadError} />
        ) : products.length === 0 ? (
          // القسم فاضي فعلًا (مفيش خطأ) — من غير رسالة، فضاء فاضي بس، بنفس
          // أسلوب HomeRail اللي بيختفي من غير عنوان فاضي بدل ما يبين رسالة
          null
        ) : (
          <div className="category-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="bottom" />}
    </div>
  )
}
