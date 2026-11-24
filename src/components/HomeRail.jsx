import { Link } from 'react-router-dom'
import ProductCard from './ProductCard'
import GridPromoCard from './GridPromoCard'
import PromoSliderGroup from './PromoSliderGroup'
import './GridPromoSection.css'
import { mergeGridPromos } from '../utils/gridPromos'

// كام منتج يظهروا في الرف (الباقي في صفحة "المزيد")
export const HOME_RAIL_LIMIT = 10

/**
 * رف منتجات أفقي في الرئيسية (وارد حديثًا / رشحنالك / الأكثر مبيعًا): عنوان القسم
 * وفي وشّه "المزيد" اللي بيفتح صفحة فيها كل منتجات القسم (to). الرف بيختفي لو
 * مفيش منتجات فيه بعد التحميل (بدل عنوان فاضي).
 *
 * promoCards (اختياري): { top, inline } — كروت عروض الشبكة (app_grid_promos)
 * اللي الأدمن حطها "مع الرف ده" من لوحة التحكم (شوف getRailPromos):
 *   top    → صف كروت تحت عنوان الرف مباشرة وفوق المنتجات.
 *   inline → وسط المنتجات، كل كارت بعد sortOrder منتج (0 = أول الرف) — بنفس
 *            mergeGridPromos، وبنفس مقاس كارت المنتج عشان الرف يفضل متساوي.
 *
 * promoSlides (اختياري): شرايح سلايدر العروض (app_promos) اللي الأدمن حطها
 * جوه الرف تحت العنوان (anchor = railtop:section:<id>) — بتتعرض كسلايدر
 * متحرك تحت العنوان وفوق كروت العروض والمنتجات.
 */
export default function HomeRail({ title, icon, to, products, loading, promoCards, promoSlides }) {
  if (!loading && products.length === 0) return null

  const topPromos = loading ? [] : promoCards?.top || []
  const items = loading
    ? []
    : mergeGridPromos(
        products.slice(0, HOME_RAIL_LIMIT),
        (promoCards?.inline || []).map((promo) => ({ ...promo, position: promo.sortOrder ?? 0 })),
      )

  return (
    <section style={{ marginTop: 'var(--sp-6)' }}>
      <div className="row row--between container" style={{ marginBottom: 'var(--sp-3)' }}>
        <h2 className="row section-title" style={{ gap: 'var(--sp-2)' }}>
          {title} {icon}
        </h2>
        {!loading && (
          <Link to={to} className="link-all">
            المزيد
          </Link>
        )}
      </div>
      {!loading && promoSlides?.length > 0 && (
        <div className="container" style={{ marginBottom: 'var(--sp-3)' }}>
          <PromoSliderGroup slides={promoSlides} />
        </div>
      )}
      {topPromos.length > 0 && (
        <div className="container grid-promo-section grid-promo-section--rail-top">
          {topPromos.map((promo) => (
            <div key={promo.id} className="grid-promo-section__item">
              <GridPromoCard promo={promo} />
            </div>
          ))}
        </div>
      )}
      <div className="shelf">
        <div className="scroll-x container">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="home-rail-item skeleton" style={{ height: 200 }} />
              ))
            : items.map((item) =>
                item.type === 'promo' ? (
                  <div key={`promo-${item.promo.id}`} className="home-rail-item home-rail-item--promo">
                    <GridPromoCard promo={item.promo} />
                  </div>
                ) : (
                  <div key={item.product.id} className="home-rail-item">
                    <ProductCard product={item.product} />
                  </div>
                ),
              )}
        </div>
      </div>
    </section>
  )
}
