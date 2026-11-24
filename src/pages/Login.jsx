import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    setError('')
    setPassword('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(phone, password)
      // api.login بيحفظ التوكن والعميل في التخزين بس — لازم نبلّغ AuthContext كمان،
      // لأن ProtectedRoute بيقرا isAuthenticated من الـ context مش من التخزين.
      // من غير السطر ده كان الدخول "بيفشل" بصمت (بيرجّعك لصفحة الدخول) ومابيشتغلش
      // إلا لما التطبيق يتقفل ويتفتح تاني ويقرا العميل من التخزين.
      const customer = data?.customer ?? api.getStoredCustomer()
      if (!customer) throw new Error('حصل خطأ، حاول تاني')
      login(customer)
      // replace: زي شاشة التسجيل — زرار الرجوع مايرجّعش لصفحة الدخول
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'حصل خطأ، حاول تاني')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterStart(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.requestOtp(phone)
      navigate('/verify', { state: { phone } })
    } catch (err) {
      setError(err.message || 'حصل خطأ، حاول تاني')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__hero canopy">
        <div className="login__mark">م</div>
        <h1>أهلاً بيك في الماحي</h1>
        <p className="text-caption">
          {mode === 'login' ? 'سجّل دخولك برقم موبايلك والباسورد' : 'سجّل حساب جديد برقم موبايلك'}
        </p>
      </div>

      <div className="login__tabs container">
        <button
          type="button"
          className={`login__tab ${mode === 'login' ? 'login__tab--active' : ''}`}
          onClick={() => switchMode('login')}
        >
          عندي حساب
        </button>
        <button
          type="button"
          className={`login__tab ${mode === 'register' ? 'login__tab--active' : ''}`}
          onClick={() => switchMode('register')}
        >
          عميل جديد
        </button>
      </div>

      {mode === 'login' ? (
        <form className="login__form container" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="phone">رقم الموبايل</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">الباسورد</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="login__error" role="alert">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'بيتم الدخول…' : 'دخول'}
          </button>
        </form>
      ) : (
        <form className="login__form container" onSubmit={handleRegisterStart}>
          <div className="field">
            <label htmlFor="phone">رقم الموبايل</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              required
            />
          </div>

          {error && <p className="login__error" role="alert">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'بنبعت الكود…' : 'إرسال كود التحقق'}
          </button>

          <p className="login__hint">هيتبعتلك كود تحقق، وبعدين هتحدد باسورد لحسابك.</p>
        </form>
      )}
    </div>
  )
}
