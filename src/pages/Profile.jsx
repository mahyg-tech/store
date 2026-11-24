import { useNavigate } from 'react-router-dom'
import { Package, MapPin, MessageCircle, Info, ChevronLeft, Wallet as WalletIcon, Star, Trophy, Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resetTour } from '../utils/onboardingTour'
import './Profile.css'

const MENU_ITEMS = [
  { Icon: Package, label: 'طلباتي', to: '/orders' },
  { Icon: WalletIcon, label: 'محفظتي', to: '/wallet' },
  { Icon: Star, label: 'نقاطي', to: '/points' },
  { Icon: Trophy, label: 'المسابقة', to: '/competition' },
  { Icon: MapPin, label: 'عناويني', to: '/addresses' },
  { Icon: MessageCircle, label: 'تواصل معانا', to: '/contact' },
  { Icon: Info, label: 'عن الماحي', to: '/about' },
  { Icon: Compass, label: 'اعادة الجولة التعريفية', to: 'tour' },
]

export default function Profile() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <div className="profile-hero canopy">
        <div className="profile-hero__avatar" aria-hidden="true">
          {customer?.name?.charAt(0) || 'ع'}
        </div>
        <div>
          <p className="profile-hero__name">{customer?.name || 'عميل الماحي'}</p>
          <p style={{ color: 'var(--color-teal-100)' }}>{customer?.phone}</p>
        </div>
      </div>

      <div className="container profile-menu">
        {MENU_ITEMS.map(({ Icon, label, to }) => (
          <button
            key={label}
            type="button"
            className="profile-menu__item card"
            onClick={() => {
              if (to === 'tour') {
                // نصفّر حالة الجولة ونرجع للرئيسية، والجولة بتبدأ لوحدها هناك
                resetTour(customer)
                navigate('/')
                return
              }
              if (to.startsWith('/')) navigate(to)
            }}
          >
            <Icon size={20} strokeWidth={1.8} color="var(--color-ink-900)" aria-hidden="true" />
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronLeft size={18} color="var(--color-ink-400)" aria-hidden="true" style={{ transform: 'rotate(180deg)' }} />
          </button>
        ))}

        <button type="button" className="btn btn--outline btn--block" style={{ marginTop: 'var(--sp-4)' }} onClick={handleLogout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
