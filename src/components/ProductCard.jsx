import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { getTieredDeal, getEffectiveUnitPrice, getNextTierHint, getFreeGiftDealsFor } from '../utils/deals'
import { getEffectiveMax } from '../utils/qty'
import { formatMoney } from '../utils/money'
import QuantityStepper from './QuantityStepper'
import NotifyMeButton from './NotifyMeButton'
import './ProductCard.css'
import CachedImage from './CachedImage'

export default function ProductCard({ product, linkState }) {
  const { qtyOf, addItem, setQty } = useCart()
  const { deals } = useDeals()
  const location = useLocation()
  // backTo: زرار الرجوع من صفحة المنتج يرجّع للصفحة اللي ضغطت فيها على الكارت
  // ده (قسم/بحث/قايمة عرض/الرئيسية) — شوف utils/backNavigation.js
  const productLinkState = { ...linkState, backTo: location.pathname + location.search }
  const units = product.units && product.units.length > 0 ? product.units : [product]
  const [unitIndex, setUnitIndex] = useState(0)
  const selected = units[unitIndex] || units[0]

  const qty = qtyOf(selected.id)
  const outOfStock = selected.stock === 0
  const lowStock = selected.stock > 0 && selected.stock <= 8

  const tieredDeal = getTieredDeal(deals, selected.id)
  const effectivePrice = getEffectiveUnitPrice(tieredDeal, selected.price, Math.max(qty, 1))
  const nextTier = getNextTierHint(tieredDeal, qty)
  const hasFreeGift = getFreeGiftDealsFor(deals, selected.id).length > 0

  // السعر بيتعرض دايمًا بنفس الشكل (من غير أصفار زايدة ولا كسور عائمة زي
  // 12.499999) وفي استيكر بحجم ثابت — الحجم مبقاش بيتغير مع القروش.
  const priceText = formatMoney(effectivePrice)
  const oldPriceText = product.oldPrice || effectivePrice < selected.price ? formatMoney(product.oldPrice || selected.price) : null

  const cartItem = {
    id: selected.id,
    productId: product.id,
    name: product.name,
    price: selected.price,
    unit: selected.unit,
    minQty: selected.minQty ?? 1,
    maxQty: selected.maxQty ?? null,
    qtyStep: selected.qtyStep ?? 1,
    stock: selected.stock,
    image: product.image ?? null,
  }

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`} state={productLinkState} className="product-card__media">
        {product.image ? (
          <CachedImage src={product.image} alt={product.name} className="product-card__image" />
        ) : (
          <div className="product-card__placeholder" aria-hidden="true">
            {product.name.charAt(0)}
          </div>
        )}
        {product.oldPrice && !outOfStock && <span className="badge badge--sale product-card__badge">خصم</span>}
        {product.fresh && !outOfStock && (
          <span className="badge badge--fresh product-card__badge product-card__badge--secondary">طازة</span>
        )}
        {!product.fresh && hasFreeGift && !outOfStock && (
          <span className="badge badge--fresh product-card__badge product-card__badge--secondary">هدية</span>
        )}
        {outOfStock && <span className="badge badge--outofstock product-card__badge">نفدت الكمية</span>}
      </Link>

      <div className="product-card__body">
        <Link to={`/product/${product.id}`} state={productLinkState}>
          <p className="product-card__name">{product.name}</p>
        </Link>

        {units.length > 1 ? (
          <div className="product-card__units">
            {units.map((u, i) => (
              <button
                key={u.id}
                type="button"
                className="chip chip--sm"
                aria-pressed={i === unitIndex}
                onClick={() => setUnitIndex(i)}
              >
                {u.unit}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-caption product-card__unit-line">{selected.unit}{lowStock ? ` · باقي ${selected.stock}` : ''}</p>
        )}

        <div className="row row--between product-card__footer">
          <span className={`price product-card__price${priceText.length > 7 ? ' product-card__price--long' : ''}`}>
            {priceText} ج.م
          </span>

          {outOfStock ? (
            <NotifyMeButton unitId={selected.id} productName={product.name} unitLabel={selected.unit} variant="icon" />
          ) : qty > 0 ? (
            <QuantityStepper
              qty={qty}
              onChange={(v) => setQty(selected.id, v)}
              max={getEffectiveMax(selected)}
              min={selected.minQty ?? 1}
              step={selected.qtyStep ?? 1}
            />
          ) : (
            <button
              type="button"
              className="product-card__add"
              onClick={() => addItem(cartItem)}
              aria-label={`ضيف ${product.name} للسلة`}
            >
              +
            </button>
          )}
        </div>

        {/* سطر ثابت الارتفاع للسعر القديم/النقاط — موجود دايمًا (حتى لو فاضي)
            عشان ارتفاع الكارت ومكان الاستيكر مايتغيروش من منتج للتاني */}
        <div className="product-card__meta">
          {oldPriceText && <span className="price--strike">{oldPriceText}</span>}
          {selected.points > 0 && (
            <span className="product-card__points">
              <Star size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              {selected.points} نقطة
            </span>
          )}
        </div>

        {nextTier && (
          <p className="text-caption product-card__deal-hint">
            كمّل {nextTier.remaining} كمان بسعر {nextTier.unitPrice} ج.م للوحدة
          </p>
        )}
      </div>
    </div>
  )
}
