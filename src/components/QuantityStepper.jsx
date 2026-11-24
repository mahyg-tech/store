import './QuantityStepper.css'
import { formatQty } from '../utils/qty'

export default function QuantityStepper({ qty, onChange, size = 'md', max, min = 1, step = 1 }) {
  const hasMax = typeof max === 'number'
  const atMax = hasMax && qty >= max

  // النزول لأقل من الحد الأدنى مش مسموح — بدل ما الزرار يتعطل، ضغطة
  // واحدة على "-" وإحنا عند الحد الأدنى بتشيل الصنف من السلة بالكامل
  // (زي ما كان بيحصل قبل كده أصلاً لما كانت الكمية توصل صفر)
  function decrease() {
    const next = qty - step
    if (next < min - 0.0001) {
      onChange(0)
    } else {
      onChange(snap(next))
    }
  }

  function increase() {
    if (atMax) return
    const next = qty + step
    onChange(hasMax ? Math.min(next, max) : next)
  }

  function snap(value) {
    return Math.round(value * 1000) / 1000
  }

  return (
    <div className={`stepper stepper--${size}`}>
      <button
        type="button"
        className="stepper__btn"
        aria-label="تقليل الكمية"
        onClick={decrease}
      >
        −
      </button>
      <span className="stepper__value" aria-live="polite">{formatQty(qty)}</span>
      <button
        type="button"
        className="stepper__btn"
        aria-label="زيادة الكمية"
        onClick={increase}
        disabled={atMax}
      >
        +
      </button>
    </div>
  )
}
