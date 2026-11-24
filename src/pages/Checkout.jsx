import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Wallet as WalletIcon } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { applyDealsToCart } from '../utils/deals'
import { getCurrentCoords } from '../utils/geolocation'
import { roundMoney, formatMoney, sanitizeMoneyInput, computeWalletPayment } from '../utils/money'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import NotifyMeButton from '../components/NotifyMeButton'
import './Checkout.css'

export default function Checkout() {
  const { items, removeItem, clearCart } = useCart()
  const { deals } = useDeals()
  const { customer } = useAuth()
  const { order: orderSettings } = useSettings()
  const navigate = useNavigate()
  // قيم افتراضية (نفس القديمة) لحد ما الإعدادات توصل من السيرفر
  const deliveryFeeAmount = orderSettings?.deliveryFee ?? 20
  const freeDeliveryThreshold = orderSettings?.freeDeliveryThreshold ?? 300
  const minOrderValue = orderSettings?.minOrderValue ?? 0

  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [savedAddress, setSavedAddress] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // حماية فورية من الإرسال المزدوج (ضغطتين سريعتين قبل ما الزرار يتعطّل، أو أي
  // إعادة إرسال للنموذج): setSubmitting بيتطبّق بعد إعادة الرسم، والـ ref لحظي.
  // مع الدفع بالمحفظة الإرسال المزدوج = خصم مرتين من رصيد العميل.
  const submitInFlight = useRef(false)
  const [error, setError] = useState('')
  // أصناف اتشالت أو تجاوزت الحد المسموح وقت إتمام الطلب فعليًا (رجعت من
  // السيرفر) — [{id, name, unit, reason: 'out_of_stock'|'limit', message}]
  const [unavailableItems, setUnavailableItems] = useState([])

  // الدفع: كاش عند الاستلام (الافتراضي)، أو من المحفظة — كله أو جزء بمبلغ
  // يحدده العميل والباقي كاش عند الاستلام. السيرفر هو اللي بيتحقق من الرصيد
  // الفعلي (orders-create.php)، اللي هنا مجرد عرض وتحقق مبدئي.
  const [payWith, setPayWith] = useState('cash') // 'cash' | 'wallet'
  const [walletInput, setWalletInput] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletStatus, setWalletStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false
    api
      .fetchWallet()
      .then((wallet) => {
        if (cancelled) return
        setWalletBalance(roundMoney(wallet?.balance))
        setWalletStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setWalletStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // العنوان المحفوظ من صفحة "عناويني" (لو موجود) — بيتملى بيه العنوان
  // والتليفون تلقائيًا لو العميل لسه ماكتبش حاجة
  useEffect(() => {
    let cancelled = false
    api
      .fetchAddress()
      .then((saved) => {
        if (cancelled || !saved) return
        setSavedAddress(saved)
        setAddress((current) => current || saved.addressText)
        if (saved.phone) setPhone((current) => current || saved.phone)
      })
      .catch(() => {
        /* عنوان محفوظ مجرد تسهيل — لو فشل الجلب، العميل يقدر يكتب عنوانه يدويًا عادي */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { lines, freeLines, subtotal } = applyDealsToCart(items, deals)
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : deliveryFeeAmount
  const grandTotal = roundMoney(subtotal + deliveryFee)
  const belowMinOrder = minOrderValue > 0 && subtotal < minOrderValue

  const balance = walletStatus === 'ready' ? walletBalance : 0
  const walletUsable = walletStatus === 'ready' && balance >= 0.01 && grandTotal > 0
  const pay = computeWalletPayment({ payWith, input: walletInput, balance, grandTotal })

  function choosePayment(next) {
    if (next === 'wallet') {
      if (!walletUsable) return
      // أول ما العميل يختار المحفظة نقترح أقصى مبلغ ينفع، وهو يقدر يقلّله
      setWalletInput(formatMoney(pay.max))
    }
    setPayWith(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitInFlight.current) return
    if (belowMinOrder) return // الزرار متعطل أصلاً، ده احتياط بس (السيرفر هو اللي بيتأكد فعليًا)
    setError('')
    setUnavailableItems([])
    if (payWith === 'wallet' && pay.error) {
      // الرسالة ظاهرة أصلاً تحت خانة المبلغ — منكرّرهاش، بس نودّي العميل للخانة
      document.getElementById('wallet-amount')?.focus()
      return
    }
    submitInFlight.current = true
    setSubmitting(true)
    try {
      // نبعت الأسعار الفعلية بعد أي خصم كمية، وسطور الهدايا المجانية
      // بسعر صفر — عشان الفاتورة المسجّلة تعكس المدفوع فعليًا بالظبط
      const orderItems = [
        ...lines.map((l) => ({ id: l.id, name: l.name, price: l.unitPrice, unit: l.unit, qty: l.qty })),
        ...freeLines.map((g) => ({ id: g.productId || g.id, name: `${g.name} (هدية)`, price: 0, unit: '', qty: g.qty })),
      ]
      // بنرفع إحداثيات موقع العميل لحظة تأكيد الطلب (زي elmahi-sales) —
      // best effort، لو رفض إذن الموقع الأوردر بيتبعت عادي من غيرها.
      const coords = await getCurrentCoords()
      const order = await api.submitOrder({
        items: orderItems,
        address,
        phone,
        notes,
        paymentMethod: pay.method,
        // المبلغ اللي العميل اختار يدفعه من المحفظة (0 = كاش بالكامل). السيرفر
        // بيتحقق منه من الرصيد الفعلي وبيرجّع الأرقام النهائية.
        walletAmount: pay.walletAmount,
        subtotal: roundMoney(subtotal),
        deliveryFee,
        total: grandTotal,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      })
      clearCart()
      navigate(`/order-success/${order.id}`, {
        replace: true,
        state: {
          payment: {
            method: order.paymentMethod ?? pay.method,
            walletAmount: order.walletAmount ?? pay.walletAmount,
            cashDue: order.cashDue ?? pay.cashDue,
          },
        },
      })
    } catch (err) {
      if (err.data?.code === 'wallet_insufficient') {
        // الرصيد الفعلي على السيرفر أقل من اللي كان معروض (اتصرف منه في مكان
        // تاني مثلًا) — نحدّث الرصيد ونصحّح المبلغ بدل ما نسيب العميل يعيد المحاولة أعمى
        const fresh = roundMoney(err.data.balance)
        const newMax = roundMoney(Math.min(fresh, grandTotal))
        setWalletBalance(fresh)
        setWalletStatus('ready')
        if (newMax >= 0.01) setWalletInput(formatMoney(newMax))
        else setPayWith('cash')
        setError(err.message)
      } else if (err.data?.items?.length) {
        // السيرفر بيرجع تفاصيل الأصناف اللي نفدت كميتها أو تجاوزت الحد
        // المسموح وقت إتمام الطلب فعليًا (شوف orders-create.php) — بنعرضها
        // واحد واحد بدل رسالة عامة.
        setUnavailableItems(err.data.items)
        setError(err.message || 'في أصناف في السلة مش متاحة دلوقتي')
      } else {
        setError(err.message || 'حصل خطأ وإحنا بنبعت الطلب، حاول تاني')
      }
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  function handleRemoveUnavailable(itemId) {
    removeItem(itemId)
    setUnavailableItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const usingWallet = pay.walletAmount > 0
  const walletOptionHint =
    walletStatus === 'loading'
      ? 'بنجيب رصيدك…'
      : walletStatus === 'error'
        ? 'مقدرناش نحمّل رصيدك دلوقتي'
        : `رصيدك ${formatMoney(balance)} ج.م`

  const submitLabel = belowMinOrder
    ? `الحد الأدنى للطلب ${formatMoney(minOrderValue)} ج.م`
    : submitting
    ? 'بنأكد الطلب…'
    : !usingWallet
      ? `تأكيد الطلب — ${formatMoney(grandTotal)} ج.م`
      : pay.cashDue <= 0
        ? 'تأكيد الطلب — مدفوع بالمحفظة'
        : `تأكيد الطلب — ${formatMoney(pay.cashDue)} ج.م كاش`

  return (
    <div>
      <PageHeader title="إتمام الطلب" />

      <form className="container checkout-form" onSubmit={handleSubmit}>
        {savedAddress && (
          <p className="checkout-saved-address-note">
            📍 اتملى عنوانك المحفوظ تلقائيًا —{' '}
            <Link to="/addresses" state={{ backTo: '/checkout' }} className="checkout-saved-address-note__link">تعديله</Link>
          </p>
        )}

        <div className="field">
          <label htmlFor="address">عنوان التوصيل</label>
          <textarea
            id="address"
            rows={3}
            placeholder="الحي، الشارع، رقم العقار، علامة مميزة…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="phone">رقم موبايل للتواصل</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="notes">ملاحظات (اختياري)</label>
          <textarea
            id="notes"
            rows={2}
            placeholder="مثال: اتصل قبل ما توصل"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="checkout-payment card">
          <p style={{ fontWeight: 600 }}>طريقة الدفع</p>

          <label
            className={`checkout-payment__option${payWith === 'cash' ? ' checkout-payment__option--selected' : ''}`}
          >
            <input
              type="radio"
              name="payWith"
              value="cash"
              className="checkout-payment__radio"
              checked={payWith === 'cash'}
              onChange={() => choosePayment('cash')}
            />
            <Banknote size={20} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
            <span className="checkout-payment__text">
              <span>الدفع كاش عند الاستلام</span>
            </span>
          </label>

          <label
            className={
              'checkout-payment__option' +
              (payWith === 'wallet' ? ' checkout-payment__option--selected' : '') +
              (walletUsable ? '' : ' checkout-payment__option--disabled')
            }
          >
            <input
              type="radio"
              name="payWith"
              value="wallet"
              className="checkout-payment__radio"
              checked={payWith === 'wallet'}
              disabled={!walletUsable}
              onChange={() => choosePayment('wallet')}
            />
            <WalletIcon size={20} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
            <span className="checkout-payment__text">
              <span>الدفع بالمحفظة</span>
              <span className="text-caption text-muted">{walletOptionHint}</span>
            </span>
          </label>

          {walletStatus === 'ready' && balance < 0.01 && (
            <p className="text-caption text-muted">
              محفظتك فاضية دلوقتي — <Link to="/wallet" state={{ backTo: '/checkout' }}>افتح المحفظة</Link> لو عايز تشحنها.
            </p>
          )}

          {payWith === 'wallet' && (
            <div className="checkout-wallet">
              <label htmlFor="wallet-amount" className="checkout-wallet__label">
                المبلغ اللي هتدفعه من المحفظة
              </label>
              <div className="checkout-wallet__row">
                <input
                  id="wallet-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={walletInput}
                  onChange={(e) => setWalletInput(sanitizeMoneyInput(e.target.value))}
                  aria-invalid={Boolean(pay.error)}
                  aria-describedby="wallet-amount-note"
                />
                <span className="checkout-wallet__unit">ج.م</span>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => setWalletInput(formatMoney(pay.max))}
                >
                  {pay.max >= grandTotal ? 'الطلب كله' : 'أقصى مبلغ'}
                </button>
              </div>
              <p
                id="wallet-amount-note"
                className={`text-caption ${pay.error ? 'checkout-wallet__error' : 'checkout-wallet__hint'}`}
                role={pay.error ? 'alert' : undefined}
              >
                {pay.error ||
                  (usingWallet
                    ? pay.cashDue <= 0
                      ? 'هتدفع الطلب كله من المحفظة — مفيش كاش عند الاستلام'
                      : `الباقي ${formatMoney(pay.cashDue)} ج.م كاش عند الاستلام`
                    : '')}
              </p>
            </div>
          )}
        </div>

        <div className="checkout-summary card">
          <div className="row row--between">
            <span className="text-muted">الإجمالي</span>
            <span>{formatMoney(subtotal)} ج.م</span>
          </div>
          <div className="row row--between">
            <span className="text-muted">التوصيل</span>
            <span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ج.م`}</span>
          </div>
          {usingWallet && (
            <>
              <div className="row row--between">
                <span className="text-muted">إجمالي الطلب</span>
                <span>{formatMoney(grandTotal)} ج.م</span>
              </div>
              <div className="row row--between checkout-summary__wallet">
                <span>من المحفظة</span>
                <span>− {formatMoney(pay.walletAmount)} ج.م</span>
              </div>
            </>
          )}
          <div className="row row--between checkout-summary__total">
            <span>{usingWallet ? 'الكاش المطلوب عند الاستلام' : 'المطلوب دفعه'}</span>
            <span className="price">{pay.cashDue <= 0 ? 'مدفوع بالكامل' : `${formatMoney(pay.cashDue)} ج.م`}</span>
          </div>
        </div>

        {unavailableItems.length > 0 ? (
          <div
            className="card"
            role="alert"
            style={{ background: '#fdecea', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
          >
            <p style={{ fontWeight: 600, color: '#b3261e' }}>{error}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {unavailableItems.map((it) => (
                <li key={it.id} className="row row--between" style={{ gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>
                      {it.name}
                      {it.unit ? ` (${it.unit})` : ''}
                    </p>
                    <p className="text-caption" style={{ color: '#b3261e' }}>
                      {it.reason === 'out_of_stock' ? 'للأسف نفدت الكمية' : it.message}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 'var(--sp-2)' }}>
                    {it.reason === 'out_of_stock' && (
                      <NotifyMeButton unitId={it.id} productName={it.name} unitLabel={it.unit} variant="sm" />
                    )}
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => handleRemoveUnavailable(it.id)}
                    >
                      شيل من السلة
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          error && <p className="login__error" role="alert">{error}</p>
        )}

        {belowMinOrder && (
          <p className="login__error" role="alert" style={{ marginBottom: 'var(--sp-2)' }}>
            الحد الأدنى لقيمة الطلب {minOrderValue} ج.م — ضيف {roundMoney(minOrderValue - subtotal)} ج.م كمان من السلة
          </p>
        )}
        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={submitting || belowMinOrder || (payWith === 'wallet' && Boolean(pay.error))}
        >
          {submitLabel}
        </button>
      </form>
    </div>
  )
}
