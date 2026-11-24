// =============================================================================
// ربط شرايح السلايدر بقسم أو مجموعة منتجات أو صفحة المسابقة — منطق بحت (من
// غير DOM) عشان يتختبر لوحده. نفس أنواع الرابط بتوع كروت العروض الشبكية
// (GridPromoCard):
//   'category' → صفحة القسم اللي الأدمن اختاره (linkCategoryId)
//   'products' → صفحة فيها بالظبط المنتجات اللي الأدمن اختارها للشريحة دي
//   'competition' → صفحة المسابقة الحالية (مفيش id مرتبط بيها — مسابقة واحدة
//     بس فعّالة في كل وقت)
//   'none' (أو أي حاجة تانية) → الشريحة مجرد صورة/إعلان، مفيش حاجة بتتفتح
// =============================================================================

/** المسار اللي الشريحة دي بتفتحه لما تتضغط، أو null لو مفيش رابط. */
export function getPromoLinkPath(slide) {
  if (!slide) return null
  if (slide.linkType === 'category' && slide.linkCategoryId) {
    return `/category/${encodeURIComponent(slide.linkCategoryId)}`
  }
  if (slide.linkType === 'products') {
    return `/slider/${encodeURIComponent(slide.id)}/products`
  }
  if (slide.linkType === 'competition') {
    return '/competition'
  }
  return null
}

/**
 * لمسة (مش سحبة) على الشريحة رقم tappedIndex والشريحة النشطة حاليًا
 * activeIndex — بتحدد هيحصل إيه:
 *   - لمست الشريحة اللي في النص ولها رابط → 'open'
 *   - لمست الشريحة اللي في النص ومالهاش رابط → 'none'
 *   - لمست شريحة جنبية (باينة جزء منها بس) → 'center' (تتنقل للنص)
 */
export function resolveSlideTap(tappedIndex, activeIndex, slides) {
  if (!Number.isInteger(tappedIndex) || tappedIndex < 0 || tappedIndex >= slides.length) return 'none'
  if (tappedIndex !== activeIndex) return 'center'
  return getPromoLinkPath(slides[tappedIndex]) ? 'open' : 'none'
}
