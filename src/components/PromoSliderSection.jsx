import PromoSliderGroup from './PromoSliderGroup'
import { getPromoSlidesForAnchor } from '../utils/promoSlides'

/**
 * بيعرض سلايدر عروض (لو فيه شرايح) في مكانه (anchor) بالظبط — نفس فكرة
 * GridPromoSection/HomeVideoSection بالظبط، بس بيجمع كل الشرايح اللي
 * ليها نفس الـ anchor في سلايدر متحرك واحد بدل كروت جنب بعض. من غير
 * شرايح لـ anchor ده، الكومبوننت مبيرندرش أي حاجة خالص (ولا حتى الحاوية
 * الفاضية)، فمفيش فراغ زيادة في الصفحة لو الأدمن مستخدمش المكان ده.
 */
export default function PromoSliderSection({ promos, anchor, height = 150, marginTop = 'var(--sp-6)' }) {
  const slides = getPromoSlidesForAnchor(promos, anchor)
  if (slides.length === 0) return null

  return (
    <section className="container" style={{ marginTop }}>
      <PromoSliderGroup slides={slides} height={height} />
    </section>
  )
}
