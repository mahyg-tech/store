import { useEffect, useState } from 'react'
import { MapPin, LocateFixed, CheckCircle2 } from 'lucide-react'
import * as api from '../api/client'
import { getCurrentCoords } from '../utils/geolocation'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import './Addresses.css'

export default function Addresses() {
  const [address, setAddress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addressText, setAddressText] = useState('')
  const [phone, setPhone] = useState('')
  const [coords, setCoords] = useState(null) // { latitude, longitude } | null
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadAddress()
  }, [])

  async function loadAddress() {
    setLoading(true)
    try {
      const saved = await api.fetchAddress()
      setAddress(saved)
    } catch (err) {
      setError(err.message || 'حصل خطأ في تحميل عنوانك')
    } finally {
      setLoading(false)
    }
  }

  function openForm() {
    setAddressText(address?.addressText || '')
    setPhone(address?.phone || '')
    setCoords(
      address?.latitude != null && address?.longitude != null
        ? { latitude: address.latitude, longitude: address.longitude }
        : null
    )
    setLocationError('')
    setFormError('')
    setShowForm(true)
  }

  async function handleLocate() {
    setLocating(true)
    setLocationError('')
    const result = await getCurrentCoords()
    setLocating(false)
    if (!result) {
      setLocationError('معرفناش نحدد موقعك — تأكد إن إذن الموقع مفعّل للتطبيق وجرب تاني')
      return
    }
    setCoords(result)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!addressText.trim()) {
      setFormError('اكتب العنوان بالتفصيل')
      return
    }
    if (phone.trim() && !/^01[0-2,5]\d{8}$/.test(phone.trim())) {
      setFormError('رقم الموبايل مش صحيح')
      return
    }

    setSubmitting(true)
    try {
      await api.saveAddress({
        addressText: addressText.trim(),
        phone: phone.trim(),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      })
      setShowForm(false)
      showToast('اتحفظ عنوانك')
      await loadAddress()
    } catch (err) {
      setFormError(err.message || 'حصل خطأ أثناء الحفظ، جرب تاني')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    try {
      await api.deleteAddress()
      showToast('اتمسح العنوان')
      await loadAddress()
    } catch (err) {
      showToast(err.message || 'حصل خطأ أثناء المسح')
    }
  }

  return (
    <div>
      <PageHeader title="عناويني" />
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="مسح العنوان"
        message="متأكد إنك عايز تمسح عنوانك المحفوظ؟"
        confirmLabel="امسح"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
      <div className="container addresses-page">
        {loading && <p className="text-muted">بيتحمّل…</p>}
        {error && !loading && <p className="login__error" role="alert">{error}</p>}

        {!loading && !error && !showForm && (
          <>
            {address ? (
              <div className="address-card">
                <div className="address-card__header">
                  <span className="address-card__label">عنواني</span>
                  {address.latitude != null && (
                    <span className="address-card__default-badge">
                      <MapPin size={13} strokeWidth={2} aria-hidden="true" />
                      الموقع محدد
                    </span>
                  )}
                </div>
                <p className="address-card__text">{address.addressText}</p>
                {address.phone && <p className="address-card__phone">{address.phone}</p>}
                <div className="address-card__actions">
                  <button type="button" className="address-card__action-btn" onClick={openForm}>
                    تعديل
                  </button>
                  <button type="button" className="address-card__action-btn address-card__action-btn--danger" onClick={() => setConfirmDelete(true)}>
                    حذف
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MapPin}
                title="مفيش عنوان محفوظ لسه"
                subtitle="ضيف عنوانك عشان يتملى لوحده وقت إتمام الطلب"
                action={
                  <button type="button" className="btn btn--primary" onClick={openForm} style={{ marginTop: 'var(--sp-3)' }}>
                    إضافة عنوان
                  </button>
                }
              />
            )}
          </>
        )}

        {!loading && !error && showForm && (
          <form className="address-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="address-text">العنوان بالتفصيل</label>
              <textarea
                id="address-text"
                rows={3}
                placeholder="الحي، الشارع، رقم العمارة والدور..."
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="field">
              <label htmlFor="address-phone">رقم موبايل للتوصيل (اختياري)</label>
              <input
                id="address-phone"
                type="tel"
                inputMode="numeric"
                placeholder="01xxxxxxxxx"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="address-form__location">
              <button
                type="button"
                className="btn btn--outline btn--block"
                onClick={handleLocate}
                disabled={locating}
              >
                <LocateFixed size={18} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 6 }} aria-hidden="true" />
                {locating ? 'بيحدد موقعك…' : coords ? 'تحديث موقعي الحالي' : 'تحديد موقعي الحالي'}
              </button>
              {coords && (
                <p className="address-form__location-ok">
                  <CheckCircle2 size={15} strokeWidth={2} aria-hidden="true" />
                  تم تحديد موقعك — هيوصل للتوصيل بالإحداثيات دي بالظبط
                </p>
              )}
              {locationError && <p className="login__error" role="alert">{locationError}</p>}
            </div>

            {formError && <p className="login__error" role="alert">{formError}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn--outline"
                style={{ flex: 1 }}
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                إلغاء
              </button>
              <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={submitting}>
                {submitting ? 'جاري الحفظ…' : 'حفظ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
