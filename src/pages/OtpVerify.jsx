import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import * as api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getCurrentCoords } from '../utils/geolocation'
import PageHeader from '../components/PageHeader'
import './Login.css'

export default function OtpVerify() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const phone = location.state?.phone

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [regions, setRegions] = useState([])
  const [regionId, setRegionId] = useState('')
  const [seconds, setSeconds] = useState(45)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  // قايمة المناطق للاختيار وقت التسجيل — لو فشل التحميل (مفيش نت/السيرفر
  // لسه ماتحدّثش) التسجيل بيكمل عادي من غير منطقة
  useEffect(() => {
    let cancelled = false
    api.fetchRegions().then((list) => {
      if (!cancelled && Array.isArray(list)) setRegions(list)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!phone) return <Navigate to="/login" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('الباسورد لازم يكون 6 حروف/أرقام على الأقل')
      return
    }
    if (password !== passwordConfirm) {
      setError('الباسورد وتأكيده مش متطابقين')
      return
    }
    if (regions.length > 0 && !regionId) {
      setError('اختار منطقتك من القايمة')
      return
    }

    setLoading(true)
    try {
      // بناخد إحداثيات موقع العميل وقت التسجيل (زي elmahi-sales) — best
      // effort، لو رفض إذن الموقع أو الجهاز مش بيدعمه، التسجيل بيكمل عادي.
      const coords = await getCurrentCoords()
      const data = await api.verifyOtp(phone, code, password, undefined, coords, regionId)
      login(data.customer)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'حصل خطأ، حاول تاني')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setSeconds(45)
    await api.requestOtp(phone)
  }

  return (
    <div className="login">
      <PageHeader title="كود التحقق" />
      <form className="login__form container" onSubmit={handleSubmit}>
        <p className="text-muted">
          بعتنالك كود مكوّن من 4 أرقام على <strong>{phone}</strong>
        </p>

        <div className="field">
          <label htmlFor="code">كود التحقق</label>
          <input
            id="code"
            type="tel"
            inputMode="numeric"
            placeholder="••••"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={4}
            style={{ letterSpacing: '10px', textAlign: 'center', fontSize: '1.3rem' }}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">حدّد باسورد لحسابك</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password-confirm">تأكيد الباسورد</label>
          <input
            id="password-confirm"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {regions.length > 0 && (
          <div className="field">
            <label htmlFor="region">منطقتك</label>
            <select
              id="region"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              required
            >
              <option value="">اختار المنطقة…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="login__error" role="alert">{error}</p>}

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'بنتأكد…' : 'تأكيد'}
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleResend}
          disabled={seconds > 0}
        >
          {seconds > 0 ? `إعادة الإرسال بعد ${seconds} ثانية` : 'إعادة إرسال الكود'}
        </button>
      </form>
    </div>
  )
}
