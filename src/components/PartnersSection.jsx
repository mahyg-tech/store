import { Link } from 'react-router-dom'
import CachedImage from './CachedImage'
import './PartnersSection.css'

/**
 * قسم "شركاء النجاح" في الرئيسية — صف أفقي بيعرض شعارات الشركات (الموردين/
 * العلامات التجارية) النشطة. فتح شركة (الضغط على شعارها) بيودّي لصفحة فيها
 * بس المنتجات المربوطة بيها (PartnerProducts.jsx)، زي كروت عروض الشبكة
 * بالظبط (GridPromoSection) بس للشركات مش للعروض.
 *
 * بيختفي لوحده لو مفيش شركات نشطة خالص (بعد التحميل) — نفس أسلوب HomeRail،
 * من غير عنوان قسم فاضي.
 */
export default function PartnersSection({ partners, loading }) {
  if (!loading && (!partners || partners.length === 0)) return null

  return (
    <section style={{ marginTop: 'var(--sp-6)' }}>
      <div className="container" style={{ marginBottom: 'var(--sp-3)' }}>
        <h2 className="section-title">شركاء النجاح</h2>
      </div>
      <div className="scroll-x container partners-row">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="partner-chip partner-chip--skeleton skeleton" />)
          : partners.map((partner) => (
              <Link key={partner.id} to={`/partner/${partner.id}`} className="partner-chip" aria-label={partner.name}>
                <div className="partner-chip__logo">
                  {partner.image ? (
                    <CachedImage src={partner.image} alt={partner.name} className="partner-chip__image" />
                  ) : (
                    <span className="partner-chip__initial">{partner.name.charAt(0)}</span>
                  )}
                </div>
                <span className="partner-chip__name">{partner.name}</span>
              </Link>
            ))}
      </div>
    </section>
  )
}
