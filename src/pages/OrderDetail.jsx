import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Banknote, Wallet as WalletIcon } from 'lucide-react'
import * as api from '../api/client'
import { formatQty } from '../utils/qty'
import { formatMoney } from '../utils/money'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import './OrderDetail.css'

const STATUS_STEPS = ['قيد المراجعة', 'جاري التجهيز', 'خرج للتوصيل', 'اتسلم']
const VOID_STATUSES = ['ملغي', 'مرتجع بالكامل']

const PAYMENT_LABELS = {
  cash: 'كاش عند الاستلام',
  wallet: 'المحفظة',
  mixed: 'المحفظة + كاش عند الاستلام',
}

export default function OrderDetail() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    api
      .fetchOrder(orderId)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderId])

  async function handleCancel(reason) {
    setCancelBusy(true)
    setCancelError('')
    try {
      await api.cancelOrder(orderId, reason)
      const fresh = await api.fetchOrder(orderId).catch(() => null)
      setOrder((prev) => fresh || { ...prev, status: 'ملغي', cancelReason: reason, canCancel: false })
      setCancelOpen(false)
      showToast('اتلغى الطلب')
    } catch (err) {
      setCancelError(err.message || 'حصل خطأ، حاول تاني')
    } finally {
      setCancelBusy(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="تفاصيل الطلب" />
        <div className="container">
          <div className="skeleton" style={{ height: 120, marginBottom: 'var(--sp-4)' }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader title="تفاصيل الطلب" />
        <p className="container text-muted">{error || 'الطلب ده مش موجود'}</p>
      </div>
    )
  }

  const currentStepIndex = Math.max(0, STATUS_STEPS.indexOf(order.status))

  // الدفع: walletAmount = اللي لسه مدفوع من المحفظة (بعد أي استرجاع)،
  // cashDue = اللي هيتدفع كاش عند التسليم (السيرفر بيحسبهم). أوردرات قديمة
  // من غير الحقول دي بتتعامل كاش بالكامل.
  const paymentMethod = PAYMENT_LABELS[order.paymentMethod] ? order.paymentMethod : 'cash'
  const walletPaid = Number(order.walletAmount) || 0
  const walletRefunded = Number(order.walletRefunded) || 0
  const isVoid = VOID_STATUSES.includes(order.status)
  const cashDue = order.cashDue != null ? Number(order.cashDue) : Math.max(0, order.total - walletPaid)
  // لو السيرفر مبعتش canCancel (نسخة قديمة) نحسبها من الحالة
  const canCancel = order.canCancel ?? !['اتسلم', ...VOID_STATUSES].includes(order.status)
  const PaymentIcon = paymentMethod === 'cash' ? Banknote : WalletIcon

  return (
    <div>
      <PageHeader title={`طلب #${order.id.slice(-5)}`} />

      <div className="container">
        {order.lastEditNote && !isVoid && (
          <div className="card od-section" role="status">
            <p className="od-section__title">اتعدّل طلبك</p>
            <p className="text-muted">{order.lastEditNote}</p>
          </div>
        )}

        {order.status === 'ملغي' && order.cancelReason && (
          <div className="card od-section" role="status">
            <p className="od-section__title">سبب الإلغاء</p>
            <p className="text-muted">{order.cancelReason}</p>
          </div>
        )}

        <div className="card od-timeline">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className={`od-step${i <= currentStepIndex ? ' od-step--done' : ''}`}>
              <span className="od-step__dot" aria-hidden="true" />
              <span className="od-step__label">{step}</span>
            </div>
          ))}
        </div>

        <div className="card od-section">
          <p className="od-section__title">عنوان التوصيل</p>
          <p className="text-muted">{order.address}</p>
          <p className="text-muted">{order.phone}</p>
          {order.notes && <p className="text-caption">ملاحظات: {order.notes}</p>}
        </div>

        <div className="card od-section">
          <p className="od-section__title">المنتجات</p>
          <ul className="od-items">
            {order.items.map((item) => (
              <li key={item.id} className="row row--between">
                <span>{item.name} × {formatQty(item.qty)}</span>
                <span>{item.price * item.qty} ج.م</span>
              </li>
            ))}
          </ul>
          <div className="od-items__divider" />
          <div className="row row--between">
            <span className="text-muted">الإجمالي</span>
            <span>{order.subtotal} ج.م</span>
          </div>
          <div className="row row--between">
            <span className="text-muted">التوصيل</span>
            <span>{order.deliveryFee === 0 ? 'مجاني' : `${order.deliveryFee} ج.م`}</span>
          </div>
          <div className="row row--between" style={{ fontWeight: 700, marginTop: 'var(--sp-1)' }}>
            <span>الإجمالي الكلي</span>
            <span className="price">{order.total} ج.م</span>
          </div>
        </div>

        <div className="card od-section">
          <p className="od-section__title">الدفع</p>
          <div className="row row--between">
            <span className="text-muted">طريقة الدفع</span>
            <span className="row" style={{ gap: 'var(--sp-1)' }}>
              <PaymentIcon size={18} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
              {PAYMENT_LABELS[paymentMethod]}
            </span>
          </div>
          {walletPaid > 0 && (
            <div className="row row--between">
              <span className="text-muted">مدفوع من المحفظة</span>
              <span>{formatMoney(walletPaid)} ج.م</span>
            </div>
          )}
          {walletRefunded > 0 && (
            <div className="row row--between" style={{ color: 'var(--color-olive-500)', fontWeight: 600 }}>
              <span>اتسترجع لمحفظتك</span>
              <span>{formatMoney(walletRefunded)} ج.م</span>
            </div>
          )}
          {!isVoid && walletPaid > 0 && (
            <div className="row row--between" style={{ fontWeight: 700 }}>
              <span>{cashDue > 0 ? 'كاش عند الاستلام' : 'الحالة'}</span>
              <span>{cashDue > 0 ? `${formatMoney(cashDue)} ج.م` : 'مدفوع بالكامل'}</span>
            </div>
          )}
        </div>

        {canCancel && (
          <button
            type="button"
            className="btn btn--outline btn--block"
            style={{ marginTop: 'var(--sp-4)', color: '#c0392b', borderColor: '#c0392b' }}
            onClick={() => {
              setCancelError('')
              setCancelOpen(true)
            }}
          >
            إلغاء الطلب
          </button>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        danger
        requireReason
        busy={cancelBusy}
        error={cancelError}
        title="إلغاء الطلب"
        message="هنلغي الطلب ده ونرجّع فلوس المحفظة لو دفعت منها. اكتب سبب الإلغاء."
        reasonLabel="سبب الإلغاء (إجباري)"
        reasonPlaceholder="مثال: طلبت بالغلط"
        confirmLabel="تأكيد الإلغاء"
        cancelLabel="رجوع"
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </div>
  )
}
