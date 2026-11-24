import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet as WalletIcon, Plus, Send } from 'lucide-react'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import { useToast } from '../context/ToastContext'
import './Wallet.css'

const TYPE_LABELS = {
  admin_credit: 'إضافة رصيد',
  admin_debit: 'خصم من لوحة التحكم',
  order_payment: 'دفع في أوردر',
  refund: 'استرجاع أوردر',
  transfer_out: 'تحويل لعميل تاني',
  transfer_in: 'تحويل من عميل تاني',
}

const TOPUP_METHOD_LABELS = {
  wallets: 'محافظ إلكترونية',
  instapay: 'إنستاباي',
}

const TOPUP_STATUS_LABELS = {
  pending: 'قيد المراجعة',
  approved: 'اتمّت',
  rejected: 'مرفوضة',
}

export default function Wallet() {
  const [wallet, setWallet] = useState(null)
  const [topupEnabled, setTopupEnabled] = useState(false)
  const [topups, setTopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  // تحويل رصيد لعميل تاني برقم موبايله
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferPhone, setTransferPhone] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferError, setTransferError] = useState('')
  const [transferSubmitting, setTransferSubmitting] = useState(false)

  useEffect(() => {
    Promise.allSettled([api.fetchWallet(), api.fetchSettings(), api.fetchWalletTopups()]).then((results) => {
      if (results[0].status === 'fulfilled') setWallet(results[0].value)
      else setError(results[0].reason?.message || 'حصل خطأ')

      if (results[1].status === 'fulfilled') setTopupEnabled(Boolean(results[1].value.walletTopupEnabled))
      if (results[2].status === 'fulfilled') setTopups(results[2].value)

      setLoading(false)
    })
  }, [])

  function openTransferForm() {
    setTransferPhone('')
    setTransferAmount('')
    setTransferError('')
    setShowTransfer(true)
  }

  async function handleTransferSubmit(e) {
    e.preventDefault()
    setTransferError('')

    if (!/^01[0-2,5]\d{8}$/.test(transferPhone)) {
      setTransferError('رقم الموبايل مش صحيح')
      return
    }
    const amountValue = Number(transferAmount)
    if (!amountValue || amountValue <= 0) {
      setTransferError('اكتب مبلغ صحيح')
      return
    }
    if (wallet && amountValue > wallet.balance) {
      setTransferError('رصيدك في المحفظة مش كفاية')
      return
    }

    setTransferSubmitting(true)
    try {
      const res = await api.transferWallet({ phone: transferPhone, amount: amountValue })
      setShowTransfer(false)
      showToast(`تم التحويل لـ ${res.recipientName || res.recipientPhone} ✅`)
      // نجيب بيانات المحفظة تاني عشان نعرض الرصيد وكشف الحساب المحدّثين
      // فعليًا من السيرفر بدل ما نبني العملية الجديدة يدويًا هنا
      const fresh = await api.fetchWallet()
      setWallet(fresh)
    } catch (err) {
      setTransferError(err.message || 'حصل خطأ في التحويل، جرب تاني')
    } finally {
      setTransferSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="محفظتي" />
      <div className="container wallet-page">
        {loading && <p className="text-muted">بيتحمّل…</p>}
        {error && !loading && <p className="login__error" role="alert">{error}</p>}

        {wallet && (
          <>
            <div className="wallet-balance-card">
              <WalletIcon size={26} strokeWidth={1.8} color="var(--color-white)" aria-hidden="true" />
              <div>
                <p className="wallet-balance-card__label">رصيدك الحالي</p>
                <p className="wallet-balance-card__amount">{wallet.balance.toFixed(2)} ج.م</p>
              </div>
            </div>

            {topupEnabled && (
              <Link to="/wallet/topup" className="btn btn--primary btn--block" style={{ marginBottom: 'var(--sp-5)' }}>
                <Plus size={18} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} aria-hidden="true" />
                شحن المحفظة
              </Link>
            )}

            {!showTransfer ? (
              <button
                type="button"
                className="btn btn--outline btn--block"
                style={{ marginBottom: 'var(--sp-5)' }}
                onClick={openTransferForm}
              >
                <Send size={18} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} aria-hidden="true" />
                تحويل رصيد لعميل تاني
              </button>
            ) : (
              <form
                className="wallet-transfer-form"
                onSubmit={handleTransferSubmit}
                style={{ marginBottom: 'var(--sp-5)' }}
              >
                <div className="field">
                  <label htmlFor="transfer-phone">رقم موبايل العميل المستلم</label>
                  <input
                    id="transfer-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="01xxxxxxxxx"
                    value={transferPhone}
                    onChange={(e) => setTransferPhone(e.target.value)}
                    maxLength={11}
                    autoFocus
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="transfer-amount">المبلغ (ج.م)</label>
                  <input
                    id="transfer-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                  />
                </div>
                {transferError && (
                  <p className="login__error" role="alert">{transferError}</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    style={{ flex: 1 }}
                    onClick={() => setShowTransfer(false)}
                    disabled={transferSubmitting}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={transferSubmitting}>
                    {transferSubmitting ? 'جاري التحويل…' : 'تأكيد التحويل'}
                  </button>
                </div>
              </form>
            )}

            {topups.length > 0 && (
              <>
                <p className="wallet-page__section-title">طلبات الشحن</p>
                <ul className="wallet-transactions">
                  {topups.map((t) => (
                    <li key={t.id} className="wallet-transactions__item">
                      <div>
                        <p className="wallet-transactions__type">
                          {TOPUP_METHOD_LABELS[t.method] || t.method}
                          {t.claimedAmount ? ` — ${t.claimedAmount.toFixed(2)} ج.م` : ''}
                        </p>
                        <p className="wallet-transactions__date">{formatDate(t.createdAt)}</p>
                      </div>
                      <span className={'wallet-topup-status wallet-topup-status--' + t.status}>
                        {TOPUP_STATUS_LABELS[t.status] || t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="wallet-page__section-title">كشف الحساب</p>
            {wallet.transactions.length === 0 ? (
              <p className="text-muted">مفيش عمليات على محفظتك لسه</p>
            ) : (
              <ul className="wallet-transactions">
                {wallet.transactions.map((t) => (
                  <li key={t.id} className="wallet-transactions__item">
                    <div>
                      <p className="wallet-transactions__type">
                        {TYPE_LABELS[t.type] || t.type}
                        {t.note ? ` — ${t.note}` : ''}
                      </p>
                      <p className="wallet-transactions__date">{formatDate(t.createdAt)}</p>
                    </div>
                    <span
                      className={
                        'wallet-transactions__amount ' +
                        (t.amount >= 0 ? 'wallet-transactions__amount--credit' : 'wallet-transactions__amount--debit')
                      }
                    >
                      {t.amount >= 0 ? '+' : ''}
                      {t.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
