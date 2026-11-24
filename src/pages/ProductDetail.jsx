import { useEffect, useState, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { PackageX, Star } from 'lucide-react'
import * as api from '../api/client'
import { useCart } from '../context/CartContext'
import { useDeals } from '../context/DealsContext'
import { useAssistantAnnounce } from '../context/AssistantAnnounceContext'
import { getTieredDeal, getEffectiveUnitPrice, getNextTierHint, getFreeGiftDealsFor } from '../utils/deals'
import { getEffectiveMax, snapToStep, formatQty } from '../utils/qty'
import { buildProductViewLines } from '../utils/dealAnnouncements'
import PageHeader from '../components/PageHeader'
import QuantityStepper from '../components/QuantityStepper'
import EmptyState from '../components/EmptyState'
import NotifyMeButton from '../components/NotifyMeButton'
import './ProductDetail.css'
import CachedImage from '../components/CachedImage'

// نفس الصنف ما يتبلّغش بعرضه تاني قبل الفترة دي (لو العميل دخل وخرج كذا مرة)
const VIEW_ANNOUNCE_COOLDOWN_MS = 5 * 60 * 1000

export default function ProductDetail() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [unitIndex, setUnitIndex] = useState(0)
  const { qtyOf, addItem, setQty } = useCart()
  const { deals } = useDeals()
  const { announce } = useAssistantAnnounce()
  const location = useLocation()
  const navigate = useNavigate()
  const voiceAddDoneRef = useRef(null)
  const [voiceAddedMsg, setVoiceAddedMsg] = useState('')
  const dealTour = location.state?.dealTour

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    setUnitIndex(0)
    api
      .fetchProduct(productId)
      .then((data) => {
        if (active) setProduct(data)
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'حصل خطأ في تحميل المنتج')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [productId])

  // المنتج اتفتح من نتايج البحث؟ نسجّل ده مرة واحدة لكل فتح (location.key) —
  // لو الأدمن مشغّل رسالة المساعد "شوفت المنتج ومضفتوش للسلة" هتتبعت بعد
  // المدة اللي هو محددها، بشرط إن العميل ميضيفوش للسلة قبلها.
  const viewTrackedRef = useRef(null)
  useEffect(() => {
    if (!product || location.state?.from !== 'search') return
    if (viewTrackedRef.current === location.key) return
    viewTrackedRef.current = location.key
    api.trackProductView({ productRef: String(productId), name: product.name }).catch(() => {})
  }, [product, location.key, location.state, productId])

  // لو المستخدم جاي من المساعد الصوتي (VoiceAssistant.jsx)، location.state.voiceAdd
  // بتكون فيها الكمية ومعرّف وحدة البيع اللي المستخدم اختارها/قصدها (المساعد
  // هو اللي بيحسم أنهي وحدة قبل ما يوصل هنا — لو الصنف عنده أكتر من وحدة
  // ومفيش تلميح واضح، بيسأل المستخدم في الشات الأول). هنا بس بنضيفها للسلة.
  // الحارس بيتابع location.key (مش product.id) عشان لو نفس صفحة المنتج ده
  // اتفتحت تاني من المساعد الصوتي في زيارة تانية، الإضافة الجديدة تتنفذ برضه —
  // React Router غالبًا بيعيد استخدام نفس الكومبوننت بين زيارتين لنفس الرابط
  useEffect(() => {
    if (!product) return
    const voiceAdd = location.state?.voiceAdd
    if (!voiceAdd || voiceAddDoneRef.current === location.key) return
    voiceAddDoneRef.current = location.key

    const unitsList = product.units && product.units.length > 0 ? product.units : [product]
    const idIndex = voiceAdd.unitId ? unitsList.findIndex((u) => u.id === voiceAdd.unitId) : -1
    const matchedIndex = idIndex >= 0 ? idIndex : 0
    const chosenUnit = unitsList[matchedIndex]
    setUnitIndex(matchedIndex)

    if (chosenUnit.stock === 0) {
      setVoiceAddedMsg(`للأسف "${product.name}" (${chosenUnit.unit}) نفدت من المخزن دلوقتي`)
    } else {
      const max = getEffectiveMax(chosenUnit)
      const min = chosenUnit.minQty ?? 1
      const step = chosenUnit.qtyStep ?? 1
      let qty = snapToStep(Math.max(min, voiceAdd.qty), step)
      if (typeof max === 'number') qty = Math.min(qty, max)

      addItem(
        {
          id: chosenUnit.id,
          productId: product.id,
          name: product.name,
          price: chosenUnit.price,
          unit: chosenUnit.unit,
          minQty: chosenUnit.minQty ?? 1,
          maxQty: chosenUnit.maxQty ?? null,
          qtyStep: chosenUnit.qtyStep ?? 1,
          stock: chosenUnit.stock,
        },
        qty,
      )
      setVoiceAddedMsg(`تمت إضافة ${formatQty(qty)} ${chosenUnit.unit} من "${product.name}" للسلة 🛒`)
    }

    // نشيل الـ state من التنقل عشان رجوع/تحديث الصفحة ميكررش الإضافة
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, location.key])

  // المساعد بيبلّغ العميل بعرض الصنف أول ما يفتح صفحته (فقاعة + صوت، شوف
  // context/AssistantAnnounceContext.jsx). بنتخطى الحالتين اللي ليهم كلام
  // خاص بيهم: جولة العروض (كارت الشرح ظاهر أصلاً) وإضافة المساعد الصوتي
  // (DealAnnouncer بيبلّغ بحالة السلة بعد الإضافة). location.state مقصود
  // برّه الـ deps — تفريغه بعد الإضافة الصوتية مايخليش الـ effect يتعاد.
  useEffect(() => {
    if (!product || !deals || deals.length === 0) return
    if (location.state?.voiceAdd || location.state?.dealTour) return
    announce({
      key: `view:${product.id}`,
      lines: buildProductViewLines(deals, product),
      cooldownMs: VIEW_ANNOUNCE_COOLDOWN_MS,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, deals, announce])

  // جولة العروض (شوف VoiceAssistant.jsx — startDealsTour): "التالي" بيروح
  // لصفحة الصنف اللي بعده في نفس القائمة، من غير ما يكدّس تاريخ تنقل طويل
  // (replace: true)، و"إنهاء" بيشيل حالة الجولة ويسيب الصفحة عادية
  function goToNextDeal() {
    if (!dealTour) return
    const next = dealTour.index + 1
    if (next >= dealTour.queue.length) return
    navigate(`/product/${dealTour.queue[next].productId}`, {
      replace: true,
      state: { dealTour: { queue: dealTour.queue, index: next } },
    })
  }

  function endTour() {
    navigate(location.pathname, { replace: true, state: null })
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="تفاصيل المنتج" />
        <div className="container">
          <div className="skeleton" style={{ height: 260, marginBottom: 'var(--sp-4)' }} />
          <div className="skeleton" style={{ height: 24, width: '70%', marginBottom: 'var(--sp-2)' }} />
          <div className="skeleton" style={{ height: 18, width: '40%' }} />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div>
        <PageHeader title="تفاصيل المنتج" />
        <div className="container">
          <EmptyState
            icon={PackageX}
            title="المنتج ده مش متاح"
            subtitle={loadError || 'ممكن يكون اتشال أو الرابط غلط'}
          />
        </div>
      </div>
    )
  }

  const units = product.units && product.units.length > 0 ? product.units : [product]
  const selected = units[unitIndex] || units[0]
  const qty = qtyOf(selected.id)
  const outOfStock = selected.stock === 0
  const cartItem = {
    id: selected.id,
    productId: product.id,
    name: product.name,
    price: selected.price,
    unit: selected.unit,
    minQty: selected.minQty ?? 1,
    maxQty: selected.maxQty ?? null,
    qtyStep: selected.qtyStep ?? 1,
    stock: selected.stock,
    image: product.image ?? null,
  }

  const tieredDeal = getTieredDeal(deals, selected.id)
  const effectivePrice = getEffectiveUnitPrice(tieredDeal, selected.price, Math.max(qty, 1))
  const nextTier = getNextTierHint(tieredDeal, qty)
  const freeGiftDeals = getFreeGiftDealsFor(deals, selected.id)

  return (
    <div className="pd">
      <PageHeader title="تفاصيل المنتج" />

      {voiceAddedMsg && (
        <div className="container" style={{ marginTop: 'var(--sp-3)' }}>
          <div
            style={{
              background: 'var(--color-olive-100)',
              color: 'var(--color-olive-500)',
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 600,
            }}
          >
            {voiceAddedMsg}
          </div>
        </div>
      )}

      {dealTour && (
        <div className="container" style={{ marginTop: 'var(--sp-3)' }}>
          <div className="pd-dealtour">
            <p className="pd-dealtour__badge">🎉 عرض {dealTour.index + 1} من {dealTour.queue.length}</p>
            <p className="pd-dealtour__title">{dealTour.queue[dealTour.index].dealTitle}</p>
            <p className="pd-dealtour__desc">{dealTour.queue[dealTour.index].explanation}</p>
            <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <button type="button" className="btn btn--outline" onClick={endTour}>
                إنهاء الجولة
              </button>
              {dealTour.index + 1 < dealTour.queue.length ? (
                <button type="button" className="btn btn--primary" onClick={goToNextDeal}>
                  العرض التالي ←
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={endTour}>
                  تمام، خلصنا 👍
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`pd__media container${dealTour ? ' pd__media--spotlight' : ''}`}>
        {product.image ? (
          <CachedImage src={product.image} alt={product.name} className="pd__image" />
        ) : (
          <div className="pd__placeholder" aria-hidden="true">{product.name.charAt(0)}</div>
        )}
        {product.oldPrice && <span className="badge badge--sale pd__badge">وفّر {product.oldPrice - selected.price} ج.م</span>}
      </div>

      <div className="container pd__body">
        <h1 className="pd__name">{product.name}</h1>

        {units.length > 1 ? (
          <div className="pd__units">
            {units.map((u, i) => (
              <button
                key={u.id}
                type="button"
                className="chip"
                aria-pressed={i === unitIndex}
                onClick={() => setUnitIndex(i)}
              >
                {u.unit}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted">{selected.unit}</p>
        )}

        <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
          {product.fresh && <span className="badge badge--fresh">طازة</span>}
          {outOfStock ? (
            <span className="badge badge--outofstock">نفدت الكمية</span>
          ) : selected.stock <= 8 ? (
            <span className="text-caption">باقي {selected.stock} بس في المخزن</span>
          ) : null}
        </div>

        <div className="row row--between pd__price-row">
          <div>
            <span className="price" style={{ fontSize: '1.4rem' }}>{effectivePrice} ج.م</span>
            {(product.oldPrice || effectivePrice < selected.price) && (
              <span className="price--strike"> {product.oldPrice || selected.price} ج.م</span>
            )}
            {selected.points > 0 && (
              <p className="pd__points">
                <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                هتاخد {selected.points} نقطة مع الطلب ده
              </p>
            )}
          </div>
        </div>

        {nextTier && (
          <div className="pd__deal-hint">
            كمّل {nextTier.remaining} كمان من نفس الصنف عشان تاخده بـ {nextTier.unitPrice} ج.م للوحدة
          </div>
        )}

        {freeGiftDeals.map((deal) => (
          <div key={deal.id} className="pd__deal-hint pd__deal-hint--gift">
            🎁 اشتري {deal.config.buyQty} تاخد {deal.config.freeQty} مجانًا
          </div>
        ))}

        <div className="pd__section">
          <h3 style={{ fontSize: 'var(--fs-body)', marginBottom: 'var(--sp-1)' }}>عن المنتج</h3>
          <p className="text-muted">
            {product.name} — منتج أصلي من الماحي للتوزيع، بيوصلك بنفس جودة المخزن الرئيسي وبسعر الجملة.
          </p>
        </div>
      </div>

      {outOfStock ? (
        <div className="pd__cta container">
          <NotifyMeButton unitId={selected.id} productName={product.name} unitLabel={selected.unit} variant="block" />
        </div>
      ) : (
        <div className="pd__cta container">
          {qty === 0 ? (
            <button type="button" className="btn btn--primary btn--block" onClick={() => addItem(cartItem)}>
              إضافة للسلة — {effectivePrice} ج.م
            </button>
          ) : (
            <div className="row row--between pd__cta-row">
              <QuantityStepper
                qty={qty}
                onChange={(v) => setQty(selected.id, v)}
                size="lg"
                max={getEffectiveMax(selected)}
                min={selected.minQty ?? 1}
                step={selected.qtyStep ?? 1}
              />
              <span className="price">{qty * effectivePrice} ج.م</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
