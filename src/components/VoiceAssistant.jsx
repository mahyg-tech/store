import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Send, ShoppingBag } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { SpeechRecognition as NativeSpeechRecognition } from '@capgo/capacitor-speech-recognition'
import * as api from '../api/client'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useDeals } from '../context/DealsContext'
import { useAssistantAnnounce } from '../context/AssistantAnnounceContext'
import { getEffectiveMax, snapToStep, formatQty } from '../utils/qty'
import { getDealProductIds, explainDeal } from '../utils/deals'
import {
  parseAddCommand,
  parseQuantityOnly,
  findUnitIndexByHint,
  rankProductsByQueryWords,
  splitIntoSegments,
  isGreeting,
  isDealsQuery,
  setProductAliases,
  setAssistantReplies,
  resolveCustomReply,
} from '../utils/voiceCommand'
import { findBestReplyMatch, DEFAULT_FUZZY_THRESHOLD } from '../utils/fuzzyMatch'
import { fetchInbox, planInbox, getSeenState, markSeen, onInboxCheckRequested } from '../utils/assistantInbox'
import { isTourBusy } from '../utils/popupBridge'
import './VoiceAssistant.css'

// المساعد الصوتي — "شات المندوب": أيقونة عائمة في الرئيسية، بتفتح شات
// بسيط تتكلم فيه (أو تكتب) زي "حطلي 3 بيبسي كانز"، وهو:
//  1) يفهم الكمية (حتى الكسور زي "اتنين ونص") واسم الصنف بقواعد نصية
//     محلية بسيطة (utils/voiceCommand.js) — من غير أي API لأي نموذج لغوي.
//  2) يدوّر على الصنف بنفس البحث الموجود أصلاً (api.fetchSearch)، وبعدين
//     بيرتّب النتايج محليًا حسب قد إيه كل صنف قريب من كلام المستخدم —
//     حتى لو ترتيب الكلمات مختلف عن اسم الصنف الفعلي.
//  3) لو الصنف واحد بس اتقال في الجملة: بيقفل الشات ويفتح فعلاً صفحة
//     الصنف (/product/:id)، ويضيفه للسلة أوتوماتيك (شوف
//     pages/ProductDetail.jsx — بيتعامل مع location.state.voiceAdd).
//  4) لو المستخدم طلب أكتر من صنف في نفس الجملة (زي "3 بيبسي و 2 كولا")،
//     بيحلّهم واحد واحد جوه الشات نفسه (من غير ما يفتح صفحة كل صنف على
//     حدة)، وبعد ما يضيفهم كلهم للسلة بيوديك على صفحة السلة تشوف الكل.
//
// التعرف على الصوت: جوه تطبيق الموبايل (Capacitor) بيستخدم
// @capgo/capacitor-speech-recognition (اللي بيوصل لمحرك التعرف على الصوت
// الأصلي في اندرويد/iOS)، لأن الـ Web Speech API العادي مش متاح جوه
// WebView Capacitor. لو نفس الكود شغال كموقع عادي في متصفح (مش جوه
// التطبيق)، بيرجع تلقائي لـ Web Speech API المدمجة في المتصفح (كروم
// بالذات). في الحالتين، مفيش أي اتصال بأي سيرفر تاني غير نفس الـ API
// بتاع التطبيق (fetchSearch).

const GREETING =
  'أهلاً! قوللي أو اكتبلي محتاج ايه، مثلاً: «حطلي 3 بيبسي كانز» وأنا هفتحهولك وأضيفه في السلة 🛒\nوتقدر كمان تسألني عن العروض الحالية في أي وقت.'

const GREETING_REPLIES = [
  'أهلاً بيك! 👋 قوللي محتاج ايه وهضيفهولك.',
  'أهلاً وسهلاً! تحت أمرك، قولّي عايز تضيف ايه.',
  'هاي! جاهز أساعدك في طلبك، قولّي محتاج ايه.',
]

function pickGreetingReply() {
  return GREETING_REPLIES[Math.floor(Math.random() * GREETING_REPLIES.length)]
}

// =====================================================================
// إحساس "التفكير البشري" — الردود المحسوبة محليًا (رد مخصص/فازي/تحية)
// كانت بتتبعت في نفس الملي ثانية اللي المستخدم بيدوس فيها إنتر، وده
// اللي بيكشف إنه كود جامد مش AI بيفكر ويرد. الحل: نستنى فترة عشوائية
// قصيرة (مش ثابتة زي الآلة) قبل ما نظهر الرد، مع إظهار مؤشر الكتابة
// busy طول الفترة دي. فيه مدتين:
//   - FULL (450–950ms): لردود محصلش قبلها أي استنى حقيقي (رد مخصص/
//     فازي/تحية) — عشان تحس إنه "قاعد يقرا ويرد"، مش بيرمي جملة جاهزة
//   - SHORT (250–550ms): لتأكيدات جاية بعد عملية استغرقت وقت شبكة
//     فعلي بالفعل (بحث عن صنف مثلاً) — عشان منزودش انتظار فوق اللي
//     المستخدم استناه أصلاً
// أخطاء الشبكة/الفهم (catch blocks) اتسابت من غير تأخير عمدًا — رسالة
// خطأ "بتفكر" فيها إيحاء مضلل، الأفضل تظهر على طول
// =====================================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// بيستنى لحد ما الشرط يبقى false (أو تعدّي المهلة)
async function waitWhile(predicate, maxMs, stepMs = 500) {
  const start = Date.now()
  while (predicate() && Date.now() - start < maxMs) {
    await sleep(stepMs)
  }
}

function randomFullThinkDelay() {
  return 450 + Math.random() * 500
}

function randomShortThinkDelay() {
  return 250 + Math.random() * 300
}

// صيغ متنوعة لتأكيد إضافة صنف واحد (مسار الصنف الواحد اللي بيفتح صفحته)
const PRODUCT_ADD_REPLIES = [
  (qtyUnit, name) => `تمام! هحطلك ${qtyUnit} من "${name}" 🛒`,
  (qtyUnit, name) => `جاهز! هفتحلك "${name}" وأضيف ${qtyUnit} على طول 👍`,
  (qtyUnit, name) => `ماشي، هحط ${qtyUnit} من "${name}" في السلة دلوقتي 🚀`,
]
function pickProductAddReply(qtyUnit, name) {
  return PRODUCT_ADD_REPLIES[Math.floor(Math.random() * PRODUCT_ADD_REPLIES.length)](qtyUnit, name)
}

// نفس الفكرة لتأكيد كل صنف جوه مسار "أكتر من صنف في نفس الجملة"
const MULTI_ITEM_CONFIRM_REPLIES = [
  (qtyUnit, name) => `تمام، ${qtyUnit} من "${name}" ✅`,
  (qtyUnit, name) => `اتسجل، ${qtyUnit} من "${name}" ✅`,
  (qtyUnit, name) => `ماشي، هضيف ${qtyUnit} من "${name}" ✅`,
]
function pickMultiItemConfirmReply(qtyUnit, name) {
  return MULTI_ITEM_CONFIRM_REPLIES[Math.floor(Math.random() * MULTI_ITEM_CONFIRM_REPLIES.length)](qtyUnit, name)
}

// ملخص نهائي لمسار "أكتر من صنف" بعد ما يتضافوا كلهم للسلة
const BATCH_ADD_SUCCESS_REPLIES = [
  (addedCount, totalCount) => `تمام! ضفت ${addedCount} من ${totalCount} صنف للسلة، هوديك عليها دلوقتي 🛒`,
  (addedCount, totalCount) => `خلاص، ${addedCount} من ${totalCount} صنف اتضافوا للسلة، هوديك عليها دلوقتي 🛒`,
  (addedCount, totalCount) => `تمام كده، ضفتلك ${addedCount} من ${totalCount} صنف، وهوديك السلة دلوقتي 🛒`,
]
function pickBatchAddSuccessReply(addedCount, totalCount) {
  return BATCH_ADD_SUCCESS_REPLIES[Math.floor(Math.random() * BATCH_ADD_SUCCESS_REPLIES.length)](addedCount, totalCount)
}

// ملخصات مسار "كل الأنواع/الأصناف/الأطعمة" (bulk-type) — نسختين،
// بحسب لو في أصناف نفدت من المخزون ولا لأ
const BULK_ADD_SUCCESS_REPLIES = [
  (qty, query, addedCount) => `تمام! ضفت ${qty} من كل صنف فيه "${query}" (${addedCount} صنف) للسلة، هوديك عليها دلوقتي 🛒`,
  (qty, query, addedCount) => `خلاص، حطيت ${qty} في كل الـ ${addedCount} صنف اللي فيهم "${query}"، هوديك على السلة دلوقتي 🛒`,
]
function pickBulkAddSuccessReply(qty, query, addedCount) {
  return BULK_ADD_SUCCESS_REPLIES[Math.floor(Math.random() * BULK_ADD_SUCCESS_REPLIES.length)](qty, query, addedCount)
}

const BULK_ADD_PARTIAL_REPLIES = [
  (qty, query, addedCount, outOfStockCount) =>
    `تمام! ضفت ${qty} من ${addedCount} صنف فيه "${query}"، و${outOfStockCount} كانوا نفدوا من المخزن. هوديك على السلة دلوقتي 🛒`,
  (qty, query, addedCount, outOfStockCount) =>
    `خلاص، ${addedCount} صنف فيهم "${query}" اتضافوا بـ${qty} لكل واحد، بس ${outOfStockCount} كانوا نافدين. هوديك على السلة دلوقتي 🛒`,
]
function pickBulkAddPartialReply(qty, query, addedCount, outOfStockCount) {
  return BULK_ADD_PARTIAL_REPLIES[Math.floor(Math.random() * BULK_ADD_PARTIAL_REPLIES.length)](
    qty,
    query,
    addedCount,
    outOfStockCount,
  )
}

// صيغ متنوعة لما مالقيناش الصنف اللي اتطلب — بتتكرر في أكتر من مسار
// (صنف واحد / أكتر من صنف / كل الأنواع)، فـ descriptor بيحدد الصياغة
// المناسبة لكل مسار (اسمه "X" / فيه "X")
const NOT_FOUND_REPLIES = [
  (descriptor) => `مالقيتش صنف ${descriptor}`,
  (descriptor) => `معنديش حاجة ${descriptor} للأسف`,
  (descriptor) => `دورت ومالقيتش حاجة ${descriptor}`,
]
function pickNotFoundReply(descriptor) {
  return NOT_FOUND_REPLIES[Math.floor(Math.random() * NOT_FOUND_REPLIES.length)](descriptor)
}

// صيغتين لسؤال "أنهي وحدة بيع؟" لما الصنف عنده أكتر من وحدة
const UNIT_CHOICE_QUESTIONS = [
  (name) => `"${name}" عنده أكتر من وحدة بيع، تحب تاخد إيه؟`,
  (name) => `متاح لـ"${name}" أكتر من وحدة — تختار انهي واحدة؟`,
]
function pickUnitChoiceQuestion(name) {
  return UNIT_CHOICE_QUESTIONS[Math.floor(Math.random() * UNIT_CHOICE_QUESTIONS.length)](name)
}

let msgIdCounter = 0
function nextId() {
  msgIdCounter += 1
  return msgIdCounter
}

// =====================================================================
// الأيقونة العائمة بقت قابلة للسحب — العميل يقدر يحركها لأي حتة في
// الشاشة وتفضل محفوظة مكانها (localStorage) لما يفتح التطبيق تاني.
// نفس فكرة السحب في WelcomePopup.jsx (مؤشر دراجدRef يميّز "سحبة فعلية"
// عن "دوسة عادية" عشان فتح الشات يفضل شغال لو العميل دوس من غير ما يحرك
// حاجة)، بس هنا السحب حر بكل الاتجاهات (x,y) مش أفقي بس.
// =====================================================================
const FAB_POS_KEY = 'elmahi_assistant_fab_pos'
const FAB_SIZE = 56
const FAB_EDGE_MARGIN = 8
const FAB_DRAG_CLICK_GUARD = 6 // أقل حركة تعتبر سحب فعلي، مش دوسة هزت الصباع شوية

function readFabPos() {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    if (!raw) return null
    const pos = JSON.parse(raw)
    if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) return pos
  } catch {
    /* تجاهل */
  }
  return null
}

function saveFabPos(pos) {
  try {
    localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos))
  } catch {
    /* تجاهل — مش حرج، هترجع للمكان الافتراضي بس */
  }
}

// بيمنع الأيقونة إنها تتسحب برّه حدود الشاشة، أو فوق الهيدر/تحت شريط
// التنقل السفلي (بنقرا ارتفاعه من الـ CSS variable نفسها المستخدمة في
// المكان الافتراضي، عشان لو اتغيّر مستقبلاً يفضل الحساب صح)
function clampFabPos(x, y) {
  let bottomClearance = 76
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height')
    const px = parseFloat(raw)
    if (Number.isFinite(px)) bottomClearance = px + 16
  } catch {
    /* تجاهل */
  }
  const maxX = Math.max(FAB_EDGE_MARGIN, window.innerWidth - FAB_SIZE - FAB_EDGE_MARGIN)
  const maxY = Math.max(FAB_EDGE_MARGIN, window.innerHeight - FAB_SIZE - bottomClearance)
  return {
    x: Math.min(Math.max(x, FAB_EDGE_MARGIN), maxX),
    y: Math.min(Math.max(y, FAB_EDGE_MARGIN), maxY),
  }
}

function unitsOf(product) {
  return product.units && product.units.length > 0 ? product.units : [product]
}

// كشف طلب "كل الأنواع/الأصناف/الأطعمة" — يعني "حط الكمية دي في كل صنف
// فيه الكلمة اللي قالها" بدل "دوّرلي على صنف واحد بس"، زي:
// "2 شيبسي في النوع" أو "3 بيبسي في كل الأصناف" أو "5 عصير في الطعم".
// كلمة التفعيل لازم تيجي مع "في" أو "كل" عشان منلخبطش مع صنف اسمه فيه
// كلمة "نوع"/"صنف"/"طعم" لوحدها بالصدفة
const BULK_TYPE_TRIGGER = new RegExp(
  [
    'في\\s*(?:كل\\s*)?(?:الأنواع|الانواع|أنواع|انواع|النوع|نوع)',
    'في\\s*(?:كل\\s*)?(?:الأصناف|الاصناف|أصناف|اصناف|الصنف|صنف)',
    'في\\s*(?:كل\\s*)?(?:الأطعمة|الاطعمة|أطعمة|اطعمة|الطعم|طعم)',
    'كل\\s*(?:الأنواع|الانواع|أنواع|انواع|نوع)',
    'كل\\s*(?:الأصناف|الاصناف|أصناف|اصناف|صنف)',
    'كل\\s*(?:الأطعمة|الاطعمة|أطعمة|اطعمة|طعم)',
  ].join('|'),
  'g',
)

function isBulkTypeCommand(text) {
  BULK_TYPE_TRIGGER.lastIndex = 0
  return BULK_TYPE_TRIGGER.test(text)
}

// بنشيل عبارة التفعيل نفسها من الجملة قبل ما نبعتها لـ parseAddCommand
// عشان تفضل شغالة بنفس منطق فهم الكمية/الصنف الموجود من غير ما تتلخبط
// بكلمة زي "النوع" وهي بتحاول تلاقي اسم الصنف
function stripBulkTypeTrigger(text) {
  BULK_TYPE_TRIGGER.lastIndex = 0
  return text.replace(BULK_TYPE_TRIGGER, ' ').replace(/\s+/g, ' ').trim()
}

// تحويل رصيد من المحفظة — فعل "حول" له معنيين في العربي (تحويل فلوس، أو
// "حول كذا" بمعنى "عن/بخصوص")، فمش كافي لوحده. بنعتبرها أمر تحويل بس لو
// اتقال مع رقم موبايل واضح في نفس الجملة (isTransferCommand تحت) — ده
// عمليًا بيلغي أي لبس من غير ما يضيع الصياغة الطبيعية "حول 50 لرقم 01..."
const TRANSFER_TRIGGER = /حوّ?ل|تحويل/
// رقم موبايل مصري: 01 + (0 فودافون / 1 اتصالات / 2 أورنج / 5 We) + 8
// أرقام = 11 رقم بالظبط، بنفس الصيغة اللي الباك إند بيقبلها
const EGYPT_PHONE_PATTERN = /01[0125]\d{8}/

// المُستخدمة فعليًا في handleUserText — لازم فعل التحويل *و* رقم موبايل
// واضح مع بعض، مش الفعل لوحده (شوف التعليق فوق)
function isTransferCommand(text) {
  return TRANSFER_TRIGGER.test(text) && EGYPT_PHONE_PATTERN.test(text)
}

function extractPhoneNumber(text) {
  const match = text.match(EGYPT_PHONE_PATTERN)
  return match ? match[0] : null
}

// بيدوّر على أول رقم في الجملة عدا رقم الموبايل نفسه (لو موجود) — بيغطي
// "حول 50 لرقم 01..." و"حول لرقم 01... 50 جنيه" مع بعض. مبيفهمش أرقام
// مكتوبة بالحروف (زي "خمسين") في السياق ده حاليًا — لو قال رقم بالحروف
// هيوصله سؤال توضيحي "قد إيه؟" وهيقدر يرد برقم عادي وقتها
function extractAmount(text, phoneToExclude) {
  const withoutPhone = phoneToExclude ? text.replace(phoneToExclude, ' ') : text
  const match = withoutPhone.match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const value = parseFloat(match[0])
  return Number.isFinite(value) ? value : null
}

// جوه تطبيق Capacitor الأصلي، نستخدم الـ plugin (SpeechRecognizer الأصلي).
// في متصفح عادي (مش جوه التطبيق)، نرجع لـ Web Speech API المدمجة.
const IS_NATIVE_APP = Capacitor?.isNativePlatform?.() ?? false
const BrowserSpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const SPEECH_SUPPORTED = IS_NATIVE_APP || Boolean(BrowserSpeechRecognitionCtor)

// رسائل بلسان المساعد بعتها الأدمن من لوحة التحكم (لعميل معين أو بث لكل
// العملاء، شوف assistant-messages.php) — بنستخدم localStorage عشان
export default function VoiceAssistant() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const { isAuthenticated } = useAuth()
  const loggedIdsRef = useRef(new Set())
  const logRef = useRef(null)
  const recognitionRef = useRef(null)
  const pendingQtyRef = useRef(null) // دالة استكمال (qty) => void — مستني رد فيه رقم بس
  const multiQueueRef = useRef([]) // أجزاء الجملة اللي لسه محتاجة تتحل (لطلب فيه أكتر من صنف)
  const multiResolvedRef = useRef([]) // { product, unitId, quantity } اتحلوا وجاهزين يتضافوا للسلة
  const assistantRepliesRef = useRef([]) // نسخة خام من ردود لوحة التحكم — مستخدمة في المطابقة المرنة (fuzzyMatch.js)
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { deals } = useDeals()
  const { dismiss: dismissAnnouncement } = useAssistantAnnounce()

  // مكان الأيقونة العائمة — null يعني "استخدم المكان الافتراضي بتاع CSS"
  // (لحد ما العميل يسحبها أول مرة)
  const [fabPos, setFabPos] = useState(readFabPos)
  const [fabDragging, setFabDragging] = useState(false)
  const fabRef = useRef(null)
  const fabDragStartRef = useRef(null) // { pointerX, pointerY, originX, originY }
  const fabDraggedRef = useRef(false) // آخر إفلات كان فيه سحب فعلي؟ (يمنع فتح الشات بعد السحب بالغلط)

  // لو الشاشة اتلفت أو اتغيّر مقاسها وهي متحركة، نتأكد إنها لسه جوه الحدود
  useEffect(() => {
    function onResize() {
      setFabPos((prev) => (prev ? clampFabPos(prev.x, prev.y) : prev))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function startFabDrag(clientX, clientY) {
    const rect = fabRef.current?.getBoundingClientRect()
    const originX = fabPos?.x ?? rect?.left ?? FAB_EDGE_MARGIN
    const originY = fabPos?.y ?? rect?.top ?? 0
    fabDragStartRef.current = { pointerX: clientX, pointerY: clientY, originX, originY }
    fabDraggedRef.current = false
    setFabDragging(true)
  }

  function moveFabDrag(clientX, clientY) {
    const start = fabDragStartRef.current
    if (!start) return
    const dx = clientX - start.pointerX
    const dy = clientY - start.pointerY
    if (Math.abs(dx) > FAB_DRAG_CLICK_GUARD || Math.abs(dy) > FAB_DRAG_CLICK_GUARD) fabDraggedRef.current = true
    setFabPos(clampFabPos(start.originX + dx, start.originY + dy))
  }

  function endFabDrag() {
    if (!fabDragStartRef.current) return
    fabDragStartRef.current = null
    setFabDragging(false)
    setFabPos((prev) => {
      if (prev) saveFabPos(prev)
      return prev
    })
  }

  function handleFabTouchStart(e) {
    const t = e.touches[0]
    startFabDrag(t.clientX, t.clientY)
  }
  function handleFabTouchMove(e) {
    const t = e.touches[0]
    moveFabDrag(t.clientX, t.clientY)
  }
  function handleFabTouchEnd() {
    endFabDrag()
  }

  // نفس فكرة WelcomePopup.jsx: بنسمع move/up على النافذة كلها (مش بس
  // الأيقونة) عشان السحب يفضل شغال حتى لو المؤشر خرج برّه حدودها —
  // مهم هنا بالذات لأنها أيقونة صغيرة سهل الماوس يتخطاها وهو بيتحرك سريع
  function handleFabMouseDown(e) {
    startFabDrag(e.clientX, e.clientY)
    const handleMove = (ev) => moveFabDrag(ev.clientX, ev.clientY)
    const handleUp = () => {
      endFabDrag()
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  function handleFabClick() {
    // بعد سحبة فعلية، منفتحش الشات — الدوسة دي كانت إفلات السحب مش قصد
    // العميل يفتح المساعد
    if (fabDraggedRef.current) {
      fabDraggedRef.current = false
      return
    }
    setOpen(true)
  }

  // لو المساعد كان بيبلّغ بعرض (فقاعة + صوت) والعميل فتح الشات أو ضغط الميكروفون،
  // نقفل الفقاعة ونوقف صوتها — عشان الميكروفون مايسمعش صوت المساعد نفسه
  useEffect(() => {
    if (open || listening) dismissAnnouncement()
  }, [open, listening, dismissAnnouncement])

  // فتح/قفل الشيت بحركة انزلاق، ورسالة ترحيب أول مرة بس
  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 20)
    setMessages((prev) => (prev.length === 0 ? [{ id: nextId(), role: 'assistant', text: GREETING, noLog: true }] : prev))
    return () => clearTimeout(timer)
  }, [open])

  // الجولة التعريفية (components/OnboardingTour.jsx) بتفتح/تقفل الشات بالحدث ده
  useEffect(() => {
    function onTourEvent(e) {
      if (e.detail?.open) setOpen(true)
      else closeSheet()
    }
    window.addEventListener('elmahi:assistant', onTourEvent)
    return () => window.removeEventListener('elmahi:assistant', onTourEvent)
  }, [])

  // كل رسالة جديدة في الشات (كلام العميل وردود المساعد) بتتبعت للسيرفر
  // عشان تظهر في لوحة التحكم (7 أيام بس). رسالة الترحيب ورسايل الإدارة
  // (noLog) مبتتبعتش — رسايل الإدارة أصلاً متسجلة عند السيرفر.
  useEffect(() => {
    if (!isAuthenticated) return
    const fresh = messages.filter((m) => !m.noLog && m.text && !loggedIdsRef.current.has(m.id))
    if (fresh.length === 0) return
    fresh.forEach((m) => loggedIdsRef.current.add(m.id))
    const base = Date.now()
    api
      .logAssistantChat(fresh.map((m, i) => ({ role: m.role, text: m.text, at: base + i })))
      .catch(() => {
        /* تسجيل المحادثة للعرض بس — لو فشل، مفيش أي تأثير على العميل */
      })
  }, [messages, isAuthenticated])

  // Scroll لآخر رسالة كل ما اللوج يتغيّر
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, busy])

  // وقف أي تعرّف صوتي شغال لو الكومبوننت اتشال من الشاشة
  useEffect(() => {
    return () => {
      try {
        stopListening()
      } catch {
        /* تجاهل */
      }
    }
  }, [])

  // نجيب الألقاب المسجّلة من لوحة التحكم مرة واحدة لما الأيقونة تظهر
  // (مش لما الشات يتفتح، عشان تكون جاهزة فورًا لأول رسالة)، ونحدّث بيها
  // resolveAlias في voiceCommand.js — لو الجلب فشل، بيفضل شغال بالقائمة
  // الافتراضية اللي في data/productAliases.js من غير ما يكسر حاجة
  useEffect(() => {
    let cancelled = false
    api
      .fetchProductAliases()
      .then((aliases) => {
        if (!cancelled) setProductAliases(aliases)
      })
      .catch(() => {
        /* تجاهل — هيفضل شغال بالقائمة الافتراضية */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // نفس فكرة الألقاب بالظبط، بس للردود المخصصة (أسئلة عامة زي "امتى
  // تقفلوا") من لوحة التحكم — بنسيب نسخة خام منها في assistantRepliesRef
  // كمان عشان نستخدمها في المطابقة المرنة (fuzzyMatch.js) لو المطابقة
  // الحرفية في resolveCustomReply مالقتش حاجة
  useEffect(() => {
    let cancelled = false
    api
      .fetchAssistantReplies()
      .then((replies) => {
        if (!cancelled) {
          assistantRepliesRef.current = replies || []
          setAssistantReplies(replies)
        }
      })
      .catch(() => {
        /* تجاهل */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // رسائل بلسان المساعد بعتها الأدمن من لوحة التحكم (utils/assistantInbox.js).
  // بنتأكد منها في 4 حالات:
  //  1) أول ما المساعد يتركّب = الصفحة الرئيسية اتفتحت (فتح التطبيق، أو الضغط
  //     على إشعار المساعد)
  //  2) التطبيق رجع من الخلفية
  //  3) وصل إشعار مساعد والتطبيق مفتوح (requestInboxCheck)
  //  4) العميل فتح الشات بنفسه
  // ولو فيه رسالة جديدة والشات مقفول، بيتفتح لوحده ويعرضها (autoOpen) —
  // العميل مايستناش يفتح المساعد بإيده. مفيش "تعرّف" بيتم لو العميل مسجّلش
  // دخول لسه: الجلب بيفشل بهدوء ومفيش حاجة بتتعرض.
  const mountedRef = useRef(true)
  const inboxBusyRef = useRef(false) // مفيش تشغيلين متداخلين (نفس الرسالة تتعرض مرتين)
  const runInboxCheckRef = useRef(null)

  async function runInboxCheck({ autoOpen = false, settleMs = 0 } = {}) {
    if (inboxBusyRef.current) return
    inboxBusyRef.current = true
    try {
      const plan = planInbox(await fetchInbox(), getSeenState())
      // القديم/الزيادة عن الحد الأقصى بيتسجّل "اتشاف" من غير عرض؛ اللي هيتعرض
      // بيتسجّل واحدة واحدة بعد ما يتعرض فعلاً (تحت)
      markSeen(plan.markNow)
      if (plan.toShow.length === 0) return

      if (autoOpen) {
        if (settleMs > 0) await sleep(settleMs)
        // منفتحش المساعد فوق الـ popup الترحيبي — نستنى لحد ما العميل يقفله
        await waitWhile(() => Boolean(document.querySelector('.welcome-popup-backdrop')), 60000)
        // ومنفتحش فوق الجولة التعريفية كمان (هي اللي بتفتحه وتقفله في خطوتها)؛
        // لما الجولة تخلص بيفتح بالرسايل الجديدة
        await waitWhile(() => isTourBusy(), 15 * 60 * 1000)
        // لو الصفحة اتشالت أو التطبيق راح للخلفية: نسيب الرسايل لسه "جديدة"
        // (مااتسجلتش اتشافت) وتتعرض المرة الجاية
        if (!mountedRef.current || document.visibilityState === 'hidden') return
        setOpen(true)
        await sleep(500) // حركة الفتح + رسالة الترحيب
      }

      for (const m of plan.toShow) {
        if (!mountedRef.current) return
        await respondWithDelay({ role: 'assistant', text: m.message, noLog: true }, randomShortThinkDelay)
        // لو العميل مشي من الصفحة أثناء الانتظار، الرسالة ماظهرتش فعلاً — منسجّلهاش
        // "اتشافت" عشان تتعرض المرة الجاية
        if (!mountedRef.current) return
        markSeen(m.id)
      }
    } catch {
      /* تجاهل — العميل ممكن يكون مسجّلش دخول لسه، أو مفيش نت */
    } finally {
      inboxBusyRef.current = false
    }
  }
  runInboxCheckRef.current = runInboxCheck

  useEffect(() => {
    mountedRef.current = true
    runInboxCheckRef.current?.({ autoOpen: true, settleMs: 1200 }) // 1) فتح الصفحة الرئيسية
    const unsubscribe = onInboxCheckRequested(() => runInboxCheckRef.current?.({ autoOpen: true })) // 3)

    // 2) رجوع من الخلفية: visibilitychange (ويب/WebView) + appStateChange (أصلي)
    const onVisible = () => {
      if (document.visibilityState === 'visible') runInboxCheckRef.current?.({ autoOpen: true, settleMs: 300 })
    }
    document.addEventListener('visibilitychange', onVisible)

    let disposed = false
    let appListener = null
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) runInboxCheckRef.current?.({ autoOpen: true, settleMs: 300 })
      })
        .then((handle) => {
          if (disposed) handle.remove()
          else appListener = handle
        })
        .catch(() => {})
    }

    return () => {
      disposed = true
      mountedRef.current = false
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      appListener?.remove()
    }
  }, [])

  // 4) العميل فتح الشات بنفسه
  useEffect(() => {
    if (open) runInboxCheckRef.current?.({ autoOpen: false })
  }, [open])

  function addMessage(msg) {
    setMessages((prev) => [...prev, { id: nextId(), ...msg }])
  }

  // بيظهر مؤشر الكتابة busy لفترة عشوائية (delayFn) قبل ما الرسالة
  // تتضاف فعليًا — شوف شرح FULL/SHORT فوق مع تعريف الدوال
  async function respondWithDelay(message, delayFn = randomFullThinkDelay) {
    setBusy(true)
    await sleep(delayFn())
    setBusy(false)
    addMessage(message)
  }

  // بيرد على سؤال زي "في عروض ايه؟" — بدل ما يكتفي بسرد نصي، بيفتح فعليًا
  // أول صنف عليه عرض (زي جولة إرشادية): يفتح صفحته، يهايلايت عليها،
  // ويشرح العرض، وبعدين المستخدم بيدوس "التالي" للي بعده وهكذا (شوف
  // pages/ProductDetail.jsx — بيتعامل مع location.state.dealTour)
  function startDealsTour() {
    // بس العروض اللي صاحب المتجر فعّل ليها "يظهر في جولة المساعد
    // الصوتي" من لوحة التحكم — مش كل عرض فعّال تلقائي (عرض ممكن يكون
    // شغال في حساب السلة من غير ما يكون مناسب يتعرض في جولة صوتية)
    const active = (deals || []).filter((d) => d.isActive && d.showInVoiceTour)
    if (active.length === 0) {
      addMessage({ role: 'assistant', text: 'معلش، مفيش عروض شغالة دلوقتي 🙏' })
      return
    }

    const queue = []
    for (const deal of active) {
      for (const productId of getDealProductIds(deal)) {
        queue.push({ productId, dealTitle: deal.title, explanation: explainDeal(deal) })
      }
    }

    if (queue.length === 0) {
      // مقدرناش نوصل من العروض لصفحات أصناف فعلية — رجوع لسرد نصي بسيط
      const list = active.map((d) => `• ${d.title}`).join('\n')
      addMessage({ role: 'assistant', text: `أهو العروض الحالية عندنا 🎉\n${list}` })
      return
    }

    addMessage({ role: 'assistant', text: `تمام! هوريك كل عرض على حدة (${queue.length}) 🎬` })
    setTimeout(() => {
      closeSheet()
      navigate(`/product/${queue[0].productId}`, { state: { dealTour: { queue, index: 0 } } })
    }, 500)
  }

  function closeSheet() {
    try {
      stopListening()
    } catch {
      /* تجاهل */
    }
    pendingQtyRef.current = null
    multiQueueRef.current = []
    multiResolvedRef.current = []
    setOpen(false)
  }

  // بحث "أذكى" شوية من استدعاء fetchSearch وحدة، لكن من غير أي بحث
  // بكلمة واحدة لوحدها (عشان مايترجعش نتايج عامة/مش مرتبطة) — بنجرب
  // بالترتيب ده بس:
  //  1) الجملة زي ما هي شاملة أي كلمة وحدة اتقالت (queryWithUnit) — أدق
  //     نتيجة، ومهم لو الكلمة دي فعلاً جزء من اسم الصنف في الكتالوج
  //     (زي "بيبسي كانز 330 مل")، عشان منلخبطش بينه وبين صنف تاني بس
  //     بيشترك معاه في باقي الكلمات
  //  2) لو مفيش نتيجة، نجرب من غير كلمة الوحدة (query) — ممكن تكون مش
  //     فعلاً جزء من اسم الصنف أصلاً (زي "كرتونة" قبل اسم مايتضمنهاش)
  // لو النتايج المرجعة من أي من الخطوتين أكتر من صنف، بنرتبهم محليًا
  // حسب عدد كلمات كلام المستخدم الموجودة فعلاً في اسم كل واحد (بغض
  // النظر عن ترتيبها) — ده مجرد ترتيب لنتايج بحث حقيقي بالجملة، مش
  // بحث بكلمة منفردة
  async function findMatchingProducts(query, queryWithUnit) {
    const preciseQuery = queryWithUnit || query
    let results = await api.fetchSearch(preciseQuery, 'assistant')

    if ((!results || results.length === 0) && preciseQuery !== query) {
      results = await api.fetchSearch(query, 'assistant')
    }

    if (!results || results.length === 0) return []

    const ranked = rankProductsByQueryWords(results, preciseQuery)
    return ranked.length > 0 ? ranked.map((r) => r.product) : results
  }

  // لو الكلام اتطابق مع لقب معرّف من لوحة التحكم (parsed.aliasProductIds)،
  // بنجيب الصنف/الأصناف دي بالـ id مباشرة (دقيق ١٠٠٪، من غير أي بحث
  // بالنص) — غير كده، بنرجع للبحث العادي زي ما هو
  async function resolveParsedProducts(parsed) {
    if (parsed.aliasProductIds && parsed.aliasProductIds.length > 0) {
      const products = await Promise.all(parsed.aliasProductIds.map((id) => api.fetchProduct(id).catch(() => null)))
      const found = products.filter(Boolean)
      if (found.length > 0) return found
      // اللقب موجود بس المنتجات المرتبطة بيه اتشالت/مش موجودة —
      // نرجع للبحث العادي بدل ما نوقف هنا
    }
    return findMatchingProducts(parsed.query, parsed.queryWithUnit)
  }

  // لو المستخدم مقالش كمية أصلاً، بنسأله قبل ما نضيف أي حاجة — بدل ما
  // نفترض واحدة وممكن تكون مش قصده. onResolved(qty) بتكمل أي مسار كان
  // شغال (إضافة صنف واحد، أو صنف جوه طلب فيه أكتر من صنف)
  function askQuantity(product, unitHint, onResolved) {
    pendingQtyRef.current = onResolved
    addMessage({
      role: 'assistant',
      text: `تمام، "${product.name}" — بس محتاج كمية قد إيه؟`,
      kind: 'options',
      options: [1, 2, 3, 5, 10].map((n) => ({
        id: `qty-${n}`,
        label: String(n),
        action: () => {
          addMessage({ role: 'user', text: String(n) })
          pendingQtyRef.current = null
          onResolved(n)
        },
      })),
    })
  }

  // تحويل رصيد من المحفظة لعميل تاني برقم موبايله. بنستخدم pendingQtyRef
  // نفسه (زي askQuantity بالظبط) لو المبلغ ناقص وقلنا "قد إيه؟" — نفس
  // فكرة "أي رد رقم عادي جاي دلوقتي بيحل السؤال المعلّق ده"، مفيش داعي
  // لمرجع منفصل.
  function formatMoney(amount) {
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  }

  function askTransferAmount(phone, onResolved) {
    pendingQtyRef.current = onResolved
    addMessage({
      role: 'assistant',
      text: `تحويل لرقم ${phone} — قد إيه (بالجنيه)؟`,
    })
  }

  function confirmTransfer(phone, amount) {
    addMessage({
      role: 'assistant',
      text: `هتحوّل ${formatMoney(amount)} جنيه لرقم ${phone} من محفظتك — متأكد؟`,
      kind: 'options',
      options: [
        {
          id: 'confirm-transfer',
          label: 'أيوه، حوّل',
          action: () => {
            addMessage({ role: 'user', text: 'أيوه، حوّل' })
            executeTransfer(phone, amount)
          },
        },
        {
          id: 'cancel-transfer',
          label: 'لأ، إلغاء',
          action: () => {
            addMessage({ role: 'user', text: 'لأ، إلغاء' })
            addMessage({ role: 'assistant', text: 'تمام، اتلغى التحويل.' })
          },
        },
      ],
    })
  }

  async function executeTransfer(phone, amount) {
    setBusy(true)
    try {
      const res = await api.transferWallet({ phone, amount })
      await respondWithDelay(
        {
          role: 'assistant',
          text: `تم ✅ حوّلت ${formatMoney(amount)} جنيه لـ ${res.recipientName || res.recipientPhone}. رصيدك دلوقتي ${Number(res.newBalance).toFixed(2)} جنيه.`,
        },
        randomShortThinkDelay,
      )
    } catch (err) {
      await respondWithDelay(
        { role: 'assistant', text: err.message || 'حصل خطأ في التحويل، جرب تاني' },
        randomShortThinkDelay,
      )
    } finally {
      setBusy(false)
    }
  }

  // بيعرض نتايج البحث ٥ ٥ (مش كلها مرة واحدة) — لو فيه أكتر من ٥، بيسأل
  // "تحب أعرضلك أكتر؟" بخيار أه/لأ، ولو "أه" بيعرض الـ٥ اللي بعدهم
  // وهكذا لحد ما يخلّص كل النتايج المرتبطة بالبحث. onPick(product) بتتنفذ
  // لما يختار صنف من أي صفحة (مسار الصنف الواحد أو جوه طلب فيه أكتر من صنف)
  const PRODUCT_OPTIONS_PAGE_SIZE = 5

  function showProductOptions(results, promptText, onPick, startIndex = 0) {
    const page = results.slice(startIndex, startIndex + PRODUCT_OPTIONS_PAGE_SIZE)
    const hasMore = startIndex + PRODUCT_OPTIONS_PAGE_SIZE < results.length

    addMessage({
      role: 'assistant',
      text: promptText,
      kind: 'options',
      options: page.map((p) => ({
        id: p.id,
        label: p.name,
        price: p.units?.[0]?.price,
        action: () => {
          addMessage({ role: 'user', text: p.name })
          onPick(p)
        },
      })),
    })

    if (hasMore) {
      addMessage({
        role: 'assistant',
        text: 'تحب أعرضلك أكتر؟',
        kind: 'options',
        options: [
          {
            id: 'show-more-yes',
            label: 'أه',
            action: () => {
              addMessage({ role: 'user', text: 'أه' })
              showProductOptions(results, 'اتفضل كمان:', onPick, startIndex + PRODUCT_OPTIONS_PAGE_SIZE)
            },
          },
          {
            id: 'show-more-no',
            label: 'لأ',
            action: () => {
              addMessage({ role: 'user', text: 'لأ' })
            },
          },
        ],
      })
    }
  }

  // =====================================================================
  // مسار الصنف الواحد — بيفتح فعلاً صفحة الصنف ويضيفه هناك (زي ما اتطلب
  // بالظبط: "المساعد يحرك الشاشة ويفتح الصنف فعلاً ويضيفه")
  // =====================================================================
  function goToProductAndAdd(product, quantity, unitId) {
    setTimeout(() => {
      closeSheet()
      navigate(`/product/${product.id}`, {
        state: { voiceAdd: { qty: quantity, unitId } },
      })
    }, 550)
  }

  function proceedWithProduct(product, quantity, unitHint) {
    if (quantity == null) {
      askQuantity(product, unitHint, (qty) => proceedWithProduct(product, qty, unitHint))
      return
    }

    const units = unitsOf(product)

    if (units.length > 1) {
      const matchedIdx = findUnitIndexByHint(units, unitHint)
      if (matchedIdx === -1) {
        addMessage({
          role: 'assistant',
          text: pickUnitChoiceQuestion(product.name),
          kind: 'options',
          options: units.map((u) => ({
            id: u.id,
            label: u.unit,
            price: u.price,
            action: async () => {
              addMessage({ role: 'user', text: u.unit })
              await respondWithDelay(
                { role: 'assistant', text: pickProductAddReply(`${formatQty(quantity)} ${u.unit}`, product.name) },
                randomShortThinkDelay,
              )
              goToProductAndAdd(product, quantity, u.id)
            },
          })),
        })
        return
      }
      const matchedUnit = units[matchedIdx]
      respondWithDelay(
        { role: 'assistant', text: pickProductAddReply(`${formatQty(quantity)} ${matchedUnit.unit}`, product.name) },
        randomShortThinkDelay,
      ).then(() => goToProductAndAdd(product, quantity, matchedUnit.id))
      return
    }

    respondWithDelay(
      { role: 'assistant', text: pickProductAddReply(formatQty(quantity), product.name) },
      randomShortThinkDelay,
    ).then(() => goToProductAndAdd(product, quantity, units[0].id))
  }

  // =====================================================================
  // مسار الطلب اللي فيه أكتر من صنف (زي "3 بيبسي و 2 كولا وعلبة شاي") —
  // بنحل كل صنف جوه الشات نفسه (من غير ما نفتح صفحة كل صنف)، وبعد ما
  // كل الأصناف تتحل، نضيفهم كلهم للسلة دفعة واحدة ونودّي المستخدم لصفحة
  // السلة يشوف طلبه كامل
  // =====================================================================
  function finishItem(product, unitId, quantity) {
    multiResolvedRef.current.push({ product, unitId, quantity })
    processNextSegment()
  }

  function resolveItemThenContinue(product, quantity, unitHint) {
    if (quantity == null) {
      askQuantity(product, unitHint, (qty) => resolveItemThenContinue(product, qty, unitHint))
      return
    }

    const units = unitsOf(product)

    if (units.length > 1) {
      const matchedIdx = findUnitIndexByHint(units, unitHint)
      if (matchedIdx === -1) {
        addMessage({
          role: 'assistant',
          text: pickUnitChoiceQuestion(product.name),
          kind: 'options',
          options: units.map((u) => ({
            id: u.id,
            label: u.unit,
            price: u.price,
            action: async () => {
              addMessage({ role: 'user', text: u.unit })
              await respondWithDelay(
                { role: 'assistant', text: pickMultiItemConfirmReply(`${formatQty(quantity)} ${u.unit}`, product.name) },
                randomShortThinkDelay,
              )
              finishItem(product, u.id, quantity)
            },
          })),
        })
        return
      }
      respondWithDelay(
        {
          role: 'assistant',
          text: pickMultiItemConfirmReply(`${formatQty(quantity)} ${units[matchedIdx].unit}`, product.name),
        },
        randomShortThinkDelay,
      ).then(() => finishItem(product, units[matchedIdx].id, quantity))
      return
    }

    respondWithDelay(
      { role: 'assistant', text: pickMultiItemConfirmReply(formatQty(quantity), product.name) },
      randomShortThinkDelay,
    ).then(() => finishItem(product, units[0].id, quantity))
  }

  async function processNextSegment() {
    const nextText = multiQueueRef.current.shift()

    if (nextText === undefined) {
      await finalizeMultiItemAdd()
      return
    }

    const parsed = parseAddCommand(nextText)
    if (!parsed) {
      addMessage({ role: 'assistant', text: `معرفتش أفهم "${nextText}" 🙏 هكمل الباقي` })
      processNextSegment()
      return
    }

    setBusy(true)
    let results
    try {
      results = await resolveParsedProducts(parsed)
    } catch (err) {
      addMessage({ role: 'assistant', text: err.message || 'حصل خطأ، هكمل الباقي' })
      setBusy(false)
      processNextSegment()
      return
    }
    setBusy(false)

    if (!results || results.length === 0) {
      await respondWithDelay(
        { role: 'assistant', text: `${pickNotFoundReply(`اسمه "${parsed.query}"`)} 🙏 هكمل الباقي` },
        randomShortThinkDelay,
      )
      processNextSegment()
      return
    }

    if (results.length === 1) {
      resolveItemThenContinue(results[0], parsed.quantity, parsed.unitHint)
      return
    }

    showProductOptions(results, `لقيت أكتر من صنف لـ"${parsed.query}"، اختار واحد:`, (p) => {
      resolveItemThenContinue(p, parsed.quantity, parsed.unitHint)
    })
  }

  async function finalizeMultiItemAdd() {
    const items = multiResolvedRef.current
    multiResolvedRef.current = []

    if (items.length === 0) {
      addMessage({ role: 'assistant', text: 'معرفتش أضيف أي صنف من الطلب ده 🙏' })
      return
    }

    let addedCount = 0
    for (const { product, unitId, quantity } of items) {
      const units = unitsOf(product)
      const unit = units.find((u) => u.id === unitId) || units[0]
      if (!unit || unit.stock === 0) continue

      const max = getEffectiveMax(unit)
      const min = unit.minQty ?? 1
      const step = unit.qtyStep ?? 1
      let qty = snapToStep(Math.max(min, quantity), step)
      if (typeof max === 'number') qty = Math.min(qty, max)

      addItem(
        {
          id: unit.id,
          name: product.name,
          price: unit.price,
          unit: unit.unit,
          minQty: unit.minQty ?? 1,
          maxQty: unit.maxQty ?? null,
          qtyStep: unit.qtyStep ?? 1,
          stock: unit.stock,
          image: product.image ?? null,
        },
        qty,
      )
      addedCount += 1
    }

    if (addedCount > 0) {
      await respondWithDelay(
        { role: 'assistant', text: pickBatchAddSuccessReply(addedCount, items.length) },
        randomShortThinkDelay,
      )
      setTimeout(() => {
        closeSheet()
        navigate('/cart')
      }, 700)
    } else {
      addMessage({ role: 'assistant', text: 'للأسف الأصناف دي نفدت من المخزن كلها 😔' })
    }
  }

  function startMultiItemFlow(segments) {
    multiQueueRef.current = segments
    multiResolvedRef.current = []
    processNextSegment()
  }

  // =====================================================================
  // مسار "كل الأنواع/الأصناف/الأطعمة" — لما المستخدم يقول كمية + كلمة
  // ويضيف عليها "في النوع"/"في الصنف"/"في الطعم" (زي "2 شيبسي في
  // النوع")، مش بنسأله "اختار واحد" زي البحث العادي — بنضيف نفس الكمية
  // لكل صنف لقيناه فيه الكلمة دي. لو صنف عنده أكتر من وحدة بيع، بناخد
  // الوحدة اللي اتلمّحلها في الجملة (زي "علبة") لو لقيناها، وإلا أول
  // وحدة بيع بتاعته — من غير ما نوقف نسأل عن كل صنف لوحده، عشان العملية
  // تفضل "ضيف الكل بضغطة" ومتتحولش لسلسلة أسئلة طويلة
  // =====================================================================
  async function addBulkQuantityToProducts(products, quantity, parsed) {
    let addedCount = 0
    let outOfStockCount = 0

    for (const product of products) {
      const units = unitsOf(product)
      const hintedIdx = findUnitIndexByHint(units, parsed.unitHint)
      const unit = hintedIdx !== -1 ? units[hintedIdx] : units[0]

      if (!unit || unit.stock === 0) {
        outOfStockCount += 1
        continue
      }

      const max = getEffectiveMax(unit)
      const min = unit.minQty ?? 1
      const step = unit.qtyStep ?? 1
      let qty = snapToStep(Math.max(min, quantity), step)
      if (typeof max === 'number') qty = Math.min(qty, max)

      addItem(
        {
          id: unit.id,
          name: product.name,
          price: unit.price,
          unit: unit.unit,
          minQty: unit.minQty ?? 1,
          maxQty: unit.maxQty ?? null,
          qtyStep: unit.qtyStep ?? 1,
          stock: unit.stock,
          image: product.image ?? null,
        },
        qty,
      )
      addedCount += 1
    }

    if (addedCount === 0) {
      await respondWithDelay(
        {
          role: 'assistant',
          text: `لقيت ${products.length} صنف فيهم "${parsed.query}" بس كلهم نفدوا من المخزن 😔`,
        },
        randomShortThinkDelay,
      )
      return
    }

    await respondWithDelay(
      {
        role: 'assistant',
        text:
          outOfStockCount === 0
            ? pickBulkAddSuccessReply(formatQty(quantity), parsed.query, addedCount)
            : pickBulkAddPartialReply(formatQty(quantity), parsed.query, addedCount, outOfStockCount),
      },
      randomShortThinkDelay,
    )

    setTimeout(() => {
      closeSheet()
      navigate('/cart')
    }, 700)
  }

  async function runBulkTypeCommand(rawText) {
    const cleaned = stripBulkTypeTrigger(rawText)
    const parsed = parseAddCommand(cleaned)

    if (!parsed) {
      addMessage({
        role: 'assistant',
        text: 'معرفتش أفهم طلبك 🙏 جرب تقول مثلاً: «2 شيبسي في كل الأنواع»',
      })
      return
    }

    setBusy(true)
    let products
    try {
      products = await resolveParsedProducts(parsed)
    } catch (err) {
      addMessage({ role: 'assistant', text: err.message || 'حصل خطأ، جرب تاني' })
      setBusy(false)
      return
    }
    setBusy(false)

    if (!products || products.length === 0) {
      await respondWithDelay(
        { role: 'assistant', text: `${pickNotFoundReply(`فيه "${parsed.query}"`)} 🙏` },
        randomShortThinkDelay,
      )
      return
    }

    if (parsed.quantity == null) {
      pendingQtyRef.current = (qty) => addBulkQuantityToProducts(products, qty, parsed)
      addMessage({
        role: 'assistant',
        text: `لقيت ${products.length} صنف فيهم "${parsed.query}" — هحط كام من كل واحد فيهم؟`,
        kind: 'options',
        options: [1, 2, 3, 5, 10].map((n) => ({
          id: `bulk-qty-${n}`,
          label: String(n),
          action: () => {
            addMessage({ role: 'user', text: String(n) })
            pendingQtyRef.current = null
            addBulkQuantityToProducts(products, n, parsed)
          },
        })),
      })
      return
    }

    addBulkQuantityToProducts(products, parsed.quantity, parsed)
  }

  // =====================================================================

  async function runCommand(rawText) {
    if (isBulkTypeCommand(rawText)) {
      runBulkTypeCommand(rawText)
      return
    }

    const segments = splitIntoSegments(rawText)
    if (segments.length > 1) {
      startMultiItemFlow(segments)
      return
    }

    const parsed = parseAddCommand(rawText)
    if (!parsed) {
      addMessage({
        role: 'assistant',
        text: 'معرفتش أفهم طلبك 🙏 جرب تقول مثلاً: «حطلي 3 بيبسي كانز»',
      })
      return
    }

    setBusy(true)
    try {
      const results = await resolveParsedProducts(parsed)

      if (!results || results.length === 0) {
        await respondWithDelay(
          {
            role: 'assistant',
            text: `${pickNotFoundReply(`اسمه "${parsed.query}"`)}. تحب تدوّر بنفسك؟`,
            kind: 'options',
            options: [
              {
                id: 'open-search',
                label: `دور على "${parsed.query}"`,
                action: () => {
                  closeSheet()
                  navigate(`/search?q=${encodeURIComponent(parsed.query)}`)
                },
              },
            ],
          },
          randomShortThinkDelay,
        )
        return
      }

      if (results.length === 1) {
        proceedWithProduct(results[0], parsed.quantity, parsed.unitHint)
        return
      }

      showProductOptions(results, 'لقيت أكتر من صنف قريب من اللي قولته، اختار أنهي واحد:', (p) => {
        proceedWithProduct(p, parsed.quantity, parsed.unitHint)
      })
    } catch (err) {
      addMessage({ role: 'assistant', text: err.message || 'حصل خطأ، جرب تاني' })
    } finally {
      setBusy(false)
    }
  }

  async function handleUserText(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    addMessage({ role: 'user', text: trimmed })

    // لو مستنيين رد على سؤال "محتاج كمية قد إيه؟"، الرد ده بيتفهم كرقم
    // بس، مش كأمر إضافة جديد ولا تحية ولا سؤال عروض. سايبينه بدون
    // تأخير وهمي عمدًا — دورة توضيح زي دي أفضل تحس سريعة، مش "بتفكر"
    if (pendingQtyRef.current) {
      const qty = parseQuantityOnly(trimmed)
      if (qty == null) {
        addMessage({ role: 'assistant', text: 'معرفتش الرقم 🙏 قوللي رقم بس، زي 2 أو 3' })
        return
      }
      const resolve = pendingQtyRef.current
      pendingQtyRef.current = null
      resolve(qty)
      return
    }

    // رد مخصص من لوحة التحكم (أسئلة عامة زي "امتى تقفلوا") — بياخد
    // أولوية على التحية/سؤال العروض المدمجين، لأنه تخصيص متعمّد من صاحب
    // المتجر. أول محاولة تطابق شبه-حرفي (resolveCustomReply الأصلية)،
    // ولو مالقتش حاجة، محاولة تانية بالمطابقة المرنة (Levenshtein +
    // Jaro-Winkler + Cosine، threshold 80% افتراضيًا) عشان صياغات
    // مختلفة تمامًا لنفس السؤال (زي "عايز اعرف المواعيد" و"امتى
    // بتفتحوا؟") توصل لنفس الرد من غير ما تتطابق حرف بحرف. الاتنين
    // دول رد فوري تمامًا (مفيش أي استنى شبكة قبلهم) فبناخدلهم مهلة
    // FULL كاملة عشان تحس إنه "بيقرا ويرد" مش بيرمي جملة جاهزة. لو
    // اتطابق أي منهم، بيوقف هنا (مش بيكمل يحاول يفهمها كأمر إضافة)
    const customReply = resolveCustomReply(trimmed)
    if (customReply) {
      respondWithDelay({ role: 'assistant', text: customReply })
      return
    }
    const fuzzyReply = findBestReplyMatch(trimmed, assistantRepliesRef.current, DEFAULT_FUZZY_THRESHOLD)
    if (fuzzyReply) {
      respondWithDelay({ role: 'assistant', text: fuzzyReply.reply })
      return
    }

    // تحويل رصيد من المحفظة لعميل تاني برقم موبايله — بياخد أولوية على
    // أمر الإضافة العادي (runCommand) عشان "حول 50 لرقم 0109..." متفسرش
    // غلط كأنه اسم منتج بيتدور عليه. isTransferCommand بتتطلب فعل
    // التحويل *و* رقم موبايل واضح مع بعض (مش الفعل لوحده، اللي ممكن
    // يبقى معناه "عن/بخصوص" مش "تحويل فلوس")
    if (isTransferCommand(trimmed)) {
      const phone = extractPhoneNumber(trimmed)
      const amount = extractAmount(trimmed, phone)
      if (amount == null || amount <= 0) {
        askTransferAmount(phone, (confirmedAmount) => {
          confirmTransfer(phone, confirmedAmount)
        })
        return
      }
      confirmTransfer(phone, amount)
      return
    }

    // تحية و/أو سؤال عن العروض — ممكن الاتنين مع بعض في نفس الرسالة
    // (زي "أهلاً، في عروض ايه؟")، فمش "else if". لو الاتنين مع بعض،
    // بنستنى رد التحية يتعرض الأول (وياخد مهلته الكاملة) قبل ما نفتح
    // جولة العروض، عشان الترتيب يفضل منطقي وميظهروش مقلوبين
    const greeted = isGreeting(trimmed)
    const askedDeals = isDealsQuery(trimmed)
    if (greeted) {
      await respondWithDelay({ role: 'assistant', text: pickGreetingReply() })
    }
    if (askedDeals) {
      startDealsTour()
    }

    if (greeted || askedDeals) return

    runCommand(trimmed)
  }


  function onSubmitText(e) {
    e.preventDefault()
    if (!inputText.trim()) return
    handleUserText(inputText)
    setInputText('')
  }

  function toggleListening() {
    if (listening) {
      stopListening()
      return
    }
    if (IS_NATIVE_APP) {
      startNativeListening()
    } else {
      startBrowserListening()
    }
  }

  function stopListening() {
    if (IS_NATIVE_APP) {
      NativeSpeechRecognition.stop().catch(() => {
        /* تجاهل */
      })
    } else {
      recognitionRef.current?.stop?.()
    }
  }

  // مسار التطبيق الأصلي (Capacitor) — بيوصل لمحرك التعرف على الصوت
  // الأصلي في اندرويد/iOS عن طريق @capgo/capacitor-speech-recognition
  async function startNativeListening() {
    try {
      const { available } = await NativeSpeechRecognition.available()
      if (!available) {
        addMessage({ role: 'assistant', text: 'التعرف على الصوت مش متاح على الجهاز ده 🙏 اكتب طلبك بدل كده' })
        return
      }

      let perm = await NativeSpeechRecognition.checkPermissions()
      if (perm.speechRecognition !== 'granted') {
        perm = await NativeSpeechRecognition.requestPermissions()
      }
      if (perm.speechRecognition !== 'granted') {
        addMessage({ role: 'assistant', text: 'محتاج إذن استخدام الميكروفون عشان أقدر أسمعك 🎙️' })
        return
      }

      setListening(true)
      const result = await NativeSpeechRecognition.start({
        language: 'ar-EG',
        maxResults: 1,
        popup: false,
        partialResults: false,
      })
      const transcript = result?.matches?.[0]
      if (transcript) handleUserText(transcript)
    } catch {
      addMessage({ role: 'assistant', text: 'معرفتش أسمعك كويس، جرب تاني' })
    } finally {
      setListening(false)
    }
  }

  // مسار المتصفح العادي (لو نفس الكود شغال كموقع، مش جوه تطبيق Capacitor)
  function startBrowserListening() {
    if (!BrowserSpeechRecognitionCtor) return

    const recognition = new BrowserSpeechRecognitionCtor()
    recognition.lang = 'ar-EG'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) handleUserText(transcript)
    }
    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        addMessage({ role: 'assistant', text: 'محتاج إذن استخدام الميكروفون عشان أقدر أسمعك 🎙️' })
      } else if (event.error !== 'aborted') {
        addMessage({ role: 'assistant', text: 'معرفتش أسمعك كويس، جرب تاني' })
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={`voice-assistant-fab${fabDragging ? ' voice-assistant-fab--dragging' : ''}`}
        style={fabPos ? { left: fabPos.x, top: fabPos.y, bottom: 'auto' } : undefined}
        onClick={handleFabClick}
        onMouseDown={handleFabMouseDown}
        onTouchStart={handleFabTouchStart}
        onTouchMove={handleFabTouchMove}
        onTouchEnd={handleFabTouchEnd}
        aria-label="اتكلم مع مساعد الطلب (تقدر تسحبها لأي مكان في الشاشة)"
      >
        <Mic size={24} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`voice-assistant-backdrop${visible ? ' voice-assistant-backdrop--visible' : ''}`}
          onClick={closeSheet}
          role="presentation"
        >
          <div
            className={`voice-assistant-sheet${visible ? ' voice-assistant-sheet--visible' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="مساعد الطلب الصوتي"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="voice-assistant-sheet__header">
              <div className="row" style={{ gap: 'var(--sp-3)' }}>
                <span className="voice-assistant-sheet__avatar">
                  <ShoppingBag size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div>
                  <p className="voice-assistant-sheet__title">مساعدك للطلب</p>
                  <p className="text-caption text-muted">قوللي محتاج ايه وهضيفهولك</p>
                </div>
              </div>
              <button type="button" className="voice-assistant-sheet__close" onClick={closeSheet} aria-label="إغلاق">
                ×
              </button>
            </div>

            <div className="voice-assistant-sheet__log" ref={logRef}>
              {messages.map((m) =>
                m.kind === 'options' ? (
                  <div key={m.id} className="voice-assistant-msg voice-assistant-msg--assistant">
                    <p>{m.text}</p>
                    <div className="voice-assistant-options">
                      {m.options.map((o) => (
                        <button key={o.id} type="button" className="voice-assistant-option" onClick={o.action}>
                          <span>{o.label}</span>
                          {o.price != null && <span className="text-muted">{o.price} ج.م</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className={`voice-assistant-msg voice-assistant-msg--${m.role}`}>
                    {m.text}
                  </div>
                ),
              )}
              {busy && (
                <div className="voice-assistant-msg voice-assistant-msg--assistant voice-assistant-msg--typing">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>

            {listening && <p className="voice-assistant-listening-hint">بسمعك دلوقتي… 🎙️</p>}

            <div className="voice-assistant-sheet__footer">
              {SPEECH_SUPPORTED && (
                <button
                  type="button"
                  className={`voice-assistant-mic${listening ? ' voice-assistant-mic--live' : ''}`}
                  onClick={toggleListening}
                  aria-label={listening ? 'إيقاف الاستماع' : 'اتكلم'}
                >
                  <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
              <form className="voice-assistant-textrow" onSubmit={onSubmitText}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={SPEECH_SUPPORTED ? 'أو اكتب طلبك هنا…' : 'اكتب طلبك هنا…'}
                />
                <button type="submit" className="voice-assistant-send" aria-label="إرسال" disabled={!inputText.trim()}>
                  <Send size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
