import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet as WalletIcon, Smartphone } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import * as api from '../api/client'
import PageHeader from '../components/PageHeader'
import './WalletTopup.css'

// جوه تطبيق Capacitor الأصلي، بنستخدم @capacitor/camera عشان نفتح منتقي
// الصور/الكاميرا الأصلي في اندرويد/iOS — وده بيطلب إذن الوصول للصور فعليًا
// وقت الاستخدام (مش بس تصريح في AndroidManifest.xml، اللي لوحده مش كافي
// عشان يظهر مربع حوار الإذن). في متصفح عادي (مش جوه التطبيق)، بيفضل شغال
// بنفس <input type="file"> اللي المتصفح بيتعامل معاه بنفسه.
const IS_NATIVE_APP = Capacitor?.isNativePlatform?.() ?? false

// عمولة الشركة المانحة للمحفظة — بتتضاف على أي مبلغ العميل عايز يشحنه،
// عشان يعرف يحوّل المبلغ الصافي + العمولة صح من أول مرة. ثابتة هنا دلوقتي
// (مش جايه من app_settings)؛ لو حبيت تتحكم فيها من لوحة التحكم زي رسايل
// الشحن، قولّي وهربطها بنفس settings.php.
const WALLET_TOPUP_COMMISSION_PERCENT = 1

function formatAmount(n) {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

export default function WalletTopup() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState({ wallets: '', instapay: '' })
  const [method, setMethod] = useState(null) // null | 'wallets' | 'instapay'
  const [claimedAmount, setClaimedAmount] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    api
      .fetchSettings()
      .then((s) => setMessages(s.walletTopupMessages || { wallets: '', instapay: '' }))
      .catch(() => {})
  }, [])

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    setReceiptFile(file)
    setReceiptPreview(file ? URL.createObjectURL(file) : null)
  }

  // مسار التطبيق الأصلي (Capacitor): بيتأكد من إذن الوصول للصور/الكاميرا
  // (بيطلبه فعليًا لو لسه متسألش)، وبعدين يفتح منتقي الصور الأصلي
  async function pickReceiptNative() {
    setError('')
    try {
      let perm = await Camera.checkPermissions()
      if (perm.photos !== 'granted' && perm.photos !== 'limited') {
        perm = await Camera.requestPermissions({ permissions: ['photos', 'camera'] })
      }
      if (perm.photos !== 'granted' && perm.photos !== 'limited') {
        setError('محتاج إذن الوصول للصور عشان ترفع صورة الإيصال 🖼️')
        return
      }

      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.Uri,
        quality: 80,
        promptLabelHeader: 'صورة الإيصال',
        promptLabelPhoto: 'اختيار من الصور',
        promptLabelPicture: 'التقاط صورة',
      })

      const response = await fetch(photo.webPath)
      const blob = await response.blob()
      const ext = photo.format || 'jpg'
      const file = new File([blob], `receipt.${ext}`, { type: blob.type || `image/${ext}` })

      setReceiptFile(file)
      setReceiptPreview(photo.webPath)
    } catch (err) {
      // المستخدم لغى الاختيار من المنتقي — مش خطأ نعرضه له
      if (err?.message && !/cancel/i.test(err.message)) {
        setError('معرفناش نفتح الصور، جرب تاني')
      }
    }
  }

  const enteredAmount = Number(claimedAmount)
  const hasValidAmount = claimedAmount !== '' && Number.isFinite(enteredAmount) && enteredAmount > 0
  const amountToSend = hasValidAmount ? enteredAmount * (1 + WALLET_TOPUP_COMMISSION_PERCENT / 100) : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!hasValidAmount) {
      setError('اكتب المبلغ اللي عايز تشحنه في محفظتك')
      return
    }
    if (!receiptFile) {
      setError('محتاج صورة الإيصال أو البيان')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api.submitWalletTopup({ method, claimedAmount: claimedAmount || null, receiptFile })
      setDone(true)
    } catch (err) {
      setError(err.message || 'حصل خطأ، حاول تاني')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div>
        <PageHeader title="شحن المحفظة" />
        <div className="container wallet-topup-done">
          <div className="wallet-topup-done__icon">✓</div>
          <h2>تم استلام طلبك</h2>
          <p className="text-muted">هيتم مراجعته وإضافة الرصيد لمحفظتك خلال يوم عمل واحد.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/wallet')}>
            الرجوع للمحفظة
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="شحن المحفظة" />
      <div className="container wallet-topup">
        {!method ? (
          <>
            <p className="wallet-topup__prompt">اختار طريقة الشحن</p>
            <button type="button" className="wallet-topup__method card" onClick={() => setMethod('wallets')}>
              <Smartphone size={22} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
              <span>محافظ إلكترونية</span>
            </button>
            <button type="button" className="wallet-topup__method card" onClick={() => setMethod('instapay')}>
              <WalletIcon size={22} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
              <span>إنستاباي</span>
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="wallet-topup__message card">{messages[method]}</div>

            <div className="field">
              <label htmlFor="claimed-amount">المبلغ اللي عايز تشحنه في محفظتك</label>
              <input
                id="claimed-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="مثلاً 200"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                required
              />
            </div>

            {hasValidAmount && (
              <div
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-1)',
                  marginBottom: 'var(--sp-3)',
                }}
              >
                <span className="text-caption text-muted">هتحوّل فعليًا</span>
                <strong style={{ fontSize: 'var(--fs-lg, 1.25rem)' }}>{formatAmount(amountToSend)} ج.م</strong>
                <span className="text-caption text-muted">
                  شامل {WALLET_TOPUP_COMMISSION_PERCENT}% عمولة الشركة المانحة للمحفظة
                </span>
              </div>
            )}

            <div className="field">
              <label htmlFor="receipt">صورة الإيصال أو البيان</label>
              {IS_NATIVE_APP ? (
                <button type="button" className="btn btn--outline btn--block" onClick={pickReceiptNative}>
                  {receiptFile ? 'تغيير صورة الإيصال' : 'اختيار صورة الإيصال'}
                </button>
              ) : (
                <input id="receipt" type="file" accept="image/*" onChange={handleFileChange} required />
              )}
              {receiptPreview && <img src={receiptPreview} alt="معاينة الإيصال" className="wallet-topup__preview" />}
            </div>

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn btn--outline btn--block"
              onClick={() => setMethod(null)}
              style={{ marginBottom: 'var(--sp-2)' }}
            >
              رجوع
            </button>
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? 'بيتبعت…' : 'إرسال الطلب'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
