// =============================================================================
// حسابات هندسة الشريط (الكاروسيل) بتاع WelcomePopup — بحتة (من غير DOM)
// عشان تتختبر لوحدها. كل كارت ممكن يبقى بعرض مختلف (كل بوب أب ليه حجمه
// الخاص small/medium/large)، فمش بنفترض عرض ثابت — بنستخدم عرض كل كارت
// الفعلي (متقاس من الشاشة) لحساب الإزاحة التراكمية.
// =============================================================================

/**
 * الإزاحة التراكمية (بالبكسل) لحافة كل كارت في الشريط، بافتراض إن الشريط
 * بيتحط بترتيب LTR فيزيائي (كارت 0 يمين، وبعدين كل كارت تاني على شماله —
 * شوف التعليق في WelcomePopup.jsx ليه). widths = مصفوفة عرض كل كارت
 * بالبكسل (ممكن يكون فيها undefined/0 لكروت لسه ماتقاستش).
 */
export function cumulativeOffsets(widths, gap) {
  const offsets = []
  let x = 0
  for (let i = 0; i < widths.length; i++) {
    offsets.push(x)
    x += (Number(widths[i]) || 0) + gap
  }
  return offsets
}

/** إزاحة الشريط (transform) عشان الكارت رقم index يبقى في وضعه الطبيعي. */
export function trackOffsetForIndex(widths, gap, index) {
  const offsets = cumulativeOffsets(widths, gap)
  const x = -(offsets[index] ?? 0)
  return x === 0 ? 0 : x // بنتجنب -0 (transform: translateX(-0px) شغالة، بس -0 بتلخبط أي مقارنة/تسجيل)
}

/** عرض ستايدج (نافذة العرض): الكارت النشط كامل + جزء من اللي بعده لو موجود. */
export function stageWidth(activeWidth, hasNext, peek) {
  return (Number(activeWidth) || 0) + (hasNext ? peek : 0)
}

/**
 * بعد ما السحب يخلص، إيه القرار: 'next' | 'prev' | 'close' | 'stay'.
 *   dx > 0  (سحب لليمين) وفيه كارت قبله  → 'prev'
 *   dx < 0  (سحب لليسار) عدّى الحد        → 'next' لو فيه كمان، وإلا 'close'
 *   غير كده                                → 'stay' (يرجع لمكانه)
 */
export function resolveSwipe(dx, threshold, activeIndex, queueLength) {
  if (dx <= -threshold) {
    return activeIndex < queueLength - 1 ? 'next' : 'close'
  }
  if (dx >= threshold && activeIndex > 0) {
    return 'prev'
  }
  return 'stay'
}
