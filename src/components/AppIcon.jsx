import {
  Tag,
  Truck,
  Clock,
  Gift,
  Package2,
  Milk,
  Wheat,
  Droplet,
  CupSoda,
  Cookie,
  SprayCan,
  ShowerHead,
  ShoppingBag,
  PartyPopper,
} from 'lucide-react'

// خريطة اسم → أيقونة. البيانات (من mockData.js حاليًا، ومن الـ API الحقيقي
// بعدين) بتخزّن اسم الأيقونة كنص (مثال: "Milk")، مش إيموجي، عشان نقدر
// نعرضها كأيقونة خطية سودا هادئة بدل الإيموجي الملوّن.
const ICONS = {
  Tag,
  Truck,
  Clock,
  Gift,
  Package2,
  Milk,
  Wheat,
  Droplet,
  CupSoda,
  Cookie,
  SprayCan,
  ShowerHead,
  ShoppingBag,
  PartyPopper,
}

export default function AppIcon({ name, size = 20, strokeWidth = 1.8, color, className, style }) {
  const Icon = ICONS[name] || ShoppingBag
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      style={style}
      aria-hidden="true"
    />
  )
}
