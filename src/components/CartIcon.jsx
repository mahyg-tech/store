/**
 * أيقونة السلة بغطا منفصل — نفس شكل أيقونة ShoppingBasket (lucide) بالظبط،
 * بس الجزء العلوي (الحافة + الإيدين) في مجموعة `.cart-icon__lid` عشان
 * نقدر نفتحه بالـ CSS لما صنف "يطير" جواها (شوف utils/cartFx.js و
 * BottomNav.css). من غير الكلاس cart-fx-open بتبان زي أي أيقونة عادية.
 */
export default function CartIcon({ size = 24, strokeWidth = 2, ...rest }) {
  return (
    <svg
      className="cart-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
      <path d="M4.5 15.5h15" />
      <path d="m9 11 1 9" />
      <path d="m15 11-1 9" />
      <g className="cart-icon__lid">
        <path d="M2 11h20" />
        <path d="m19 11-4-7" />
        <path d="m5 11 4-7" />
      </g>
    </svg>
  )
}
