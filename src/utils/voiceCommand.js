// =============================================================================
// فهم أوامر المساعد الصوتي — قواعد نصية بسيطة (تقسيم لكلمات + قواميس)،
// من غير أي استدعاء لأي API خاص بنموذج لغوي. المدخل نص عربي (سواء جاي من
// Web Speech API أو مكتوب يدوي)، والمخرج: { quantity, unitHint, query }
// جاهزين نبحث بيهم في المنتجات عن طريق api.fetchSearch(query) الموجودة
// أصلاً (نفس البحث اللي في SearchPage) — أو نرتب بيهم نتايج البحث محليًا
// عن طريق rankProductsByQueryWords.
//
// مهم: نص البحث النهائي (query) بيتبني من كلمات النص الأصلي زي ما
// المستخدم قالها بالظبط (إملاء عادي، "ة" مش "ه" مثلاً) — عشان البحث في
// المنتجات بيقارن نص كامل (substring) جوه اسم الصنف زي ما هو مسجّل في
// قاعدة البيانات. التطبيع (توحيد الهمزة/الألف/التاء المربوطة...) بيتستخدم
// بس داخليًا عشان نتعرف على كلمات الأمر والعدد والوحدة، مش في نص البحث.
//
// الجمل/الألقاب البديلة للمنتجات (زي "بيبسي الاسود" = صنف معين بعينه)
// متعرّفة في ملف منفصل: data/productAliases.js — عدّل هناك، مش هنا.
// =============================================================================

import { PRODUCT_ALIASES } from '../data/productAliases'

const ARABIC_INDIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

// كلمات عدد شائعة بالعامية المصرية والفصحى — الأشكال المختلفة لنفس الرقم
// (حرف تاء بدل ثاء، إلخ) متسابة عمدًا لأن normalizeArabic بتوحّد بس
// اختلافات الهمزة/الألف/التاء المربوطة، مش الحروف المختلفة فعلاً.
// كل مفتاح هنا لازم يكون كلمة واحدة (بدون مسافة) عشان خوارزمية الفحص
// كلمة-كلمة تلاقيه.
const NUMBER_WORDS = {
  'واحد': 1, 'واحدة': 1, 'وحدة': 1,
  'اتنين': 2, 'إتنين': 2, 'اثنين': 2, 'إثنين': 2, 'تنين': 2, 'زوج': 2,
  'تلاتة': 3, 'ثلاثة': 3, 'تلات': 3, 'ثلاث': 3, 'تلاته': 3,
  'اربعة': 4, 'أربعة': 4, 'اربع': 4, 'أربع': 4, 'اربعه': 4,
  'خمسة': 5, 'خمس': 5, 'خمسه': 5,
  'ستة': 6, 'سته': 6, 'ست': 6,
  'سبعة': 7, 'سبع': 7, 'سبعه': 7,
  'تمانية': 8, 'ثمانية': 8, 'تمن': 8, 'ثمن': 8, 'تمانيه': 8,
  'تسعة': 9, 'تسع': 9, 'تسعه': 9,
  'عشرة': 10, 'عشره': 10, 'عشر': 10,
  // من ١١ لـ ١٩ — صيغة العامية "فُعلاشر"
  'حداشر': 11,
  'اتناشر': 12, 'دستة': 12, 'دزينة': 12,
  'تلتاشر': 13, 'تلاتاشر': 13,
  'اربتاشر': 14, 'اربعتاشر': 14,
  'خمستاشر': 15,
  'ستاشر': 16, 'سطاشر': 16,
  'سبعتاشر': 17,
  'تمنتاشر': 18, 'تمانتاشر': 18,
  'تسعتاشر': 19,
  // عشرات (أكتر من كده نادر في طلب بضاعة عادي)
  'عشرين': 20, 'تلاتين': 30, 'اربعين': 40, 'خمسين': 50,
}

// كسور شائعة في الكلام العامي — "نص"/"نصف" لوحدها = 0.5، "ربع" لوحدها
// = 0.25، وكمان ممكن تيجي ملزوقة بحرف عطف بعد رقم زي "ونص"/"ونصف"/"وربع"
// (اتنين ونص = 2.5)، أو منفصلة بمسافة "و نص"/"و ربع"
const HALF_WORDS = ['نص', 'نصف']
const QUARTER_WORDS = ['ربع']
const HALF_SUFFIX_FUSED = ['ونص', 'ونصف']
const QUARTER_SUFFIX_FUSED = ['وربع']

// كلمات/عبارات تحية — لو الرسالة عبارة عن تحية بس (أو تحية + كلام تاني)،
// بنرد عليها مباشرة من غير ما نحاول نفهمها كأمر إضافة صنف
const GREETING_WORDS = [
  'السلام عليكم', 'وعليكم السلام',
  'أهلا وسهلا', 'اهلا وسهلا', 'أهلا', 'اهلا',
  'مرحبا', 'هاي', 'هلا',
  'صباح الخير', 'صباح النور', 'مساء الخير', 'مساء النور',
  'ازيك', 'ازيكي', 'ازيكم', 'عامل ايه', 'عاملة ايه', 'اخبارك',
]

// كلمات/عبارات بتدل على سؤال عن العروض/الخصومات الحالية
const DEALS_QUERY_WORDS = [
  'ايه العروض', 'عروض ايه', 'في عروض', 'فيه عروض', 'عندكم عروض', 'العروض',
  'عروض', 'خصومات', 'تخفيضات', 'في خصم', 'فيه خصم', 'عندكم خصم',
  'ايه الجديد', 'في جديد', 'فيه جديد', 'جديد ايه', 'عروض النهاردة', 'عروض اليوم',
]

// كلمات/عبارات بتدل على نية "ضيف/حط" — بتتشال من نص البحث عشان يفضل
// اسم الصنف بس. عبارات من كذا كلمة مسموحة هنا (زي "من فضلك ضيف")
const ADD_TRIGGER_WORDS = [
  'ياريت تضيف', 'ممكن تضيف', 'ممكن تحط', 'من فضلك ضيف', 'من فضلك حط',
  'حط لي', 'حطيلي', 'حطهالي', 'حطلي', 'حط',
  'ضيف لي', 'ضيفيلي', 'ضيفهالي', 'ضيفلي', 'ضيفي', 'ضيف',
  'هات لي', 'هاتلي', 'هات', 'جيب لي', 'جيبلي', 'جيب',
  'اشتري لي', 'اشتريلي', 'اشتري',
  'ابعت لي', 'ابعتلي',
  'اطلب لي', 'اطلبلي', 'اطلب',
  'ودي لي', 'وديلي', 'ودّي',
  'لاقي لي', 'لاقيلي',
  'زود لي', 'زودلي', 'زود', 'كمّل', 'كمل',
  'عايزة', 'عاوزة', 'عايز', 'عاوز', 'محتاجة', 'محتاج', 'نفسي في',
]

// كلمات حشو/تأدّب أو توضيح مالهاش دخل باسم الصنف نفسه
const FILLER_WORDS = [
  'من فضلك', 'لو سمحت', 'لو سمحتي', 'لو تكرمت', 'ياريت', 'ممكن',
  'كده بقى', 'بقى', 'كده', 'يا رب', 'يا فندم', 'يا باشا', 'يا عم', 'يا ريس',
  'طيب', 'خلاص', 'بجد', 'بس',
  'اقصد', 'أقصد', 'قصدي', 'يعني', 'مقصدي',
]

// كلمات وحدة/عبوة شائعة — بتتستخدم لتحديد وحدة البيع المطلوبة لو الصنف
// عنده أكتر من وحدة (علبة/كرتونة...). مقسومة لمجموعات حسب النوع بس
// عشان تبقى سهلة المراجعة/الإضافة لاحقًا
const UNIT_WORDS = [
  // عبوات وصناديق
  'علبة', 'علب', 'كرتونة', 'كراتين', 'صندوق', 'صناديق', 'عبوة', 'عبوات',
  // أكياس وشنط
  'كيس', 'اكياس', 'جوالة', 'شنطة', 'شيكارة',
  // زجاجات وبرطمانات
  'زجاجة', 'زجاجات', 'برطمان', 'برطمانات',
  // أكواب وكانز
  'كوب', 'اكواب', 'كانز',
  // باكيتات ورولات وأنابيب
  'باكيت', 'باكو', 'رول', 'رولات', 'تيوب', 'انبوبة', 'أنبوبة',
]

const LEADING_PREPOSITIONS = ['من', 'في', 'علي', 'على']

// بنطبّع جمل الألقاب مرة واحدة بس (مش في كل مرة يتكلم فيها المستخدم) —
// بادئين بالقائمة الافتراضية في data/productAliases.js (وضع mock)، وممكن
// تتحدّث وقت التشغيل بـ setProductAliases() لما تيجي من لوحة التحكم عن
// طريق api.fetchProductAliases() (شوف VoiceAssistant.jsx)
function buildAliasesNorm(aliases) {
  return (aliases || []).map((entry) => ({
    normPhrases: [...new Set((entry.phrases || []).map(normalizeArabic).filter(Boolean))],
    productIds: entry.productIds || [],
  }))
}

let PRODUCT_ALIASES_NORM = buildAliasesNorm(PRODUCT_ALIASES)

/**
 * بتحدّث قائمة الألقاب اللي resolveAlias بتدوّر فيها — استخدمها لما تجيبي
 * الألقاب الحقيقية من الباك إند (لوحة التحكم) بدل القائمة الثابتة في
 * data/productAliases.js. بتطبّع كل حاجة مرة واحدة هنا (مش في كل نداء)
 * عشان الأداء يفضل زي ما هو حتى مع آلاف الألقاب.
 */
export function setProductAliases(aliases) {
  PRODUCT_ALIASES_NORM = buildAliasesNorm(aliases)
}

// =====================================================================
// مطابقة تقريبية (fuzzy matching) — حل احتياطي لو مفيش تطابق تام (زي
// substring) عشان يتحمّل غلطات إملائية بسيطة (حرف ناقص/زايد/متبدّل) في
// كل حاجة العميل بيقولها للألقاب/التحيات/سؤال العروض/الردود المخصصة.
// مبنية على Levenshtein distance (عدد التعديلات المطلوبة لتحويل نص
// لنص) — كود بسيط بالكامل، من غير أي API أو نموذج ذكاء اصطناعي.
// =====================================================================

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1, // إضافة حرف
        prev[j] + 1, // حذف حرف
        prev[j - 1] + cost, // تبديل حرف
      )
    }
    prev = curr
  }
  return prev[n]
}

// نسبة التشابه المطلوبة عشان نعتبرها تطابق (80% زي المتعارف عليه غالبًا)
const FUZZY_MATCH_THRESHOLD = 0.8

/**
 * بتقارن phrase بأقرب "نافذة" من نفس عدد كلماته جوه normText (مش النص
 * كامل بالضرورة — عشان لو الغلطة الإملائية جوه جملة أطول، زي "طب عروظ
 * ايه عندكم"، مقارنة الجملة كلها بـ"عروض ايه" هتدّي نسبة واطية غلط
 * بسبب اختلاف الطول، مع إن الجزء المهم قريب جدًا فعليًا). بترجع أعلى
 * نسبة تشابه لقيناها لو عدّت حد القبول (threshold)، أو -1 لو مفيش
 * نافذة قريبة كفاية.
 *
 * ملحوظة: الكلمات القصيرة جدًا (٣-٤ حروف) عمليًا مابتستفيدش من
 * المطابقة التقريبية، لأن غلطة حرف واحد فيها بتنزّل بالنسبة تحت 80%
 * غالبًا (زي "اهلا"→"اهلن") — وده متعمّد: خفّضنا الحد لكلمات قصيرة
 * قبل كده، لكن لقينا كلمة زي "شاي" بتتطابق غلط مع "هاي" (فرق حرف واحد
 * بس)، فرجّعنا الحد الموحّد 80% للكل عشان الأمان أهم من تغطية الأخطاء
 * الإملائية في الكلمات القصيرة تحديدًا.
 */
function bestWindowScore(normText, phrase, threshold) {
  const textWords = normText.split(' ').filter(Boolean)
  const phraseWordCount = phrase.split(' ').filter(Boolean).length || 1
  const windows =
    textWords.length <= phraseWordCount
      ? [normText]
      : Array.from({ length: textWords.length - phraseWordCount + 1 }, (_, i) =>
          textWords.slice(i, i + phraseWordCount).join(' '),
        )

  let best = -1
  for (const window of windows) {
    const dist = levenshtein(window, phrase)
    const maxLen = Math.max(window.length, phrase.length)
    const score = maxLen === 0 ? 1 : 1 - dist / maxLen
    if (score >= threshold && score > best) best = score
  }
  return best
}

/**
 * بتدور عن أقرب عنصر في مصفوفة "عناصر" (كل واحد عنده قائمة جمل مطبّعة
 * بيرجعها getPhrases(item)) لنص معين — تطابق تام (substring في أي
 * الاتجاهين) الأول لأنه أسرع وأدق، وبعدين تشابه تقريبي (Levenshtein)
 * كحل احتياطي بس لو مفيش تطابق تام. بترجع العنصر اللي كسب، أو null.
 */
function findBestMatch(normText, items, getPhrases, threshold = FUZZY_MATCH_THRESHOLD) {
  for (const item of items) {
    for (const p of getPhrases(item)) {
      if (normText.includes(p) || p.includes(normText)) return item
    }
  }

  let best = null
  let bestScore = -1
  for (const item of items) {
    for (const p of getPhrases(item)) {
      const score = bestWindowScore(normText, p, threshold)
      if (score > bestScore) {
        bestScore = score
        best = item
      }
    }
  }
  return best
}

// ردود مخصصة (أسئلة عامة زي "امتى تقفلوا") — نفس فكرة الألقاب بالظبط
// (تطبيع مرة واحدة، تحديث وقت التشغيل)، بس النتيجة نص رد جاهز مش id
// صنف. القائمة الافتراضية فاضية (مفيش ملف mock مخصص ليها زي الألقاب)
// لحد ما تتحدّث من لوحة التحكم عن طريق setAssistantReplies
let ASSISTANT_REPLIES_NORM = []

function buildRepliesNorm(replies) {
  return (replies || []).map((entry) => ({
    normPhrases: [...new Set((entry.phrases || []).map(normalizeArabic).filter(Boolean))],
    reply: entry.reply,
  }))
}

/**
 * بتحدّث قائمة الردود المخصصة اللي resolveCustomReply بتدوّر فيها —
 * استخدمها لما تجيبي الردود الحقيقية من الباك إند (لوحة التحكم).
 */
export function setAssistantReplies(replies) {
  ASSISTANT_REPLIES_NORM = buildRepliesNorm(replies)
}

/**
 * بتدور في الردود المخصصة الحالية (شوف setAssistantReplies) عن جملة
 * متطابقة (تمامًا، أو تقريبًا لو فيها غلطة إملائية بسيطة) مع النص
 * المُدخل، وترجع نص الرد المحفوظ، أو null لو مفيش تطابق كفاية.
 */
export function resolveCustomReply(text) {
  if (!text || !text.trim()) return null
  const normText = normalizeArabic(text.trim())
  const entry = findBestMatch(normText, ASSISTANT_REPLIES_NORM, (e) => e.normPhrases)
  return entry ? entry.reply : null
}

/**
 * بترجع true لو النص عبارة عن تحية (أو فيها تحية، أو قريبة منها إملائيًا)،
 * زي "أهلاً" أو "ازيك" أو "صباح الخير" — بنستخدمها عشان نرد عليها
 * مباشرة، من غير ما نحاول نفهمها كأمر إضافة صنف.
 */
export function isGreeting(rawText) {
  if (!rawText || !rawText.trim()) return false
  const normText = normalizeArabic(rawText.trim())
  return findBestMatch(normText, GREETINGS_NORM, (g) => [g]) !== null
}

/**
 * بترجع true لو النص سؤال عن العروض/الخصومات الحالية، زي "في عروض ايه؟"
 * أو "عندكم خصومات؟" (أو قريب منها إملائيًا).
 */
export function isDealsQuery(rawText) {
  if (!rawText || !rawText.trim()) return false
  const normText = normalizeArabic(rawText.trim())
  return findBestMatch(normText, DEALS_QUERY_NORM, (d) => [d]) !== null
}

/**
 * بتدور في قائمة الألقاب الحالية (شوف setProductAliases) عن جملة متطابقة
 * (تمامًا، أو تقريبًا لو فيها غلطة إملائية بسيطة) مع النص المُدخل،
 * وترجع مصفوفة id بتاع الصنف/الأصناف المرتبطة بيها (زي ما اتحددت من
 * لوحة التحكم)، أو null لو مفيش تطابق كفاية.
 */
function resolveAlias(text) {
  if (!text) return null
  const normText = normalizeArabic(text)
  const entry = findBestMatch(normText, PRODUCT_ALIASES_NORM, (e) => e.normPhrases)
  return entry && entry.productIds.length > 0 ? entry.productIds : null
}

function normalizeArabic(text) {
  return String(text)
    .replace(/[\u064B-\u065F\u0670]/g, '') // تشكيل
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase()
}

function toWesternDigits(text) {
  return String(text).replace(/[٠-٩]/g, (d) => ARABIC_INDIC_DIGITS[d])
}

// بتقسّم النص لكلمات، وبتشيل علامات الترقيم، من غير ما تغيّر إملاء
// الحروف العربية نفسها (عشان نص البحث النهائي يفضل زي ما المستخدم قاله).
// بتحافظ على النقطة العشرية جوه الأرقام (زي "2.5") — من غير كده، رقم
// زي "2.5 لتر" كان بينقسم لتوكنين "2" و "5"، وبعدين خطوة استخراج الكمية
// كانت بتاخد الـ"2" على إنه الكمية المطلوبة غلط، وتسيب نص البحث مبتور
// وغير مفهوم (زي "بيبسي 5" بدل "بيبسي 2.5")
function tokenizeSurface(text) {
  return text
    .replace(/[^\u0600-\u06FF0-9a-zA-Z.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((t) => t.replace(/^\.+/, '').replace(/\.+$/, '')) // شيل نقطة زايدة في أول/آخر التوكن بس
    .filter(Boolean)
}

function buildNormalizedPhraseList(words) {
  return [...new Set(words.map(normalizeArabic).filter(Boolean))].sort(
    (a, b) => b.split(' ').length - a.split(' ').length,
  )
}

function buildNormalizedMap(map) {
  const out = {}
  for (const [word, value] of Object.entries(map)) {
    out[normalizeArabic(word)] = value
  }
  return out
}

const NUMBER_WORDS_NORM = buildNormalizedMap(NUMBER_WORDS)
const ADD_TRIGGERS_NORM = buildNormalizedPhraseList(ADD_TRIGGER_WORDS)
const FILLERS_NORM = buildNormalizedPhraseList(FILLER_WORDS)
const UNIT_WORDS_NORM = buildNormalizedPhraseList(UNIT_WORDS)
const GREETINGS_NORM = buildNormalizedPhraseList(GREETING_WORDS)
const DEALS_QUERY_NORM = buildNormalizedPhraseList(DEALS_QUERY_WORDS)

// بتعلّم (keep[i] = false) على أي تتابع كلمات في normTokens بيطابق حد
// من العبارات المطبّعة في phraseListNorm (ممكن تبقى كذا كلمة)
function markPhrases(normTokens, keep, phraseListNorm) {
  for (const phrase of phraseListNorm) {
    const words = phrase.split(' ')
    const n = words.length
    for (let i = 0; i <= normTokens.length - n; i++) {
      if (!keep[i]) continue
      let match = true
      for (let j = 0; j < n; j++) {
        if (!keep[i + j] || normTokens[i + j] !== words[j]) {
          match = false
          break
        }
      }
      if (match) {
        for (let j = 0; j < n; j++) keep[i + j] = false
      }
    }
  }
}

// بتدوّر عن أول رقم في التوكنز — رقم صريح (بيدعم فاصلة عشرية زي "2.5")،
// أو كلمة عدد ("تلاتة")، مع دعم كسور شائعة بعدها زي "ونص"/"و نص" (+0.5)
// و"وربع"/"و ربع" (+0.25) — يعني "اتنين ونص" = 2.5. وكمان "نص"/"ربع"
// لوحدهم من غير رقم قبلهم (زي "نص كيلو" = 0.5). بترجع
// { value, consumed: [indexes] } أو null لو مفيش رقم. keepMask اختياري
// (لو موجود، بيتجاهل التوكنز اللي keepMask[i] === false)
function extractQuantityToken(surfaceTokens, normTokens, keepMask) {
  const isFree = (i) => !keepMask || keepMask[i]

  // 1) رقم صريح
  for (let i = 0; i < surfaceTokens.length; i++) {
    if (!isFree(i)) continue
    if (/^\d+$/.test(surfaceTokens[i])) {
      const n = parseInt(surfaceTokens[i], 10)
      if (n > 0) return { value: n, consumed: [i] }
    }
  }

  // 2) كلمة عدد، مع دعم كسر بعدها
  for (let i = 0; i < normTokens.length; i++) {
    if (!isFree(i)) continue
    const whole = NUMBER_WORDS_NORM[normTokens[i]]
    if (whole == null) continue

    const consumed = [i]
    let frac = 0
    const next1 = normTokens[i + 1]
    const next2 = normTokens[i + 2]

    if (isFree(i + 1) && HALF_SUFFIX_FUSED.includes(next1)) {
      frac = 0.5
      consumed.push(i + 1)
    } else if (isFree(i + 1) && QUARTER_SUFFIX_FUSED.includes(next1)) {
      frac = 0.25
      consumed.push(i + 1)
    } else if (isFree(i + 1) && next1 === 'و' && isFree(i + 2) && HALF_WORDS.includes(next2)) {
      frac = 0.5
      consumed.push(i + 1, i + 2)
    } else if (isFree(i + 1) && next1 === 'و' && isFree(i + 2) && QUARTER_WORDS.includes(next2)) {
      frac = 0.25
      consumed.push(i + 1, i + 2)
    }

    return { value: whole + frac, consumed }
  }

  // 3) "نص"/"ربع" لوحدهم من غير رقم قبلهم
  for (let i = 0; i < normTokens.length; i++) {
    if (!isFree(i)) continue
    if (HALF_WORDS.includes(normTokens[i])) return { value: 0.5, consumed: [i] }
    if (QUARTER_WORDS.includes(normTokens[i])) return { value: 0.25, consumed: [i] }
  }

  return null
}

/**
 * بتقسّم جملة فيها أكتر من صنف (زي "حطلي 3 بيبسي و 2 كولا و علبة شاي")
 * لأجزاء، كل جزء المفروض يبقى فيه صنف واحد — على أساس الفاصلة، أو حرف
 * العطف "و" لما يكون كلمة قائمة بذاتها بين مسافتين (عشان منقسمش كلمة
 * زي "ونص" التصقت فيها الـ"و"). بترجع array فيه جزء واحد بس لو الجملة
 * مفيهاش أكتر من صنف واضح.
 */
export function splitIntoSegments(rawText) {
  if (!rawText) return []
  return rawText
    .split(/[,،]/)
    .flatMap((part) => part.split(/\s+و\s+/))
    .map((s) => s.replace(/^\s*و\s+/, '').trim())
    .filter(Boolean)
}

/**
 * بتحلل نص أمر زي "حطلي 3 بيبسي كانز" أو "عايز كرتونة زيت عافية" وترجع:
 * { quantity, unitHint, query } — أو null لو النص فاضي/مفيش صنف واضح فيه.
 * query بترجع بنفس إملاء المستخدم الأصلي (بعد شيل كلمات الأمر/العدد/الوحدة بس).
 * quantity بترجع null (مش رقم افتراضي) لو المستخدم مقالش كمية أصلاً.
 */
export function parseAddCommand(rawText) {
  if (!rawText || !rawText.trim()) return null

  const surfaceTokens = tokenizeSurface(toWesternDigits(rawText))
  if (surfaceTokens.length === 0) return null

  const normTokens = surfaceTokens.map(normalizeArabic)
  const keep = surfaceTokens.map(() => true)

  let quantity = null
  const foundQty = extractQuantityToken(surfaceTokens, normTokens, keep)
  if (foundQty) {
    quantity = foundQty.value
    for (const idx of foundQty.consumed) keep[idx] = false
  }

  // عبارات نية الإضافة
  markPhrases(normTokens, keep, ADD_TRIGGERS_NORM)

  // كلمات حشو/تأدّب
  markPhrases(normTokens, keep, FILLERS_NORM)

  // حرف جر عالق في أول الكلام الباقي (زي "... من بيبسي")
  {
    const firstIdx = keep.findIndex(Boolean)
    if (firstIdx >= 0 && LEADING_PREPOSITIONS.includes(normTokens[firstIdx])) {
      keep[firstIdx] = false
    }
  }

  // النص لسه فيه كلمة الوحدة (لو موجودة) في النقطة دي — بنحفظها كنسخة
  // "دقيقة" (queryWithUnit) نجرب بيها البحث الأول، لأن كلمة زي "كانز"
  // ممكن تبقى فعلاً جزء أصيل من اسم الصنف في الكتالوج (زي "بيبسي كانز
  // 330 مل") مش مجرد وحدة بيع بنختارها بعدين — لو شلناها بدري ممكن نلخبط
  // بين صنفين مختلفين بيشتركوا في نفس الكلمة التانية (زي "بيبسي" لوحدها)
  const queryWithUnit = surfaceTokens.filter((_, i) => keep[i]).join(' ').trim()

  // جملة/لقب بديل معرّف من لوحة التحكم (data/productAliases.js وضع
  // mock، أو الباك إند الحقيقي) — لو النص ده (أو جزء منه) متطابق مع
  // واحدة منهم، بنرجّع id بتاع الصنف/الأصناف المرتبطة بيها مباشرة، بدل
  // ما نحاول نبحث بالنص الحرفي اللي قاله المستخدم
  const aliasProductIds = resolveAlias(queryWithUnit)

  // وحدة البيع المذكورة — بنسجّلها كـ "تلميح" لاختيار وحدة الصنف
  // المناسبة بعدين (حتى لو فيه جملة بديلة اتطابقت، برضو ممكن يكون قال
  // وحدة بيع معينة جنبها، زي "كرتونة بيبسي الاسود")، وبنشيلها كمان من
  // نسخة تانية "موسّعة" من نص البحث (query) نستخدمها لو البحث الدقيق
  // (بالكلمة) ميلاقاش حاجة — عشان كلمة زي "كرتونة" ممكن كمان تبقى مش
  // جزء من اسم الصنف أصلاً
  let unitHint = null
  for (let i = 0; i < normTokens.length; i++) {
    if (keep[i] && UNIT_WORDS_NORM.includes(normTokens[i])) {
      unitHint = normTokens[i]
      keep[i] = false
      break
    }
  }

  if (aliasProductIds) {
    return { quantity, unitHint, query: queryWithUnit, queryWithUnit, aliasProductIds }
  }

  const query = surfaceTokens.filter((_, i) => keep[i]).join(' ').trim()
  if (!query) return null

  return { quantity, unitHint, query, queryWithUnit: queryWithUnit || query, aliasProductIds: null }
}

/**
 * بترجع رقم بس من رد قصير على سؤال "محتاج كام؟" — زي "3" أو "تلاتة" أو
 * "نص كيلو" أو "اتنين ونص". بترجع null لو مفيش رقم واضح في الرد.
 */
export function parseQuantityOnly(rawText) {
  if (!rawText || !rawText.trim()) return null
  const tokens = tokenizeSurface(toWesternDigits(rawText))
  if (tokens.length === 0) return null
  const normTokens = tokens.map(normalizeArabic)
  const found = extractQuantityToken(tokens, normTokens, null)
  return found ? found.value : null
}

/**
 * بتدور جوه units[] لصنف معين عن وحدة اسمها قريب من unitHint (نص متعرّف
 * عليه بالفعل زي "كرتونة"). بترجع index الوحدة المطابقة، أو -1 لو مفيش
 * hint أصلاً أو مفيش تطابق واضح — القرار في الحالة دي (تسأل المستخدم
 * ولا تفترض) بيترك لل component اللي بيستخدم الدالة، مش بيتفرض هنا
 */
export function findUnitIndexByHint(units, unitHint) {
  if (!unitHint || !Array.isArray(units) || units.length === 0) return -1
  const idx = units.findIndex((u) => {
    const nu = normalizeArabic(u?.unit || '')
    return nu && (nu.includes(unitHint) || unitHint.includes(nu))
  })
  return idx
}

/**
 * بترتب مجموعة منتجات (زي اللي بترجع من fetchSearch) حسب عدد كلمات نص
 * البحث اللي لاقيناها جوه اسم كل منتج — بغض النظر عن ترتيب الكلمات.
 * مفيدة جدًا لما البحث الأساسي (مطابقة الجملة كاملة كنص واحد متصل)
 * ميلاقيش حاجة بس المنتج المطلوب موجود، وبس ترتيب الكلمات في اسمه مختلف
 * عن ترتيبها في كلام المستخدم (زي "1.5 لتر زيت عافية" اللي المستخدم
 * قالها، مقابل "زيت عافية ... 1.5 لتر" اسم الصنف الفعلي).
 */
export function rankProductsByQueryWords(products, query) {
  const words = [...new Set(String(query || '').split(' ').map(normalizeArabic).filter(Boolean))]
  if (words.length === 0 || !Array.isArray(products)) return []
  return products
    .map((p) => {
      const normName = normalizeArabic(p?.name || '')
      const score = words.reduce((acc, w) => acc + (normName.includes(w) ? 1 : 0), 0)
      return { product: p, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

export { normalizeArabic, resolveAlias }
