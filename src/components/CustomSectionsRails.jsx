import { Fragment } from 'react'
import HomeRail from './HomeRail'
import PromoSliderSection from './PromoSliderSection'
import { getPromosForAnchor, getRailPromos } from '../utils/gridPromos'
import { getPromoSlidesForAnchor } from '../utils/promoSlides'

/**
 * بيعرض الأقسام المخصصة بالرئيسية (app_custom_sections — من لوحة
 * التحكم) اللي مكانها (anchor) بالظبط هو ده، كل واحد كرف منتجات أفقي زي
 * "رشحنالك" بالظبط (نفس HomeRail.jsx). getPromosForAnchor بتفلتر وترتب
 * بالـ anchor/sortOrder بالظبط زي ما بتعمل مع كروت عروض الشبكة، فبتشتغل
 * هنا من غير أي تعديل لأن شكل البيانات (anchor + sortOrder + id) واحد.
 *
 * promos (اختياري): سلايدرات العروض (app_promos). الأدمن ينفع يحط سلايدر
 * مع القسم المخصص بمكانين: railtop:section:<id> (جوه الرف تحت العنوان —
 * بيتمرر لـ HomeRail كـ promoSlides) أو after_section:<id> (تحت الرف كله).
 */
export default function CustomSectionsRails({ customSections, gridPromos, promos, anchor, loading }) {
  if (loading) return null
  const sections = getPromosForAnchor(customSections, anchor)
  if (sections.length === 0) return null

  return (
    <>
      {sections.map((section) => (
        <Fragment key={section.id}>
          <HomeRail
            title={section.title}
            to={`/custom-section/${section.id}/products`}
            products={section.products || []}
            loading={false}
            promoCards={getRailPromos(gridPromos, `section:${section.id}`)}
            promoSlides={getPromoSlidesForAnchor(promos, `railtop:section:${section.id}`)}
          />
          {section.products?.length > 0 && (
            <PromoSliderSection promos={promos} anchor={`after_section:${section.id}`} />
          )}
        </Fragment>
      ))}
    </>
  )
}
