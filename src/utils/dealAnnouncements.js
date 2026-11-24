// =============================================================================
// رسايل "المساعد بيبلّغ العميل بالعرض" — دوال بحتة (من غير React ولا صوت)،
// بتحوّل العروض (deals من DealsContext) لسطور نص جاهزة للعرض في فقاعة
// المساعد (components/AssistantOfferBubble.jsx) وللنطق بصوت عالي
// (context/AssistantAnnounceContext.jsx).
//
// فيه حالتين بيتبلّغ فيهم العميل:
//  1) فتح صفحة صنف عليه عرض  → buildProductViewLines (بتشرح العرض بس)
//  2) إضافة صنف عليه عرض للسلة → buildCartAddLines (بتحسب من كمية السلة
//     الفعلية: لسه فاضل كام على العرض، أو العرض اتفعّل فعلاً)
//
// العروض متخزّنة بمعرّف "الوحدة" (unit id) مش الصنف المجمّع — نفس فكرة
// utils/deals.js بالظبط، عشان كده المطابقة هنا على units[].id.
// =============================================================================
import { getEffectiveUnitPrice, getNextTierHint, explainDeal } from './deals'
import { formatQty } from './qty'

const num = (v) => Number(v)

/**
 * الوحدات اللي العرض "بيتفعّل" لما العميل يشتريها — يعني اللي المفروض
 * نبلّغه بالعرض لما يفتحها أو يضيفها:
 *  - خصم كمية: الوحدة نفسها
 *  - هدية: وحدة الشراء بس (وحدة الهدية المجانية مش هي اللي بتفعّل العرض)
 *  - تشكيلة: أي وحدة داخلة في التشكيلة
 */
export function getTriggerUnitIds(deal) {
  if (!deal?.config) return []
  if (deal.type === 'tiered') return deal.config.productId ? [deal.config.productId] : []
  if (deal.type === 'free_gift') return deal.config.buyProductId ? [deal.config.buyProductId] : []
  if (deal.type === 'bundle') return Array.isArray(deal.config.productIds) ? deal.config.productIds : []
  return []
}

/** عرض سليم بما يكفي إننا نقرأه للعميل من غير ما يطلع "undefined" في النص */
function isAnnounceable(deal) {
  if (!deal || !deal.isActive || !deal.config) return false
  const c = deal.config
  if (deal.type === 'tiered') return Array.isArray(c.tiers) && c.tiers.length > 0
  if (deal.type === 'free_gift') return num(c.buyQty) > 0 && num(c.freeQty) > 0
  if (deal.type === 'bundle') {
    return num(c.minTotalQty) > 0 && c.bundlePrice != null && Array.isArray(c.productIds) && c.productIds.length > 0
  }
  return false
}

/** كل العروض الفعّالة والسليمة اللي بتنطبق على وحدة معينة */
export function getDealsForUnit(deals, unitId) {
  return (deals || []).filter((d) => isAnnounceable(d) && getTriggerUnitIds(d).includes(unitId))
}

/** شرح العرض للعميل وهو فاتح صفحة الصنف (نفس نصوص explainDeal، بس التشكيلة بتاخد اسمها) */
function describeDealForView(deal) {
  if (deal.type === 'bundle') {
    const { minTotalQty, bundlePrice } = deal.config
    return `${deal.title} — اشتري أي ${minTotalQty} من التشكيلة بـ ${bundlePrice} ج.م بس`
  }
  return explainDeal(deal)
}

/**
 * سطور الفقاعة لما العميل يفتح صفحة صنف. product = الصنف المجمّع اللي
 * ProductDetail شايله (units[] لكل وحدة بيع). بترجع [] لو مفيش عرض.
 */
export function buildProductViewLines(deals, product) {
  if (!product) return []
  const units = product.units && product.units.length > 0 ? product.units : [product]
  const multiUnit = units.length > 1

  const seen = new Set()
  const details = []
  for (const unit of units) {
    for (const deal of getDealsForUnit(deals, unit.id)) {
      // تشكيلة ممكن تضم أكتر من وحدة من نفس الصنف — منقولش نفس العرض مرتين
      if (seen.has(deal.id)) continue
      seen.add(deal.id)
      const text = describeDealForView(deal)
      details.push(multiUnit && unit.unit ? `على ${unit.unit}: ${text}` : text)
    }
  }

  if (details.length === 0) return []
  return [details.length > 1 ? 'الصنف ده عليه عروض 🎉' : 'الصنف ده عليه عرض 🎉', ...details]
}

/** جملة عن العرض بالنسبة لكمية السلة الحالية، أو null لو مفيش حاجة مفيدة تتقال */
function describeDealForCart(deal, item, cartItems) {
  const c = deal.config

  if (deal.type === 'tiered') {
    const effective = getEffectiveUnitPrice(deal, item.price, item.qty)
    const next = getNextTierHint(deal, item.qty)
    const active = effective < item.price
    if (active && next) {
      return `عرض الكمية اتفعّل 🎉 الوحدة بقت بـ ${effective} ج.م بدل ${item.price} — وكمّل ${formatQty(next.remaining)} كمان تاخدها بـ ${next.unitPrice} ج.م`
    }
    if (active) return `عرض الكمية اتفعّل 🎉 الوحدة بقت بـ ${effective} ج.م بدل ${item.price} ج.م`
    if (next) return `عليه عرض كمية 🎉 كمّل ${formatQty(next.remaining)} كمان وهتاخد الوحدة بـ ${next.unitPrice} ج.م`
    return null
  }

  if (deal.type === 'free_gift') {
    const buyQty = num(c.buyQty)
    const freeQty = num(c.freeQty)
    const timesEarned = Math.floor(item.qty / buyQty)
    if (timesEarned > 0) return `مبروك، كسبت ${formatQty(timesEarned * freeQty)} هدية مجانًا 🎁`
    return `عليه عرض هدية 🎁 كمّل ${formatQty(buyQty - item.qty)} كمان وخد ${formatQty(freeQty)} مجانًا`
  }

  if (deal.type === 'bundle') {
    const min = num(c.minTotalQty)
    const totalQty = (cartItems || [])
      .filter((i) => c.productIds.includes(i.id))
      .reduce((sum, i) => sum + i.qty, 0)
    if (totalQty >= min) return `عرض "${deal.title}" اتفعّل 🎉 كل ${min} من التشكيلة بـ ${c.bundlePrice} ج.م`
    return `ضمن عرض "${deal.title}" 🎉 كمّل ${formatQty(min - totalQty)} كمان من التشكيلة وخد ${min} بـ ${c.bundlePrice} ج.م بس`
  }

  return null
}

/**
 * سطور الفقاعة لما العميل يضيف صنف للسلة. item = سطر السلة (CartContext)،
 * cartItems = كل السلة (لازمة لحساب عروض التشكيلة). بترجع [] لو الصنف
 * مالوش عرض يتقال.
 */
export function buildCartAddLines(deals, item, cartItems) {
  if (!item) return []
  const details = []
  for (const deal of getDealsForUnit(deals, item.id)) {
    const line = describeDealForCart(deal, item, cartItems)
    if (line) details.push(line)
  }
  if (details.length === 0) return []
  return [`"${item.name}" اتضاف للسلة ✅`, ...details]
}

/**
 * السطور → نص واحد للنطق. النص هنا خام (بإيموجي وأرقام وج.م) — الـ plugin
 * (capacitor-egyptian-tts) هو اللي بيحوّله لكلام مصري قبل ما ينطقه. مستخدمة
 * في النطق وفي الـ prefetch بنفس الشكل بالظبط، عشان الصوت المتحمّل مقدّمًا
 * يطابق الجملة اللي هتتنطق فعلاً (نفس مفتاح الكاش).
 */
export function linesToSpeech(lines) {
  return (lines || []).filter(Boolean).join('. ')
}

/**
 * نصوص "فتح صفحة الصنف" لكل عرض فعّال (شكل الصنف ذو الوحدة الواحدة، وهو
 * الأشهر)، عشان تتنزّل مقدّمًا وأول ما العميل يفتح الصنف الصوت يشتغل فورًا
 * من غير انتظار توليد من السيرفر. نفس النص اللي بيتنطق في buildProductViewLines.
 */
export function buildDealPrefetchTexts(deals) {
  const texts = []
  for (const deal of deals || []) {
    if (!isAnnounceable(deal) || getTriggerUnitIds(deal).length === 0) continue
    texts.push(linesToSpeech(['الصنف ده عليه عرض 🎉', describeDealForView(deal)]))
  }
  return [...new Set(texts)]
}
