import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import './Orders.css'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    api
      .fetchOrders()
      .then((data) => setOrders(data))
      .catch((err) => setLoadError(err.message || 'حصل خطأ في تحميل الطلبات'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="طلباتي" />

      <div className="container">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88 }} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title={loadError ? 'حصل خطأ في تحميل الطلبات' : 'لسه معملتش أي طلب'}
            subtitle={loadError || 'أول ما تطلب هتلاقي كل أوردراتك هنا'}
            action={
              !loadError && (
                <Link to="/" className="btn btn--primary">
                  ابدأ التسوق
                </Link>
              )
            }
          />
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {orders.map((order) => (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className="order-row card">
                  <div>
                    <p style={{ fontWeight: 600 }}>طلب #{order.id.slice(-5)}</p>
                    <p className="text-caption">
                      {new Date(order.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
                      {' · '}
                      {order.items?.length ?? order.itemsCount ?? 0} منتج
                    </p>
                  </div>
                  <div className="order-row__right">
                    <span className="badge badge--fresh">{order.status}</span>
                    <span className="price">{order.total} ج.م</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
