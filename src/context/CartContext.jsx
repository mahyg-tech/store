import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as api from '../api/client'
import { useAuth } from './AuthContext'
import { useDeals } from './DealsContext'
import { applyDealsToCart } from '../utils/deals'
import { notifyItemAdded, notifyQtyIncreased } from '../utils/cartFx'

const CartContext = createContext(null)
const STORAGE_KEY = 'elmahi_cash_cart'

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  // نسخة متزامنة من السلة: addItem/setQty محتاجين يعرفوا "الصنف ده كان موجود
  // ولا لأ؟" و"الكمية زادت ولا نقصت؟" عشان يشغّلوا تأثير السلة المناسب
  // (utils/cartFx.js) — ولازم ده يحصل برّه دالة التحديث بتاعة setItems
  // (اللي ممكن React يشغّلها مرتين في الـ StrictMode).
  const itemsRef = useRef(items)
  const commit = useCallback((updater) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // بنبعت نسخة من السلة للسيرفر عشان الإدارة تشوفها في لوحة التحكم (تاب
  // "العملاء" → "السلة"). التأخير (debounce) عشان مانبعتش طلب مع كل ضغطة +/-.
  // أول مرة للعميل ده على الجهاز ده والسلة فاضية: منبعتش حاجة، عشان
  // منمسحش سلة حقيقية متسجلة من جهاز تاني. أي تفضية بعد كده (فضّاها بإيده
  // أو كمّل الطلب) بتتبعت عادي وبتمسح اللقطة القديمة.
  const { customer } = useAuth()
  const { deals } = useDeals()
  const customerKey = customer?.id ?? customer?.phone ?? null
  const syncedForRef = useRef(null)

  useEffect(() => {
    if (!customerKey) {
      syncedForRef.current = null
      return undefined
    }
    const firstForThisCustomer = syncedForRef.current !== customerKey
    syncedForRef.current = customerKey
    if (firstForThisCustomer && items.length === 0) return undefined

    const timer = setTimeout(() => {
      const { lines } = applyDealsToCart(items, deals)
      const payload = lines.map((l) => ({
        id: l.id,
        productId: l.productId ?? null,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        price: l.price,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      }))
      api.syncCart(payload).catch(() => {
        /* مزامنة السلة للعرض بس — لو فشلت، مفيش أي تأثير على العميل */
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [items, deals, customerKey])

  const addItem = useCallback((product, qty) => {
    // لو مفيش كمية اتحددت صراحة، نبدأ بالحد الأدنى المسموح للوحدة دي
    // (لو مفيش حد أدنى محدد من لوحة التحكم، الافتراضي 1 زي ما كان)
    const initialQty = qty ?? product.minQty ?? 1
    const alreadyInCart = itemsRef.current.some((i) => i.id === product.id)
    commit((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + initialQty } : i))
      }
      return [
        ...prev,
        {
          id: product.id,
          // معرّف المنتج الأب (مش الوحدة) — مستخدم لإعادة التأكد من الستوك
          // لايف بعدين (شوف VoiceAssistant.jsx). ممكن يكون undefined لسطور
          // سلة قديمة اتضافت قبل الميزة دي، وده تمام، بنتجاهلها وقتها.
          productId: product.productId ?? null,
          name: product.name,
          price: product.price,
          unit: product.unit,
          minQty: product.minQty ?? 1,
          maxQty: product.maxQty ?? null,
          qtyStep: product.qtyStep ?? 1,
          stock: product.stock,
          // صورة مصغرة للمنتج — بتتعرض في السلة بدل الحرف الأول من الاسم.
          // ممكن تكون null (منتج من غير صورة، أو سطر سلة قديم اتضاف قبل
          // الميزة دي)، والفرونت إند بيرجع للحرف الأول وقتها زي ما كان.
          image: product.image ?? null,
          qty: initialQty,
        },
      ]
    })
    // صنف جديد: يطير للسلة. صنف موجود زادت كميته: السلة تتحرك بس
    if (alreadyInCart) notifyQtyIncreased()
    else notifyItemAdded()
  }, [commit])

  const setQty = useCallback((productId, qty) => {
    const current = itemsRef.current.find((i) => i.id === productId)
    commit((prev) => {
      if (qty <= 0) return prev.filter((i) => i.id !== productId)
      return prev.map((i) => (i.id === productId ? { ...i, qty } : i))
    })
    if (current && qty > current.qty) notifyQtyIncreased()
  }, [commit])

  const removeItem = useCallback((productId) => {
    commit((prev) => prev.filter((i) => i.id !== productId))
  }, [commit])

  const clearCart = useCallback(() => commit(() => []), [commit])

  const qtyOf = useCallback((productId) => items.find((i) => i.id === productId)?.qty || 0, [items])

  const { totalItems, totalPrice } = useMemo(() => {
    return items.reduce(
      (acc, i) => ({
        totalItems: acc.totalItems + i.qty,
        totalPrice: acc.totalPrice + i.qty * i.price,
      }),
      { totalItems: 0, totalPrice: 0 },
    )
  }, [items])

  // عدد الأصناف المختلفة في السلة (كل سطر = صنف بوحدة بيع معينة)، مش
  // إجمالي عدد القطع زي totalItems — ده اللي المفروض يظهر فوق أيقونة
  // السلة في BottomNav
  const totalProducts = items.length

  const value = { items, addItem, setQty, removeItem, clearCart, qtyOf, totalItems, totalProducts, totalPrice }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart لازم يتستخدم جوه CartProvider')
  return ctx
}
