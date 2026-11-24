import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBasket } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { applyDealsToCart } from '../utils/deals'
import { useSettings } from '../context/SettingsContext'
import { getEffectiveMax } from '../utils/qty'
import PageHeader from '../components/PageHeader'
import QuantityStepper from '../components/QuantityStepper'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import CachedImage from '../components/CachedImage'
import './Cart.css'

export default function Cart() {
  const { items, setQty, removeItem, clearCart, totalItems } = useCart()
  const { deals } = useDeals()
  const { order: orderSettings } = useSettings()
  const navigate = useNavigate()
  const [confirmClear, setConfirmClear] = useState(false)
  // قيم افتراضية (نفس القديمة) لحد ما الإعدادات توصل من السيرفر
  const deliveryFeeAmount = orderSettings?.deliveryFee ?? 20
  const freeDeliveryThreshold = orderSettings?.freeDeliveryThreshold ?? 300
  const minOrderValue = orderSettings?.minOrderValue ?? 0

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title="السلة" />
        <EmptyState
          icon={ShoppingBasket}
          title="السلة فاضية"
          subtitle="ابدأ تضيف منتجات من الأقسام"
          action={
            <Link to="/" className="btn btn--primary">
              تصفح المنتجات
            </Link>
          }
        />
      </div>
    )
  }

  const { lines, freeLines, subtotal, messages } = applyDealsToCart(items, deals)
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : deliveryFeeAmount
  const grandTotal = subtotal + deliveryFee
  const belowMinOrder = minOrderValue > 0 && subtotal < minOrderValue

  return (
    <div className="cart-page">
      <PageHeader title={`السلة (${totalItems})`} />

      <div className="container" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
        <button
          type="button"
          className="cart-item__remove"
          onClick={() => setConfirmClear(true)}
        >
          إفراغ السلة
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        danger
        title="إفراغ السلة"
        message="متأكد إنك عايز تفضي السلة بالكامل؟"
        confirmLabel="أيوه، فضّيها"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearCart()
          setConfirmClear(false)
        }}
      />

      <ul className="container cart-list">
        {lines.map((item) => (
          <li key={item.id} className="cart-item">
            <div className="cart-item__placeholder" aria-hidden="true">
              {item.image ? (
                <CachedImage src={item.image} alt="" className="cart-item__image" />
              ) : (
                item.name.charAt(0)
              )}
            </div>
            <div className="cart-item__info">
              <p className="cart-item__name">{item.name}</p>
              <p className="text-caption">
                {item.unit} · {item.unitPrice} ج.م
                {item.unitPrice < item.price && <span className="price--strike"> {item.price}</span>}
              </p>
              <div className="row row--between" style={{ marginTop: 'var(--sp-2)' }}>
                <QuantityStepper
                  qty={item.qty}
                  onChange={(v) => setQty(item.id, v)}
                  max={getEffectiveMax(item)}
                  min={item.minQty ?? 1}
                  step={item.qtyStep ?? 1}
                />
                <button type="button" className="cart-item__remove" onClick={() => removeItem(item.id)}>
                  حذف
                </button>
              </div>
            </div>
          </li>
        ))}

        {freeLines.map((gift) => (
          <li key={gift.id} className="cart-item cart-item--gift">
            <div className="cart-item__placeholder" aria-hidden="true">🎁</div>
            <div className="cart-item__info">
              <p className="cart-item__name">{gift.name} <span className="badge badge--fresh">هدية</span></p>
              <p className="text-caption">هدية مجانية × {gift.qty}</p>
            </div>
          </li>
        ))}
      </ul>

      {messages.length > 0 && (
        <div className="container cart-deals-box">
          {messages.map((m, i) => (
            <p key={i} className="text-caption cart-deals-box__line">✓ {m}</p>
          ))}
        </div>
      )}

      <div className="container cart-summary card">
        <div className="row row--between">
          <span className="text-muted">إجمالي المنتجات</span>
          <span>{subtotal} ج.م</span>
        </div>
        <div className="row row--between">
          <span className="text-muted">التوصيل</span>
          <span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ج.م`}</span>
        </div>
        {deliveryFee > 0 && (
          <p className="text-caption cart-summary__hint">
            كمّل {freeDeliveryThreshold - subtotal} ج.م تاخد توصيل مجاني
          </p>
        )}
        {belowMinOrder && (
          <p className="text-caption cart-summary__hint cart-summary__hint--warning">
            الحد الأدنى لقيمة الطلب {minOrderValue} ج.م — ضيف {minOrderValue - subtotal} ج.م كمان
          </p>
        )}
        <div className="row row--between cart-summary__total">
          <span>الإجمالي</span>
          <span className="price">{grandTotal} ج.م</span>
        </div>
      </div>

      <div
        className="container"
        style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}
      >
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => navigate('/checkout')}
          disabled={belowMinOrder}
        >
          إتمام الطلب
        </button>
        <button type="button" className="btn btn--outline btn--block" onClick={() => navigate('/')}>
          تابع التسوق
        </button>
      </div>
    </div>
  )
}
