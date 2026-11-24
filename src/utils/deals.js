// =============================================================================
// منطق تطبيق العروض على السلة — كل حسابات الأسعار هنا شغالة على مستوى
// "الوحدة المحددة" (unit id، زي 'retail_001001_بالتة_0')، مش المنتج
// المجمّع، لأن السعر والعرض بيختلفوا باختلاف الوحدة (علبة/كرتونة).
// =============================================================================

export function getTieredDeal(deals, unitId) {
  return deals.find((d) => d.type === 'tiered' && d.isActive && d.config.productId === unitId) || null
}

export function getFreeGiftDealsFor(deals, unitId) {
  return deals.filter((d) => d.type === 'free_gift' && d.isActive && d.config.buyProductId === unitId)
}

export function getBundleDeals(deals) {
  return deals.filter((d) => d.type === 'bundle' && d.isActive)
}

/** السعر الفعلي للوحدة عند كمية معينة، بعد تطبيق أعلى درجة خصم كمية تنطبق */
export function getEffectiveUnitPrice(deal, basePrice, qty) {
  if (!deal || !deal.config.tiers?.length) return basePrice
  const tiers = [...deal.config.tiers].sort((a, b) => b.minQty - a.minQty)
  const applicable = tiers.find((t) => qty >= t.minQty)
  return applicable ? applicable.unitPrice : basePrice
}

/** أقرب درجة سعر جاية لسه ما اتحققتش — لعرض تلميح "كمّل لـ..." */
export function getNextTierHint(deal, qty) {
  if (!deal || !deal.config.tiers?.length) return null
  const tiers = [...deal.config.tiers].sort((a, b) => a.minQty - b.minQty)
  const next = tiers.find((t) => qty < t.minQty)
  if (!next) return null
  return { remaining: next.minQty - qty, minQty: next.minQty, unitPrice: next.unitPrice }
}

/**
 * بتطبّق كل العروض على عناصر السلة (items من CartContext)، وترجع:
 * - lines: نفس العناصر بعد إضافة unitPrice/lineTotal الفعليين (بعد خصم الكمية)
 * - freeLines: سطور هدايا مجانية مستحقة (مش جزء من السلة التفاعلية، بس بتتضاف للطلب)
 * - subtotal: الإجمالي النهائي بعد كل الخصومات
 * - messages: رسايل توضيحية قصيرة لعرضها للعميل (وفّرت كذا بسبب عرض كذا)
 */
export function applyDealsToCart(items, deals) {
  const messages = []

  const lines = items.map((item) => {
    const deal = getTieredDeal(deals, item.id)
    const unitPrice = getEffectiveUnitPrice(deal, item.price, item.qty)
    const lineTotal = unitPrice * item.qty
    if (deal && unitPrice < item.price) {
      messages.push(`${item.name}: سعر خاص ${unitPrice} ج.م للوحدة — وفّرت ${(item.price - unitPrice) * item.qty} ج.م`)
    }
    return { ...item, unitPrice, lineTotal }
  })

  let subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)

  const freeLines = []
  for (const item of items) {
    for (const deal of getFreeGiftDealsFor(deals, item.id)) {
      const { buyQty, freeProductId, freeQty } = deal.config
      const timesEarned = Math.floor(item.qty / buyQty)
      if (timesEarned <= 0) continue
      const totalFreeQty = timesEarned * freeQty
      const freeProduct = items.find((i) => i.id === freeProductId)
      const freeName = freeProduct ? freeProduct.name : item.name
      freeLines.push({ id: `free-${deal.id}-${item.id}`, productId: freeProductId, name: freeName, qty: totalFreeQty, isGift: true })
      messages.push(`هدية: ${totalFreeQty} × ${freeName} مجانًا (${deal.title})`)
    }
  }

  for (const deal of getBundleDeals(deals)) {
    const { productIds, minTotalQty, bundlePrice } = deal.config
    const participating = lines.filter((l) => productIds.includes(l.id))
    const totalQty = participating.reduce((s, l) => s + l.qty, 0)
    const bundlesCount = Math.floor(totalQty / minTotalQty)
    if (bundlesCount <= 0 || totalQty === 0) continue

    const avgUnitPrice = participating.reduce((s, l) => s + l.unitPrice * l.qty, 0) / totalQty
    const normalPriceForBundles = avgUnitPrice * minTotalQty * bundlesCount
    const discount = normalPriceForBundles - bundlePrice * bundlesCount

    if (discount > 0) {
      subtotal -= discount
      messages.push(`${deal.title}: وفّرت ${Math.round(discount)} ج.م`)
    }
  }

  return { lines, freeLines, subtotal: Math.max(0, Math.round(subtotal)), messages }
}

/** بترجع كل الوحدات (unit ids) اللي عرض معين بيتعلق بيها، أيًا كان نوعه */
export function getDealUnitIds(deal) {
  if (!deal?.config) return []
  if (deal.type === 'tiered') {
    return deal.config.productId ? [deal.config.productId] : []
  }
  if (deal.type === 'free_gift') {
    return [...new Set([deal.config.buyProductId, deal.config.freeProductId].filter(Boolean))]
  }
  if (deal.type === 'bundle') {
    return [...new Set(deal.config.productIds || [])]
  }
  return []
}

/**
 * ⚠️ تخمين احتياطي بس: العروض متخزّنة بمعرّف "الوحدة" (unit id)، مش
 * معرّف "الصنف" اللي صفحة تفاصيل المنتج محتاجاه. الأصل إن الباك إند
 * يرجّع deal.productIds جاهزة (بعد تحديث deals.php ليحسبها بنفسه —
 * شوف resolve_deal_product_ids في deals-helpers.php)؛ الدالة دي بترجع
 * افتراض بسيط (أول جزئين قبل الشرطة السفلية) بس لو الباك إند لسه
 * مايرجعش deal.productIds (نسخة قديمة) — مش مضمونة تشتغل صح لأي شكل id.
 */
export function guessProductIdFromUnitId(unitId) {
  if (!unitId) return null
  const parts = String(unitId).split('_')
  return parts.length > 1 ? parts.slice(0, 2).join('_') : unitId
}

/**
 * بترجع id بتاع صفحة كل صنف (/product/:id) عرض معين بيتعلق بيه. بتفضّل
 * deal.productIds لو الباك إند بيرجّعها جاهزة (دقيقة ١٠٠٪، محسوبة في
 * السيرفر)، وبترجع لتخمين guessProductIdFromUnitId بس لو مش موجودة
 * (توافق مع نسخة باك إند أقدم قبل تحديث deals.php).
 */
export function getDealProductIds(deal) {
  if (Array.isArray(deal?.productIds) && deal.productIds.length > 0) {
    return deal.productIds
  }
  return getDealUnitIds(deal).map(guessProductIdFromUnitId).filter(Boolean)
}

/** بتحوّل عرض لنص عربي بسيط يشرحه، مبني على نوعه وتفاصيله */
export function explainDeal(deal) {
  if (!deal?.config) return deal?.title || ''
  if (deal.type === 'tiered' && deal.config.tiers?.length) {
    const tiers = [...deal.config.tiers].sort((a, b) => a.minQty - b.minQty)
    return tiers.map((t) => `من ${t.minQty} كمان، السعر ${t.unitPrice} ج.م للوحدة`).join(' — ')
  }
  if (deal.type === 'free_gift') {
    const { buyQty, freeQty } = deal.config
    return `اشتري ${buyQty} وخد ${freeQty} هدية مجانًا 🎁`
  }
  if (deal.type === 'bundle') {
    const { minTotalQty, bundlePrice } = deal.config
    return `اشتري أي ${minTotalQty} من التشكيلة دي بـ ${bundlePrice} ج.م بس`
  }
  return deal.title || ''
}
