import { useParams, useLocation, Link } from 'react-router-dom'
import { formatMoney } from '../utils/money'
import './OrderSuccess.css'

export default function OrderSuccess() {
  const { orderId } = useParams()
  // ملخص الدفع بيجي من صفحة إتمام الطلب (state)، ومش موجود لو الصفحة اتفتحت مباشرة
  const payment = useLocation().state?.payment
  const walletAmount = Number(payment?.walletAmount) || 0
  const cashDue = Number(payment?.cashDue) || 0

  return (
    <div className="order-success">
      <div className="order-success__icon">✓</div>
      <h1>طلبك اتأكد!</h1>
      <p className="text-muted">هيوصلك خلال ساعة تقريبًا. هنتواصل معاك لو احتجنا أي توضيح.</p>
      <p className="text-caption">رقم الطلب: {orderId}</p>
      {walletAmount > 0 && (
        <p className="text-caption" data-testid="payment-summary">
          {cashDue > 0
            ? `اتدفع ${formatMoney(walletAmount)} ج.م من المحفظة، والباقي ${formatMoney(cashDue)} ج.م كاش عند الاستلام`
            : `اتدفع ${formatMoney(walletAmount)} ج.م من المحفظة — مفيش كاش عند الاستلام`}
        </p>
      )}

      <div className="order-success__actions">
        <Link to={`/orders/${orderId}`} className="btn btn--primary btn--block">
          تتبع الطلب
        </Link>
        <Link to="/" className="btn btn--outline btn--block">
          الرجوع للرئيسية
        </Link>
      </div>
    </div>
  )
}
