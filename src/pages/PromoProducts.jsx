import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import ProductCard from '../components/ProductCard'
import EmptyState from '../components/EmptyState'
import './PromoProducts.css'

/**
 * الصفحة اللي بتفتح لما العميل يضغط على كارت عرض (GridPromoCard) أو شريحة
 * سلايدر (PromoSlider) نوع الرابط بتاعها 'products' — بتعرض بالظبط المنتجات
 * اللي الأدمن اختارها يدويًا من لوحة التحكم، مش قسم أو فلتر.
 * source: 'grid' (كارت عرض شبكي، /promo/:id/products) أو 'slider'
 * (شريحة سلايدر، /slider/:id/products).
 */
export default function PromoProducts({ source = 'grid' }) {
  const { promoId } = useParams()
  const [title, setTitle] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    const fetcher = source === 'slider' ? api.fetchPromoProducts : api.fetchGridPromoProducts
    fetcher(promoId)
      .then((data) => {
        if (!active) return
        setTitle(data.title || '')
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
  }, [promoId, source])

  return (
    <div>
      <PageHeader title={title || 'المنتجات المختارة'} />

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
