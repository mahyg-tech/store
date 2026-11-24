import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Search, Sparkles } from 'lucide-react'
import * as api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import HomeRail from '../components/HomeRail'
import PromoSliderSection from '../components/PromoSliderSection'
import GridPromoSection from '../components/GridPromoSection'
import HomeVideoSection from '../components/HomeVideoSection'
import PartnersSection from '../components/PartnersSection'
import CustomSectionsRails from '../components/CustomSectionsRails'
import WelcomePopup from '../components/WelcomePopup'
import VoiceAssistant from '../components/VoiceAssistant'
import AppIcon from '../components/AppIcon'
import PullToRefresh from '../components/PullToRefresh'
import './Home.css'
import CachedImage from '../components/CachedImage'
import { getRailPromos } from '../utils/gridPromos'
import { cacheImage, getCachedImageUrl, peekImageUrl } from '../utils/imageCache'

// مقاس أيقونة القسم (lucide) بالبكسل حسب الحجم المختار من لوحة التحكم —
// medium هو نفس الحجم القديم (32px) قبل ميزة الأحجام دي، فالأقسام اللي
// محدش غيّر حجمها هتفضل بنفس الشكل بالظبط.
const CATEGORY_ICON_PX = { small: 24, medium: 32, large: 44 }

// أنيميشن انبثاق الأقسام بيشتغل أول ما التطبيق يفتح (والريفرش العادي للصفحة
// بيصفّر الموديول فبيشتغل تاني)، مش كل ما العميل يرجع للرئيسية من صفحة تانية.
// وكمان بيتعاد يدويًا (replayCategoryPop جوه Home) في حالتين: لما بوب أب
// الترحيب يتقفل، ولما العميل يعمل سحب لتحت للتحديث.
let categoriesPopPlayed = false
const CATEGORY_POP_MAX_STAGGER_INDEX = 11 // أقصى ترتيب بيتأخر — عشان الأقسام الكتير ماتاخدش وقت طويل

/**
 * زي CachedImage.jsx بالظبط بس بترجّع الرابط (مش <img>) عشان نستخدمه
 * كـ background-image للهيدر — نفس فلسفة "اتخزنت مرة، تفضل شغالة أوفلاين"
 * المستخدمة في باقي صور التطبيق.
 */
function useCachedBackgroundImage(src) {
  const [resolved, setResolved] = useState(() => (src ? peekImageUrl(src) || src : null))

  useEffect(() => {
    if (!src) {
      setResolved(null)
      return undefined
    }
    const inMemory = peekImageUrl(src)
    if (inMemory) {
      setResolved(inMemory)
      return undefined
    }
    setResolved(src) // اعرضها من الشبكة فورًا لحد ما تتخزن محليًا
    let active = true
    getCachedImageUrl(src).then((url) => {
      if (active && url) setResolved(url)
    })
    cacheImage(src)
    return () => {
      active = false
    }
  }, [src])

  return resolved
}

export default function Home() {
  const { customer } = useAuth()
  const { homeHeaderImage, partnersAnchor } = useSettings()
  const headerImage = useCachedBackgroundImage(homeHeaderImage)
  const [categories, setCategories] = useState([])
  // popRun = عدّاد مرات تشغيل الأنيميشن. 0 = مش شغال، وكل زيادة بتغيّر الـ key
  // بتاع شبكة الأقسام فالكروت بتتركّب من جديد والأنيميشن بيبدأ من الأول.
  const [popRun, setPopRun] = useState(() => (categoriesPopPlayed ? 0 : 1))
  const popCategories = popRun > 0
  const replayCategoryPop = useCallback(() => setPopRun((n) => n + 1), [])
  const [promos, setPromos] = useState([])
  const [gridPromos, setGridPromos] = useState([])
  const [homeVideos, setHomeVideos] = useState([])
  const [newArrivals, setNewArrivals] = useState([])
  const [recommended, setRecommended] = useState([])
  const [bestSellers, setBestSellers] = useState([])
  const [partners, setPartners] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [loading, setLoading] = useState(true)

  // بعد ما الأقسام تظهر فعلًا (والأنيميشن بدأ) نعلّم إنه اتعرض خلاص
  useEffect(() => {
    if (!loading && categories.length > 0) categoriesPopPlayed = true
  }, [loading, categories.length])
  const [loadError, setLoadError] = useState('')
  const mountedRef = useRef(true)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  // متسحبة برّه الـ useEffect عشان تبقى قابلة لإعادة الاستدعاء من زرار
  // "اسحب لتحت للريفريش" (PullToRefresh) وكمان من التحميل الأول.
  //
  // forceRefresh=false (التحميل العادي عند فتح الصفحة): كل طلب بيرجع فورًا
  // من النسخة المحفوظة لو موجودة (من غير ما يستنى الشبكة خالص) ويحدّثها في
  // الخلفية هادي — شوف utils/apiCache.js. forceRefresh=true (سحب لتحت
  // للتحديث بس) بيجبر طلب شبكة حقيقي يتستنى لكل حاجة، عشان "اسحب للتحديث"
  // يفضل معناه تأكيد فعلي من السيرفر.
  const load = useCallback(async (forceRefresh = false) => {
    // forceRefresh: طلب شبكة فعلي. غير كده: النسخة المحفوظة بتتعرض فورًا،
    // وأول ما النسخة الجديدة توصل من الخلفية (لو مختلفة) onUpdate بيحدّث
    // الشاشة في نفس الفتحة — عشان ترتيب الأقسام/الفيديوهات/الشركاء من لوحة
    // التحكم يظهر فورًا مش في الفتحة اللي بعدها.
    const isList = (v) => (Array.isArray(v) ? v : [])
    const optsFor = (onUpdate) => (forceRefresh ? { forceNetwork: true } : { onUpdate: (v) => mountedRef.current && onUpdate(isList(v)) })
    try {
      // استخدام Promise.allSettled حتى لا تتوقف الصفحة لو فشل أي API فرعي
      const results = await Promise.allSettled([
        api.fetchCategories(optsFor((v) => setCategories(v.filter((c) => !c.parentId)))),
        api.fetchPromos(optsFor(setPromos)),
        api.fetchGridPromos('home', undefined, optsFor(setGridPromos)),
        api.fetchHomeVideos(optsFor(setHomeVideos)),
        api.fetchNewArrivals(optsFor(setNewArrivals)),
        api.fetchRecommended(optsFor(setRecommended)),
        api.fetchBestSellers(optsFor(setBestSellers)),
        api.fetchPartners(optsFor(setPartners)),
        api.fetchCustomSections(optsFor(setCustomSections)),
      ])

      if (!mountedRef.current) return

      // دالة مساعدة لاستخراج القيمة من الـ Promise السليم فقط
      const getValue = (res, fallback = []) =>
        res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : fallback

      const cats = getValue(results[0])
      const promoList = getValue(results[1])
      const gridPromoList = getValue(results[2])
      const homeVideoList = getValue(results[3])
      const newList = getValue(results[4])
      const recList = getValue(results[5])
      const bestList = getValue(results[6])
      const partnerList = getValue(results[7])
      const customSectionList = getValue(results[8])

      setCategories(cats.filter((c) => !c.parentId))
      setPromos(promoList)
      setGridPromos(gridPromoList)
      setHomeVideos(homeVideoList)
      setNewArrivals(newList)
      setRecommended(recList)
      setBestSellers(bestList)
      setPartners(partnerList)
      setCustomSections(customSectionList)
      setLoadError('')
    } catch (err) {
      if (mountedRef.current) setLoadError(err.message || 'حصل خطأ في تحميل الصفحة')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // شركاء النجاح بيظهروا في المكان (anchor) اللي الأدمن حدده من لوحة التحكم
  // (تاب "أقسام مخصصة بالرئيسية")، وبعد كل حاجة تانية في نفس المكان. لو
  // الإعداد مش متحدد أو قيمته غلط → آخر الصفحة زي الأول بالظبط.
  const PARTNERS_ANCHORS = ['top', 'after_main_slider', 'after_categories', 'after_new_arrivals', 'after_secondary_slider', 'after_recommended', 'after_featured']
  const partnersAt = PARTNERS_ANCHORS.includes(partnersAnchor) ? partnersAnchor : 'after_featured'
  const partnersSlot = (anchor) =>
    partnersAt === anchor ? <PartnersSection partners={partners} loading={loading} /> : null

  return (
    <PullToRefresh
      onRefresh={async () => {
        await load(true)
        if (mountedRef.current) replayCategoryPop()
      }}
    >
      {/* popup الترحيب */}
      <WelcomePopup onClose={replayCategoryPop} />

      {/* المساعد الصوتي — أيقونة عائمة تفتح "شات المندوب" */}
      <VoiceAssistant />

      {/* هيدر ثابت (sticky) — بيفضل ظاهر فوق وإنت بتنزل بالصفحة، شوف .awning في
          theme/global.css. لو الأدمن رفع صورة خلفية (من لوحة التحكم)، بتتحط
          بدل اللون الأخضر الافتراضي مع تظليل خفيف (awning__scrim) فوقها عشان
          التحية وشريط البحث يفضلوا واضحين */}
      <header
        className={`awning canopy${headerImage ? ' awning--photo' : ''}`}
        style={headerImage ? { backgroundImage: `url(${headerImage})` } : undefined}
      >
        {headerImage && <div className="awning__scrim" aria-hidden="true" />}
        <div className="awning__row">
          <div className="awning__greeting">
            <p className="awning__hello">أهلاً يا {customer?.name?.split(' ')[0] || 'زميلنا'}</p>
            <h1 className="awning__prompt">إيه اللي محتاجه النهاردة؟</h1>
          </div>
          <Link to="/search" className="search-bar awning-search-bar" aria-label="دور على منتج">
            <Search size={20} strokeWidth={2.5} aria-hidden="true" />
            <span>دور على منتج…</span>
          </Link>
        </div>
      </header>

      {loadError && !loading && (
        <section className="container" style={{ marginTop: 'var(--sp-4)' }}>
          <div
            style={{
              background: '#fdecea',
              color: '#b3261e',
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {loadError}
          </div>
        </section>
      )}

      {/* فوق كل حاجة، تحت الهيدر مباشرة — وده مكان السلايدر الرئيسي
          (القديم) بالظبط، فمستخدم نفس الـ anchor "top" عشانه */}
      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="top" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="top" />}
      {!loading && <PromoSliderSection promos={promos} anchor="top" marginTop="var(--sp-5)" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="top" loading={loading} />
      {partnersSlot("top")}

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_main_slider" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_main_slider" />}
      {!loading && <PromoSliderSection promos={promos} anchor="after_main_slider" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_main_slider" loading={loading} />
      {partnersSlot("after_main_slider")}

      {/* الأقسام */}
      <section className="container" style={{ marginTop: 'var(--sp-6)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>الأقسام</h2>
        {loading ? (
          <div className="home-cat-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 92 }} />
            ))}
          </div>
        ) : (
          <div className="home-cat-grid" key={popRun}>
            {categories.map((cat, index) => {
              const iconSize = ['small', 'medium', 'large'].includes(cat.iconSize) ? cat.iconSize : 'medium'
              return (
                <Link
                  key={cat.id}
                  to={`/category/${cat.id}`}
                  className={`home-cat-card stall home-cat-card--${iconSize}${popCategories ? ' home-cat-card--pop' : ''}`}
                  style={popCategories ? { '--pop-i': Math.min(index, CATEGORY_POP_MAX_STAGGER_INDEX) } : undefined}
                  aria-label={cat.name}
                >
                  {cat.iconImage ? (
                    <CachedImage src={cat.iconImage} alt="" className="home-cat-card__image" />
                  ) : (
                    <AppIcon name={cat.icon} size={CATEGORY_ICON_PX[iconSize]} color="var(--brand-deep)" className="home-cat-card__icon" />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_categories" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_categories" />}
      {!loading && <PromoSliderSection promos={promos} anchor="after_categories" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_categories" loading={loading} />
      {partnersSlot("after_categories")}

      {/* وارد حديثًا — "المزيد" بيفتح كل المنتجات الجديدة */}
      <HomeRail
        title="وارد حديثًا"
        icon={<Sparkles size={20} strokeWidth={2.2} color="var(--color-mango-500)" aria-hidden="true" />}
        to="/section/new"
        products={newArrivals}
        promoCards={getRailPromos(gridPromos, 'new_arrivals')}
        loading={loading}
      />

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_new_arrivals" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_new_arrivals" />}
      {/* وده مكان السلايدر التاني (القديم) بالظبط */}
      {!loading && <PromoSliderSection promos={promos} anchor="after_new_arrivals" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_new_arrivals" loading={loading} />
      {partnersSlot("after_new_arrivals")}

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_secondary_slider" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_secondary_slider" />}
      {!loading && <PromoSliderSection promos={promos} anchor="after_secondary_slider" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_secondary_slider" loading={loading} />
      {partnersSlot("after_secondary_slider")}

      {/* رشحنالك */}
      <HomeRail
        title="رشحنالك"
        to="/section/recommended"
        products={recommended}
        promoCards={getRailPromos(gridPromos, 'recommended')}
        loading={loading}
      />

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_recommended" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_recommended" />}
      {!loading && <PromoSliderSection promos={promos} anchor="after_recommended" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_recommended" loading={loading} />
      {partnersSlot("after_recommended")}

      {/* الأكثر مبيعًا (تلقائي من الأوردرات) — كان هنا قسم "الألبان طازة عندنا" واتشال.
          مكان العروض/الفيديوهات "بعد الأقسام المميزة" (after_featured) تحته لسه شغال زي ما هو
          عشان أي حاجة الأدمن ثبّتها في المكان ده ماتختفيش */}
      <HomeRail
        title="الأكثر مبيعًا"
        icon={<Flame size={20} strokeWidth={2.2} color="var(--color-mango-500)" aria-hidden="true" />}
        to="/section/best"
        products={bestSellers}
        promoCards={getRailPromos(gridPromos, 'best_sellers')}
        loading={loading}
      />

      {!loading && <GridPromoSection gridPromos={gridPromos} anchor="after_featured" />}
      {!loading && <HomeVideoSection videos={homeVideos} anchor="after_featured" />}
      {!loading && <PromoSliderSection promos={promos} anchor="after_featured" />}
      <CustomSectionsRails customSections={customSections} gridPromos={gridPromos} promos={promos} anchor="after_featured" loading={loading} />
      {partnersSlot("after_featured")}

    </PullToRefresh>
  )
}