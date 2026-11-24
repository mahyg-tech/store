import { useEffect, useRef } from 'react'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { useAssistantAnnounce } from '../context/AssistantAnnounceContext'
import { buildCartAddLines, buildDealPrefetchTexts } from '../utils/dealAnnouncements'
import { prefetchSpeech } from '../utils/egyptianVoice'

// بيراقب السلة: أي صنف بيتضاف لأول مرة (كميته كانت صفر/مش موجود وبقت أكتر
// من صفر) وعليه عرض، المساعد يبلّغ العميل بالعرض بالنسبة لكميته الحالية
// (لسه فاضل كام، أو العرض اتفعّل). بيشتغل مع أي مصدر إضافة: زرار + في كارت
// الصنف، زرار "إضافة للسلة" في صفحة الصنف، أو أمر المساعد الصوتي — من غير
// ما نلمس أي حاجة منهم. مبيتكلمش لما كمية صنف موجود أصلاً بتزيد بالستيبر
// (عشان مايبقاش رغّي مع كل ضغطة)، ولا لما السلة تتحمّل من التخزين أول
// ما التطبيق يفتح.
const CART_COOLDOWN_MS = 60 * 1000
const MAX_LINES = 4
// أقصى عدد جمل "فتح الصنف" بنجهّزها مقدّمًا — الجمل اللي اتنزّلت قبل كده بتيجي من
// الكاش (مجانًا)، فبيدفع تكلفتها أول عميل بس. الحد ده بيحمي رصيد أول عميل اليومي.
const PREFETCH_MAX = 8

export default function DealAnnouncer() {
  const { items } = useCart()
  const { deals } = useDeals()
  const { announce } = useAssistantAnnounce()
  const prevQtyRef = useRef(null) // Map: unitId -> qty في آخر مرة

  // أول ما العروض توصل: نجهّز صوت جمل "فتح الصنف" مقدّمًا عشان تشتغل فورًا
  useEffect(() => {
    if (!deals || deals.length === 0) return
    prefetchSpeech(buildDealPrefetchTexts(deals).slice(0, PREFETCH_MAX))
  }, [deals])

  useEffect(() => {
    const prev = prevQtyRef.current
    prevQtyRef.current = new Map(items.map((i) => [i.id, i.qty]))

    // أول تشغيل = السلة المحمّلة من التخزين، مش إضافة جديدة
    if (prev === null || !deals || deals.length === 0) return

    const added = items.filter((i) => i.qty > 0 && !(prev.get(i.id) > 0))
    if (added.length === 0) return

    const lines = added.flatMap((item) => buildCartAddLines(deals, item, items))
    if (lines.length === 0) return

    announce({
      key: `cart:${added.map((i) => i.id).join(',')}`,
      lines: lines.slice(0, MAX_LINES),
      cooldownMs: CART_COOLDOWN_MS,
    })
  }, [items, deals, announce])

  return null
}
