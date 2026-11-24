// =============================================================================
// بتدمج كروت عروض شبكة (نفس حجم كارت المنتج) جوه قائمة منتجات حقيقية،
// كل واحد في مكانه (position) اللي اتحدد من لوحة التحكم. بترجّع مصفوفة
// موحدة من عناصر { type: 'product', product } أو { type: 'promo', promo }
// جاهزة للعرض مباشرة بدل المصفوفة الأصلية.
// =============================================================================

// بترجّع كروت العروض اللي anchor بتاعها هو ده بالظبط (الفلترة بتبقى على
// page/categoryId اتعملت قبل كده في fetchGridPromos)، مرتبة بالـ
// sortOrder، والـ id كمُحدد تاني عشان الترتيب يفضل ثابت لو فيه تساوي.
export function getPromosForAnchor(gridPromos, anchor) {
  if (!gridPromos || gridPromos.length === 0) return []

  return gridPromos
    .filter((promo) => promo.anchor === anchor)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.id).localeCompare(String(b.id)))
}

// كروت العروض اللي الأدمن حطها "مع رف منتجات" في الرئيسية. railKey هو
// best_sellers / new_arrivals / recommended / section:<id>. بترجّع:
//   top    → تحت عنوان الرف مباشرة وفوق المنتجات (anchor = railtop:<railKey>)
//   inline → وسط المنتجات (anchor = rail:<railKey>، وsortOrder = بعد كام منتج)
export function getRailPromos(gridPromos, railKey) {
  return {
    top: getPromosForAnchor(gridPromos, `railtop:${railKey}`),
    inline: getPromosForAnchor(gridPromos, `rail:${railKey}`),
  }
}

export function mergeGridPromos(products, gridPromos) {
  const items = (products || []).map((product) => ({ type: 'product', product }))
  if (!gridPromos || gridPromos.length === 0) return items

  // بنرتبهم تصاعديًا بالـ position، وبنحط الـ id كمُحدد تاني عشان الترتيب
  // يفضل ثابت لو أكتر من كارت عندهم نفس الـ position بالظبط
  const sorted = [...gridPromos].sort((a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id)))

  // بندخل كل واحد بالترتيب، وبنزود على مكانه المطلوب عدد اللي اتحطوا قبله
  // في المصفوفة عشان الـ position بتاعت كل واحد تفضل بمعنى "بعد كام منتج
  // حقيقي" مش "في الـ index رقم كذا بعد ما دخلنا كروت تانية قبله"
  sorted.forEach((promo, i) => {
    const index = Math.min(promo.position + i, items.length)
    items.splice(index, 0, { type: 'promo', promo })
  })

  return items
}
