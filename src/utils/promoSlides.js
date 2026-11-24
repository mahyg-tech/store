// =============================================================================
// فلترة شرايح سلايدر العروض (PromoSlider) الخاصة بالصفحة الرئيسية حسب
// مكانها بالظبط (anchor) — نفس فكرة getPromosForAnchor بتاعة كروت عروض
// الشبكة (utils/gridPromos.js) بالظبط، بس هنا كل الشرايح اللي ليها نفس
// الـ anchor بيتجمعوا في سلايدر متحرك واحد (مش كروت جنب بعض في شبكة).
//
// عروض الأقسام (categoryId مسجل) مالهاش anchor خالص — بتتعرض في صفحة
// القسم بتاعها بس عن طريق فلترة categoryId مباشرة (شوف CategoryPage.jsx)،
// فبنستبعدها هنا تمامًا عشان ماتتكررش في الصفحة الرئيسية.
//
// الترتيب بين الشرايح اللي في نفس الـ anchor بييجي من ترتيب promos.php
// نفسه (ORDER BY anchor, sort_order, id) — مفيش sort_order راجع في رد
// الـ API العام أصلًا، فمفيش داعي نرتب تاني هنا.
// =============================================================================

// fallback لبيانات قديمة لسه معمول عليهاش migration (sql/app_promos_anchor_schema.sql)
// أو جاية من mockData.js القديم من غير anchor: group='secondary' كان
// بالظبط مكانه القديم تحت "وارد حديثًا"، وأي حاجة تانية (أو من غير group)
// كانت فوق الشاشة.
function effectiveAnchor(promo) {
  if (promo.anchor) return promo.anchor
  return promo.group === 'secondary' ? 'after_new_arrivals' : 'top'
}

export function getPromoSlidesForAnchor(promos, anchor) {
  if (!promos || promos.length === 0) return []

  return promos.filter((p) => !p.categoryId && effectiveAnchor(p) === anchor)
}

// =============================================================================
// أحجام السلايدر (app_promos.size / half_side — شوف PromoSliderGroup.jsx):
//   normal → الحجم الحالي     short → نفس العرض بنص الارتفاع
//   half   → نص العرض ونص الارتفاع، على ناحية 'left' أو 'right'
// بنقسّم شرايح مكان واحد (anchor) لـ "بلوكات": كل بلوك سلايدر متحرك لوحده —
// شرايح normal كلها في سلايدر، شرايح short في سلايدر، وشرايح half بتتقسم
// على ناحيتين (شمال/يمين) بيتعرضوا جنب بعض في صف واحد. ترتيب البلوكات بيتبع
// أول شريحة ظهرت منها (الترتيب اللي جاي من السيرفر أصلًا)، فمكان كل سلايدر
// في الصفحة بيتحكم فيه رقم ترتيب شرايحه.
// =============================================================================
export function groupSlidesBySize(slides) {
  const blocks = []
  let normal = null
  let short = null
  let half = null

  ;(slides || []).forEach((slide) => {
    if (slide.size === 'short') {
      if (!short) { short = { type: 'short', slides: [] }; blocks.push(short) }
      short.slides.push(slide)
    } else if (slide.size === 'half') {
      if (!half) { half = { type: 'half', left: [], right: [] }; blocks.push(half) }
      ;(slide.halfSide === 'left' ? half.left : half.right).push(slide)
    } else {
      if (!normal) { normal = { type: 'normal', slides: [] }; blocks.push(normal) }
      normal.slides.push(slide)
    }
  })

  return blocks
}
