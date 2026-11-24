import { useNavigate } from 'react-router-dom'
import { ShoppingBasket, ChevronLeft } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { applyDealsToCart } from '../utils/deals'
import './CartBar.css'

export default function CartBar() {
  const { items, totalItems } = useCart()
  const { deals } = useDeals()
  const navigate = useNavigate()

  if (totalItems === 0) return null

  const { subtotal } = applyDealsToCart(items, deals)

  return (
    <button type="button" className="cart-bar" onClick={() => navigate('/cart')}>
      <span className="cart-bar__basket">
        <ShoppingBasket size={20} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
        <span className="cart-bar__count">{totalItems}</span>
      </span>
      <span className="cart-bar__text">
        <span className="cart-bar__label">اعرض السلة</span>
        <span className="cart-bar__total">{subtotal} ج.م</span>
      </span>
      <ChevronLeft size={20} color="var(--color-white)" aria-hidden="true" style={{ transform: 'rotate(180deg)' }} />
    </button>
  )
}
