import GridPromoCard from './GridPromoCard'
import { getPromosForAnchor } from '../utils/gridPromos'
import './GridPromoSection.css'

/**
 * بيعرض كروت العروض (لو موجودة) اللي مكانها (anchor) بالظبط هو ده —
 * قسم مستقل قائم بذاته بين أقسام الصفحة، بعرض كارت المنتج تقريبًا،
 * من غير أي علاقة بالمنتجات أو الأقسام الحقيقية. من غير كروت لـ anchor
 * ده، الكومبوننت مبيرندرش أي حاجة خالص.
 */
export default function GridPromoSection({ gridPromos, anchor }) {
  const promos = getPromosForAnchor(gridPromos, anchor)
  if (promos.length === 0) return null

  return (
    <section className="container grid-promo-section">
      {promos.map((promo) => (
        <div key={promo.id} className="grid-promo-section__item">
          <GridPromoCard promo={promo} />
        </div>
      ))}
    </section>
  )
}
