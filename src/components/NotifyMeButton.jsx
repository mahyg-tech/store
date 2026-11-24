import { useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { useStockNotify } from '../context/StockNotifyContext'
import './NotifyMeButton.css'

// زرار "أخبرني لما يتوفر" — بيتلبّس 3 أشكال حسب مكان الاستخدام:
//  - icon:  دايرة صغيرة (30px) بتاخد مكان زرار "+" في كارت المنتج
//  - sm:    زرار صغير جنب "شيل من السلة" في صفحة الدفع
//  - block: زرار full-width بياخد مكان "إضافة للسلة" في صفحة تفاصيل المنتج
// الحالة (متسجل / لسه) وإرسال الطلب بيتعمل كله في StockNotifyContext —
// الكومبوننت ده واجهة بس.
export default function NotifyMeButton({ unitId, productName, unitLabel, variant = 'block' }) {
  const { isPending, requestNotify } = useStockNotify()
  const [sending, setSending] = useState(false)
  const pending = isPending(unitId)

  async function handleClick() {
    if (pending || sending) return
    setSending(true)
    try {
      await requestNotify(unitId, productName, unitLabel)
    } finally {
      setSending(false)
    }
  }

  const label = pending ? 'هنبلغك لما يتوفر' : 'أخبرني لما يتوفر'
  const Icon = pending ? BellRing : Bell

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`notify-btn notify-btn--icon${pending ? ' notify-btn--pending' : ''}`}
        onClick={handleClick}
        disabled={sending || pending}
        aria-label={`${label} — ${productName}${unitLabel ? ` (${unitLabel})` : ''}`}
      >
        <Icon size={15} strokeWidth={1.8} />
      </button>
    )
  }

  if (variant === 'sm') {
    return (
      <button
        type="button"
        className={`btn btn--outline btn--sm notify-btn${pending ? ' notify-btn--pending' : ''}`}
        onClick={handleClick}
        disabled={sending || pending}
      >
        <Icon size={14} strokeWidth={1.8} />
        {pending ? 'هنبلغك' : 'أخبرني'}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`btn btn--secondary btn--block notify-btn${pending ? ' notify-btn--pending' : ''}`}
      onClick={handleClick}
      disabled={sending || pending}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </button>
  )
}
