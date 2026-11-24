import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import ProductCard from '../components/ProductCard'
import EmptyState from '../components/EmptyState'
import './PromoProducts.css'

/**
 * صفحة "المزيد" لرفوف الرئيسية: /section/new (وارد حديثًا) و /section/recommended
 * (رشحنالك) و /section/best (الأكثر مبيعًا) — بتعرض كل منتجات القسم مش بس أول
 * الرف. نفس شبكة صفحة منتجات العروض.
 */
export const SECTION_TITLES = {
  new: 'وارد حديثًا',
  recommended: 'رشحنالك',
  best: 'الأكثر مبيعًا',
}

export default function SectionProducts() {
  const { type } = useParams()
  const known = Object.prototype.hasOwnProperty.call(SECTION_TITLES, type)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!known) return undefined
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .fetchSectionProducts(type)
      .then((data) => {
        if (active) setProducts(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'حصل خطأ في تحميل المنتجات')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [type, known])

  if (!known) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader title={SECTION_TITLES[type]} />

      <div className="container" style={{ marginTop: 'var(--sp-4)' }}>
        {loading ? (
          <div className="promo-products-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState icon={PackageOpen} title="حصل خطأ في تحميل المنتجات" subtitle={loadError} />
        ) : products.length === 0 ? (
          // القسم فاضي فعلًا (مفيش خطأ) — من غير رسالة، فضاء فاضي بس
          null
        ) : (
          <div className="promo-products-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
