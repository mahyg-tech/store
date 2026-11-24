import { Link, useLocation } from 'react-router-dom'
import AppIcon from './AppIcon'
import './GridPromoCard.css'
import CachedImage from './CachedImage'

/**
 * كارت عرض بنفس حجم كارت المنتج تقريبًا — بيتحط كقسم مستقل بين أقسام
 * الصفحة (فوق/تحت السلايدر، تحت الأقسام، إلخ)، مش جوه شبكة منتجات.
 * مكانه بالظبط (page + anchor) بيتحكم فيه بالكامل من لوحة التحكم —
 * شوف GridPromoSection اللي بيحدد الـ anchor ويعرض الكارت في مكانه.
 *
 * لما يتضغط عليه، بيفتح حسب promo.linkType:
 *   'category' → صفحة القسم اللي اتحدد (promo.linkCategoryId)
 *   'products' → صفحة فيها بالظبط المنتجات اللي اتحددت (promo.id)
 *   'competition' → صفحة المسابقة الحالية
 *   'none' (أو مش متحدد) → مفيش حاجة، الكارت مجرد صورة
 */
export default function GridPromoCard({ promo }) {
  const location = useLocation()
  // زرار الرجوع من الصفحة اللي بيفتحها الكارت يرجّع للصفحة اللي ضغطت فيها عليه
  const backState = { backTo: location.pathname + location.search }
  const content = (
    <>
      {promo.image ? (
        <CachedImage src={promo.image} alt={promo.title || ''} className="grid-promo-card__image" />
      ) : (
        <div className="grid-promo-card__placeholder">
          <AppIcon name="Tag" size={32} color="var(--brand)" strokeWidth={2} />
        </div>
      )}
      {promo.title && <p className="grid-promo-card__title">{promo.title}</p>}
    </>
  )

  if (promo.linkType === 'category' && promo.linkCategoryId) {
    return (
      <Link to={`/category/${promo.linkCategoryId}`} state={backState} className="grid-promo-card">
        {content}
      </Link>
    )
  }

  if (promo.linkType === 'products') {
    return (
      <Link to={`/promo/${promo.id}/products`} state={backState} className="grid-promo-card">
        {content}
      </Link>
    )
  }

  if (promo.linkType === 'competition') {
    return (
      <Link to="/competition" state={backState} className="grid-promo-card">
        {content}
      </Link>
    )
  }

  return <div className="grid-promo-card">{content}</div>
}
