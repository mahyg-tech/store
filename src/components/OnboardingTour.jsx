import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isTourDone, markTourDone, setAssistantOpenForTour } from '../utils/onboardingTour'
import { speakEgyptian, stopSpeaking, prefetchSpeech } from '../utils/egyptianVoice'
import { getPopupStatus, requestClosePopup, setTourBusy } from '../utils/popupBridge'
import './OnboardingTour.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MUTE_KEY = 'elmahi_tour_voice_muted'

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

// النص اللي بيتنطق: العنوان + الشرح، من غير الإيموجي والرموز اللي الصوت
// مابيعرفش يقراها. لو عايز نطق مختلف عن المكتوب لخطوة معينة ضيف لها
// حقل speech في STEPS وهيتاخد بدل العنوان والشرح.
function speechFor(step) {
  const raw = step.speech || `${step.title}. ${step.text}`
  return raw.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2713\u2B50]/gu, '').replace(/\s+/g, ' ').trim()
}

// kind: welcome (كارت في النص) | spot (بينوّر عنصر حقيقي ويكبّره) |
//       preview (كارت بصورة توضيحية لشاشات مش على الرئيسية)
// الترحيب ("ابدأ الجولة") هو أول حاجة دايماً. لو فيه بوب أب ظاهر بتتحط خطوتين
// بعد الترحيب مباشرة: شرح البوب أب وقفله، وبعدها المساعد (الشات بيتفتح تلقائياً
// بعد قفل البوب أب وده كان بيغطي على الجولة، فبنعرضه إحنا ونقفله بعد الشرح).
// من غير بوب أب الخطوات بترتيبها الأصلي.
function buildSteps(hasPopup) {
  if (!hasPopup) return STEPS
  const assistant = STEPS.find((s) => s.id === 'assistant')
  const [welcome, ...rest] = STEPS.filter((s) => s !== assistant)
  return [welcome, POPUP_STEP, assistant, ...rest]
}

// أول خطوة (لو فيه بوب أب ظاهر): بنشرحه وبعدين بنقفله بنفسنا، عشان ما يفضلش
// مغطّي على باقي الجولة. بتتضاف لأول الطابور بس لو البوب أب موجود فعلاً.
const POPUP_STEP = {
  kind: 'spot',
  selector: '.welcome-popup-card--active',
  closePopup: true,
  noScroll: true,
  title: 'هنا كل جديد',
  text: 'العروض والاصناف والاخبار الجديدة بتظهرلك هنا اول باول.',
}

const STEPS = [
  {
    kind: 'welcome',
    // "أهلاً" بالهمزة والتنوين زي باقي حتة الترحيب في التطبيق (صفحة الدخول،
    // بوب أب الترحيب، وتحية المساعد الصوتي) — مكنتش متسقة قبل كده
    title:    '        أهلاً بيك في تطبيق الماحي   ',
    text: 'اكتر من 4000 صنف بين ايديك، وفي اقل من 24 ساعة يكونوا في محلك.',
  },
  {
    kind: 'spot',
    selector: '.home-cat-grid .home-cat-card, .home-cat-grid a',
    grow: true,
    title: 'اطلب من الاقسام',
    text: 'دوس على اي قسم من الرئيسية وهتلاقي كل اصنافه قدامك.',
  },
  {
    kind: 'spot',
    selector: '.search-bar',
    grow: true,
    title: 'او دور من البحث',
    text: 'اكتب اسم الصنف في البحث وهيظهرلك على طول.',
  },
  {
    kind: 'spot',
    selector: '.bottom-nav__item--profile',
    grow: true,
    title: 'محفظتك والكاش باك',
    text: 'من تاب حسابي هتلاقي محفظتك، وفيها اي كاش باك او رصيد بيتضاف لحسابك.',
  },
  {
    id: 'assistant',
    kind: 'spot',
    selector: '.voice-assistant-sheet',
    open: true,
    settleMs: 550,
    title: 'المساعد الذكي بتاعك',
    text: 'اطلب منه اللي عاوزه كتابة او بالصوت، وهو يجيبهولك ويضيفه للسلة.',
  },
  {
    kind: 'spot',
    selector: '.product-card',
    grow: true,
    title: 'ضيف الصنف وزوّد الكمية',
    text: 'دوس اضافة وزوّد الكمية براحتك، وهيظهرلك شريط السلة بالاجمالي.',
    preview: 'cartbar',
  },
  {
    kind: 'spot',
    selector: '.bottom-nav__item--fab',
    grow: true,
    title: 'خلصت نواقصك؟',
    text: 'زرار السلة هيكبر، دوس عليه.',
  },
  {
    kind: 'preview',
    preview: 'review',
    title: 'راجع اصنافك',
    text: 'عدّل الكميات او شيل اي صنف من هنا قبل ما تكمل.',
  },
  {
    kind: 'preview',
    preview: 'checkout',
    title: 'اكّد الطلب والعنوان',
    text: 'اتأكد من عنوانك واضغط تأكيد الطلب.',
  },
  {
    kind: 'preview',
    preview: 'success',
    last: true,
    title: 'تم الطلب ✓',
    text: 'وعد مننا: هنحارب اي ظروف عشان طلبك يبقى عندك في اقل من 24 ساعة، ومستنيين تقييمك لخدمتنا ⭐⭐⭐⭐⭐',
  },
]

function Preview({ type }) {
  if (type === 'cartbar') {
    return (
      <div className="tour-mock tour-mock--cartbar">
        <span className="tour-mock__badge">3</span>
        <span>اعرض السلة</span>
      </div>
    )
  }
  if (type === 'review') {
    return (
      <div className="tour-mock">
        {[
          ['حليب بخيره 1/2 لتر', 2],
          ['بيبسي كانز اسود', 1],
        ].map(([name, qty]) => (
          <div key={name} className="tour-mock__row">
            <span className="tour-mock__name">{name}</span>
            <span className="tour-mock__stepper">
              <i>−</i>
              <b>{qty}</b>
              <i>+</i>
            </span>
          </div>
        ))}
      </div>
    )
  }
  if (type === 'checkout') {
    return (
      <div className="tour-mock">
        <div className="tour-mock__row">
          <span>📍 عنوان التوصيل</span>
        </div>
        <div className="tour-mock__address">الاسكندرية — عنوانك المحفوظ</div>
        <div className="tour-mock__btn">تأكيد الطلب</div>
      </div>
    )
  }
  if (type === 'success') {
    return (
      <div className="tour-mock tour-mock--success">
        <div className="tour-mock__check">✓</div>
        <strong>طلبك اتأكد!</strong>
      </div>
    )
  }
  return null
}

export default function OnboardingTour() {
  const { customer, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const [active, setActive] = useState(false)
  const [idx, setIdx] = useState(0)
  // null = كارت في النص من غير تنوير | {top,left,width,height} = عنصر منوّر
  const [rect, setRect] = useState(null)
  const [muted, setMuted] = useState(readMuted)
  const [steps, setSteps] = useState(STEPS)
  const startedRef = useRef(false)

  // بداية الجولة: أول مرة العميل يوصل للرئيسية بعد تسجيل الدخول (أو بعد "إعادة
  // الجولة" من حسابي). بنستنى لحد ما البوب أب الترحيبي/المساعد يتقفلوا.
  useEffect(() => {
    if (!isAuthenticated || pathname !== '/' || active || startedRef.current) return undefined
    if (isTourDone(customer)) return undefined

    let cancelled = false
    // من اللحظة دي المساعد مايفتحش نفسه فوق الجولة (حتى قبل ما تظهر)
    setTourBusy(true)
    ;(async () => {
      // نستنى لحد ما نعرف فيه بوب أب ولا لأ (مش لحد ما يتقفل)، وكمان الشات
      // المفتوح ومنتظرين الشاشة تبقى ظاهرة
      const t0 = Date.now()
      while (!cancelled && Date.now() - t0 < 60000) {
        const popupKnown = getPopupStatus() !== 'pending' || Date.now() - t0 > 6000
        const chatOpen = document.querySelector('.voice-assistant-backdrop')
        if (popupKnown && !chatOpen && document.visibilityState === 'visible') break
        await sleep(300)
      }
      if (cancelled) return
      await sleep(500)
      if (cancelled) return
      // لو البوب أب ظاهر: أول خطوة تشرحه وبعدين تقفله
      setSteps(buildSteps(getPopupStatus() === 'shown'))
      startedRef.current = true
      setIdx(0)
      setRect(null)
      setActive(true)
    })()
    return () => {
      cancelled = true
      // لو الجولة ما بدأتش (العميل مشي من الرئيسية قبل ما تبدأ) نفك الحظر
      if (!startedRef.current) setTourBusy(false)
    }
  }, [isAuthenticated, pathname, customer, active])

  // لو العميل خرج من الرئيسية أو سجل خروج وسط الجولة، نقفلها من غير ما نعتبرها خلصت
  useEffect(() => {
    if (active && (!isAuthenticated || pathname !== '/')) {
      setActive(false)
      startedRef.current = false
      setTourBusy(false)
    }
  }, [active, isAuthenticated, pathname])

  // تنوير العنصر المستهدف للخطوة الحالية
  useEffect(() => {
    if (!active) return undefined
    const step = steps[idx]
    setRect(null)
    if (step.kind !== 'spot') return undefined

    let cancelled = false
    let el = null
    let timer = null

    if (step.open) setAssistantOpenForTour(true)

    ;(async () => {
      const t0 = Date.now()
      while (!cancelled && Date.now() - t0 < 3000) {
        el = document.querySelector(step.selector)
        if (el) break
        await sleep(150)
      }
      if (cancelled) return
      // العنصر مش موجود (مثلاً الأصناف لسه بتتحمل): نعرض الكارت في النص بدل ما نقف
      if (!el) return
      if (step.settleMs) await sleep(step.settleMs)
      if (cancelled) return
      // البوب أب جواه شريط overflow:hidden، والسكرول عليه كان هيزحزح الكروت
      if (!step.noScroll) {
        try {
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
        } catch {
          /* تجاهل */
        }
      }
      if (step.grow) el.classList.add('tour-grow')
      const measure = () => {
        if (!el || !el.isConnected) return
        const r = el.getBoundingClientRect()
        const next = { top: r.top, left: r.left, width: r.width, height: r.height }
        setRect((prev) =>
          prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.width - next.width) < 1 && Math.abs(prev.height - next.height) < 1
            ? prev
            : next
        )
      }
      measure()
      timer = setInterval(measure, 120)
    })()

    return () => {
      cancelled = true
      clearInterval(timer)
      if (el) el.classList.remove('tour-grow')
      if (step.open) setAssistantOpenForTour(false)
    }
  }, [active, idx, steps])

  // نزّل صوت كل الخطوات مقدّمًا أول ما الجولة تبدأ عشان تتنطق فورًا
  useEffect(() => {
    if (active && !muted) prefetchSpeech(steps.map(speechFor))
  }, [active, muted, steps])

  // انطق الخطوة الحالية، وأي تغيير (خطوة جديدة / كتم / قفل الجولة) بيوقف
  // الصوت القديم الأول
  useEffect(() => {
    if (!active || muted) return undefined
    // تأخير بسيط: نطق المتصفح بيضيع لو اتنادى في نفس اللحظة بعد cancel()
    const timer = setTimeout(() => {
      speakEgyptian(speechFor(steps[idx]))
    }, 200)
    return () => {
      clearTimeout(timer)
      stopSpeaking()
    }
  }, [active, idx, muted, steps])

  function toggleMute() {
    const next = !muted
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0')
    } catch {
      /* تجاهل */
    }
    setMuted(next)
  }

  // خطوة البوب أب: أول ما العميل يعدّيها (التالي) أو يتخطى الجولة نقفل البوب أب
  function leaveStep() {
    if (steps[idx]?.closePopup) requestClosePopup()
  }

  function next() {
    leaveStep()
    setIdx((i) => i + 1)
  }

  function finish() {
    leaveStep()
    stopSpeaking()
    markTourDone(customer)
    setActive(false)
    startedRef.current = false
    setTourBusy(false)
  }

  if (!active) return null

  const step = steps[idx]
  const isWelcome = step.kind === 'welcome'
  const isLast = idx === steps.length - 1

  // مكان الكارت: تحت العنصر لو فيه مساحة، وإلا فوقه، وإلا أعلى الشاشة
  const CARD_H = 230
  let cardStyle = {}
  if (rect) {
    const below = window.innerHeight - (rect.top + rect.height)
    if (below >= CARD_H) cardStyle = { top: rect.top + rect.height + 16 }
    else if (rect.top >= CARD_H) cardStyle = { bottom: window.innerHeight - rect.top + 16 }
    else cardStyle = { top: 16 }
  }

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="جولة تعريفية">
      <div className="tour-blocker" />
      {rect ? (
        <div
          className="tour-spot"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className={`tour-card${rect ? '' : ' tour-card--center'}`} style={cardStyle}>
        <button
          type="button"
          className="tour-voice-btn"
          onClick={toggleMute}
          aria-label={muted ? 'شغّل الصوت' : 'اكتم الصوت'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {!isWelcome && (
          <div className="tour-dots" aria-hidden="true">
            {steps.map((st, i) =>
              st.kind === 'welcome' ? null : (
                <span key={i} className={`tour-dot${i === idx ? ' tour-dot--on' : ''}`} />
              )
            )}
          </div>
        )}
        {step.kind === 'preview' && <Preview type={step.preview} />}
        <h3 className="tour-card__title">{step.title}</h3>
        <p className="tour-card__text">{step.text}</p>
        {step.kind === 'spot' && step.preview && <Preview type={step.preview} />}

        <div className="tour-card__actions">
          {!isLast && (
            <button type="button" className="btn btn--ghost" onClick={finish}>
              تخطي
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (isLast ? finish() : next())}
          >
            {isWelcome ? 'ابدأ الجولة' : isLast ? 'يلا نبدأ' : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  )
}
