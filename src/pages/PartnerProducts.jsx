import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import ProductCard from '../components/ProductCard'
import EmptyState from '../components/EmptyState'
import './PromoProducts.css'

/**
 * صفحة شركة معينة من "شركاء النجاح" (الضغط على شعارها في PartnersSection) —
 * بتعرض بس المنتجات المربوطة بالشركة دي (admin-product-partner-save.php)،
 * نفس شكل/تصميم PromoProducts.jsx بالظبط بس للشركاء مش للعروض.
 */
export default function PartnerProducts() {
  const { partnerId } = useParams()
  const [title, setTitle] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .fetchPartnerProducts(partnerId)
      .then((data) => {
        if (!active) return
        setTitle(data.partner?.name || '')
        setProducts(data.products || [])
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
  }, [partnerId])

  return (
    <div>
      <PageHeader title={title || 'منتجات الشركة'} />

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
          // الشركة دي مفيش منتجات مربوطة بيها لسه (مفيش خطأ) — من غير رسالة
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
