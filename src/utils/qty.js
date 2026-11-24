// =============================================================================
// أدوات مساعدة للتعامل مع الكميات اللي ممكن تكون كسور (نص/ربع) لبعض
// وحدات المنتجات — الحد الأدنى/الأقصى وخطوة الكمية بيتحددوا لكل وحدة من
// لوحة التحكم (minQty/maxQty/qtyStep على كل عنصر في units[]). لو مفيش
// حاجة متحددة، القيم الافتراضية بتحافظ على السلوك القديم بالظبط: يبدأ
// من 1، من غير حد أقصى غير الرصيد، وكمية صحيحة بس.
// =============================================================================

/** الحد الأقصى الفعلي للكمية — أقل قيمة بين الرصيد المتاح وأي حد أقصى مضبوط من لوحة التحكم */
export function getEffectiveMax(unit) {
  if (!unit) return undefined
  const stock = unit.stock
  if (unit.maxQty == null) return stock
  return Math.min(stock, unit.maxQty)
}

/** بيقرّب رقم لأقرب مضاعف لخطوة الكمية، ويشيل أخطاء الفاصلة العائمة (زي 0.30000000000000004) */
export function snapToStep(value, step = 1) {
  const rounded = Math.round(value / step) * step
  return Math.round(rounded * 1000) / 1000
}

/**
 * بتحوّل رقم لعرضه بصيغة كسر (ربع/نص/تلت أرباع) لما يكون فيه جزء عشري
 * من مضاعفات الربع — زي "1¼" أو "½" — وإلا بترجع الرقم عادي.
 */
export function formatQty(qty) {
  const whole = Math.floor(qty)
  const rawFrac = qty - whole
  const nearestQuarter = Math.round(rawFrac * 4) / 4
  const isCloseToQuarter = Math.abs(rawFrac - nearestQuarter) < 0.01

  const fractionGlyphs = { 0.25: '¼', 0.5: '½', 0.75: '¾' }
  const glyph = isCloseToQuarter ? fractionGlyphs[nearestQuarter] : null

  if (!glyph) return String(Math.round(qty * 1000) / 1000)
  return whole > 0 ? `${whole}${glyph}` : glyph
}
