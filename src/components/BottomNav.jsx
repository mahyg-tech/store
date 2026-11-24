import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, Package, User } from 'lucide-react'
import CartIcon from './CartIcon'
import { registerCartTarget } from '../utils/cartFx'
import { useCart } from '../context/CartContext'
import './BottomNav.css'

const TABS = [
  { to: '/', label: 'الرئيسية', Icon: Home, end: true },
  { to: '/search', label: 'بحث', Icon: Search },
  { to: '/cart', label: 'السلة', Icon: CartIcon },
  { to: '/orders', label: 'طلباتي', Icon: Package },
  { to: '/profile', label: 'حسابي', Icon: User },
]

// الشريط بقى ظاهر في كل الصفحات، فالتاب المناسب لازم يفضل متنوّر وإنت جوه
// صفحة فرعية (قسم/منتج → الرئيسية، إتمام الطلب → السلة، تفاصيل طلب →
// طلباتي، المحفظة/العناوين → حسابي) مش بس لما المسار يطابق التاب بالظبط.
function activeTabFor(pathname) {
  if (pathname === '/search') return '/search'
  if (pathname === '/cart' || pathname === '/checkout') return '/cart'
  if (pathname === '/orders' || pathname.startsWith('/orders/') || pathname.startsWith('/order-success/')) return '/orders'
  if (['/profile', '/wallet', '/addresses', '/contact', '/about'].some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/profile'
  }
  return '/'
}

export default function BottomNav() {
  const { totalProducts } = useCart()
  const { pathname } = useLocation()
  const activeTab = activeTabFor(pathname)

  return (
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">
      {TABS.map(({ to, label, Icon, end }) => {
        const isCart = to === '/cart'
        const isActive = to === activeTab
        // اسم تاب ثابت (home/search/cart/orders/profile) مش مرتبط بحالة active —
        // بيستخدمه الجولة التعريفية (OnboardingTour.jsx) عشان تنور تاب بعينه
        // (زي "حسابي" عشان تشرح المحفظة/الكاش باك) من غير ما تعتمد على href
        const tabName = to === '/' ? 'home' : to.slice(1)
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-current={isActive ? 'page' : undefined}
            className={`bottom-nav__item bottom-nav__item--${tabName}${isCart ? ' bottom-nav__item--fab' : ''}${isActive ? ' bottom-nav__item--active' : ''}`}
          >
            <span
              className={`bottom-nav__icon-wrap${isCart ? ' bottom-nav__icon-wrap--fab' : ''}`}
              ref={isCart ? registerCartTarget : undefined}
            >
              <Icon size={isCart ? 26 : 22} strokeWidth={2.2} aria-hidden="true" />
              {isCart && totalProducts > 0 && <span className="bottom-nav__count">{totalProducts}</span>}
            </span>
            <span className="bottom-nav__label">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
