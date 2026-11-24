import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { DealsProvider } from './context/DealsContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { StockNotifyProvider } from './context/StockNotifyContext'
import { AssistantAnnounceProvider } from './context/AssistantAnnounceContext'
import { useHardwareBackButton } from './hooks/useHardwareBackButton'
import { useAutoOfflineSync } from './hooks/useAutoOfflineSync'
import { initPushNotifications, ASSISTANT_PUSH_TYPE } from './utils/pushNotifications'
import { requestInboxCheck } from './utils/assistantInbox'
import BottomNav from './components/BottomNav'
import PageTransition from './components/PageTransition'
import OfflineBanner from './components/OfflineBanner'
import DealAnnouncer from './components/DealAnnouncer'
import AssistantOfferBubble from './components/AssistantOfferBubble'
import RatingPromptModal from './components/RatingPromptModal'
import AppRatingModal from './components/AppRatingModal'
import OnboardingTour from './components/OnboardingTour'
import * as api from './api/client'
import { isAppRatingDue } from './utils/appRatingPrompt'

import Splash from './pages/Splash'
import Login from './pages/Login'
import OtpVerify from './pages/OtpVerify'
import Home from './pages/Home'
import SearchPage from './pages/SearchPage'
import CategoryPage from './pages/CategoryPage'
import ProductDetail from './pages/ProductDetail'
import PromoProducts from './pages/PromoProducts'
import PartnerProducts from './pages/PartnerProducts'
import CustomSectionProducts from './pages/CustomSectionProducts'
import SectionProducts from './pages/SectionProducts'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Profile from './pages/Profile'
import Wallet from './pages/Wallet'
import WalletTopup from './pages/WalletTopup'
import Points from './pages/Points'
import Competition from './pages/Competition'
import Addresses from './pages/Addresses'
import ContactUs from './pages/ContactUs'
import About from './pages/About'

// الشريط السفلي (الرئيسية/بحث/السلة/طلباتي/حسابي) ظاهر ثابت في كل صفحات
// التطبيق بعد تسجيل الدخول — ما عدا شاشات الدخول نفسها
const NO_CHROME_ROUTES = ['/login', '/verify']

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, customer } = useAuth()
  const showChrome = isAuthenticated && !NO_CHROME_ROUTES.includes(location.pathname)

  // زرار الرجوع الأصلي بتاع الموبايل — بيشتغل في كل الشاشات (مسجل دخول
  // أو لسه في تسجيل الدخول)
  useHardwareBackButton()

  // تنزيل الكتالوج والصور في الخلفية عشان التطبيق يفتح كامل من غير نت
  // (utils/offlineSync.js)
  useAutoOfflineSync(isAuthenticated)

  // تسجيل/تجديد توكن إشعارات الـ Push لما العميل يسجل دخول. لو دوس على
  // إشعار "رجع متوفر" لصنف واحد بعينه، نودّيه لصفحة المنتج على طول.
  // navigate/location بتتغيّر مع كل تنقل، فبنقراهم من ref — لو حطيناهم في deps
  // كان الـ effect بيتعاد (ويعيد تسجيل الجهاز) مع كل صفحة العميل يفتحها.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  // تقييم الخدمة بعد التسليم (المساعد الرقمي): بنتأكد أول ما العميل يسجل
  // دخول (فتح التطبيق)، وكمان فورًا لو دوس على الإشعار أو وصله والتطبيق
  // مفتوح — بدل ما نستنى لحد ما يفتح التطبيق من جديد
  const [pendingRatingOrderId, setPendingRatingOrderId] = useState(null)

  function checkPendingRating() {
    api
      .fetchPendingRating()
      .then((res) => setPendingRatingOrderId(res?.orderId ?? null))
      .catch(() => {})
  }

  useEffect(() => {
    if (!isAuthenticated) return
    checkPendingRating()
  }, [isAuthenticated])

  // تقييم عام للتطبيق (مش لطلب بعينه — شوف components/AppRatingModal.jsx
  // وutils/appRatingPrompt.js): بنفحص مرة كل ما العميل يسجل دخول، بتأخير
  // بسيط عشان نافذة تقييم الخدمة فوق (لو ظاهرة) تاخد الأولوية دايمًا ومايحصلش
  // ظهور نافذتين فوق بعض
  const [showAppRating, setShowAppRating] = useState(false)
  useEffect(() => {
    if (!isAuthenticated) return
    const timer = setTimeout(() => {
      if (isAppRatingDue(customer)) setShowAppRating(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    initPushNotifications({
      onNotificationTap: (notification) => {
        const data = notification?.data || {}
        // رسالة من المساعد: نروح للرئيسية (المساعد هناك) وهو بيفتح لوحده ويعرضها
        if (data.type === ASSISTANT_PUSH_TYPE) {
          if (pathRef.current !== '/') navigateRef.current('/')
          requestInboxCheck('tap')
          return
        }
        if (data.type === 'order_rating') {
          checkPendingRating()
          return
        }
        // تعديل من الإدارة على الفاتورة: نفتح تفاصيل الطلب
        if (data.type === 'order_updated' && data.orderId) {
          navigateRef.current(`/orders/${data.orderId}`)
          return
        }
        if (data.productId) navigateRef.current(`/product/${data.productId}`)
      },
      // إشعار مساعد وصل والتطبيق مفتوح (أندرويد مابيعرضوش لوحده): لو العميل في
      // الرئيسية المساعد بيفتح ويعرض الرسالة فورًا، ولو في صفحة تانية بتستنى
      // لحد ما يرجع للرئيسية (منقاطعوش وهو بيدفع مثلاً)
      onForegroundNotification: (notification) => {
        if (notification?.data?.type === ASSISTANT_PUSH_TYPE) requestInboxCheck('foreground')
        if (notification?.data?.type === 'order_rating') checkPendingRating()
      },
    })
  }, [isAuthenticated])

  return (
    <div className="app-shell">
      {isAuthenticated && pendingRatingOrderId && (
        <RatingPromptModal orderId={pendingRatingOrderId} onDone={() => setPendingRatingOrderId(null)} />
      )}
      {isAuthenticated && !pendingRatingOrderId && showAppRating && (
        <AppRatingModal customer={customer} onDone={() => setShowAppRating(false)} />
      )}
      {showChrome && <OfflineBanner />}
      <div className={showChrome ? 'screen' : ''}>
        {/* location.key فريد مع كل تنقل (حتى لو نفس المسار)، فبيخلي
            PageTransition يعيد الأنيميشن ("تنبثق من الداخل") مع كل صفحة
            جديدة — شوف components/PageTransition.jsx */}
        <PageTransition transitionKey={location.key}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<OtpVerify />} />

            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/category/:categoryId" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
            <Route path="/product/:productId" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/promo/:promoId/products" element={<ProtectedRoute><PromoProducts source="grid" /></ProtectedRoute>} />
            <Route path="/section/:type" element={<ProtectedRoute><SectionProducts /></ProtectedRoute>} />
            <Route path="/slider/:promoId/products" element={<ProtectedRoute><PromoProducts source="slider" /></ProtectedRoute>} />
            <Route path="/partner/:partnerId" element={<ProtectedRoute><PartnerProducts /></ProtectedRoute>} />
            <Route path="/custom-section/:sectionId/products" element={<ProtectedRoute><CustomSectionProducts /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/order-success/:orderId" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/orders/:orderId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/wallet/topup" element={<ProtectedRoute><WalletTopup /></ProtectedRoute>} />
            <Route path="/points" element={<ProtectedRoute><Points /></ProtectedRoute>} />
            <Route path="/competition" element={<ProtectedRoute><Competition /></ProtectedRoute>} />
            <Route path="/addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />
            <Route path="/contact" element={<ProtectedRoute><ContactUs /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
      </div>

      {showChrome && <BottomNav />}

      {/* المساعد بيبلّغ العميل بالعروض (فقاعة + صوت) لما يضيف صنف عليه عرض للسلة
          أو يفتح صفحته — شوف components/DealAnnouncer.jsx و AssistantOfferBubble.jsx */}
      {isAuthenticated && (
        <>
          <DealAnnouncer />
          <AssistantOfferBubble />
          <OnboardingTour />
        </>
      )}
    </div>
  )
}

function AppInner({ booting }) {
  if (booting) return <Splash />

  return (
    <AuthProvider>
      <SettingsProvider>
        <DealsProvider>
          <CartProvider>
            <AssistantAnnounceProvider>
              <StockNotifyProvider>
                <Shell />
              </StockNotifyProvider>
            </AssistantAnnounceProvider>
          </CartProvider>
        </DealsProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    // اتزوّدت من 1100 إلى 1900ms عشان أنيميشن شعار السبلاش (Splash.css)
    // بقت مدتها أطول (1.3s) فتتفرّج عليها كاملة قبل ما الشاشة تختفي
    const timer = setTimeout(() => setBooting(false), 1900)
    return () => clearTimeout(timer)
  }, [])

  // ToastProvider برّه أي حاجة تانية عشان يفضل متاح حتى وقت شاشة الـ
  // Splash (زرار الرجوع ممكن نظريًا يتضغط أي وقت)
  return (
    <ToastProvider>
      <AppInner booting={booting} />
    </ToastProvider>
  )
}
