// utils/fuzzyMatch.js
//
// خوارزميات "المطابقة المرنة" (Fuzzy Matching) — بتحسب نسبة تشابه بين
// نصين من غير ما يكونوا متطابقين حرف-بحرف، عشان صياغات مختلفة لنفس
// الجملة (أو غلطة إملائية، أو خطأ في تحويل الصوت لنص) توصل لنفس الرد
// المسجّل في app_assistant_replies بدل ما تتلف. زي باقي فهم الكلام في
// المشروع ده: حسابات نصية محلية بالكامل، من غير أي اتصال بأي API
// لموديل لغوي.
//
// ثلاث مقاييس مكمّلة لبعض، كل واحد ليه دور مختلف:
//
//   • Levenshtein  — عدد التعديلات (حذف/إضافة/تبديل حرف) اللازمة عشان
//     نص يبقى زي التاني. كويسة لأخطاء الكتابة/النطق البسيطة على مستوى
//     الجملة كلها لما طول الجملتين متقارب.
//
//   • Jaro-Winkler — مبنية أصلاً لمقارنة الكلمات القصيرة (زي الأسماء)
//     وبتدي وزن أعلى لو أول الكلمتين متطابق. مستخدمة هنا على مستوى
//     الكلمة الواحدة، لأنها بالظبط المجال اللي اتصممت له.
//
//   • Cosine (على مستوى الكلمات) — بتقارن "مجموعة كلمات" الجملتين من
//     غير ما يهمها ترتيب الكلمات أو طول الجملة الكلي. كويسة لما جملة
//     العميل فيها كلام زيادة حوالين العبارة المسجّلة (زي "عايز اعرف
//     المواعيد بتاعتكم لو سمحت").
//
// كل دالة تشابه بترجع رقم من 0 لـ 1 (0 = مفيش تشابه، 1 = تطابق تام).

export function normalizeArabic(text) {
  return String(text || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟!.,،؛:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ---------------------------------------------------------------------
// Levenshtein Distance
// ---------------------------------------------------------------------
export function levenshteinDistance(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prevRow = new Array(n + 1)
  let currRow = new Array(n + 1)
  for (let j = 0; j <= n; j++) prevRow[j] = j

  for (let i = 1; i <= m; i++) {
    currRow[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1, // حذف
        currRow[j - 1] + 1, // إضافة
        prevRow[j - 1] + cost, // تبديل
      )
    }
    ;[prevRow, currRow] = [currRow, prevRow]
  }
  return prevRow[n]
}

export function levenshteinSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

// ---------------------------------------------------------------------
// Jaro / Jaro-Winkler Similarity
// ---------------------------------------------------------------------
export function jaroSimilarity(a, b) {
  if (a === b) return 1
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0 || bLen === 0) return 0

  const matchDistance = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1)
  const aMatched = new Array(aLen).fill(false)
  const bMatched = new Array(bLen).fill(false)

  let matches = 0
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, bLen)
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue
      aMatched[i] = true
      bMatched[j] = true
      matches += 1
      break
    }
  }
  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < aLen; i++) {
    if (!aMatched[i]) continue
    while (!bMatched[k]) k += 1
    if (a[i] !== b[k]) transpositions += 1
    k += 1
  }
  transpositions = transpositions / 2

  return (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3
}

export function jaroWinklerSimilarity(a, b, prefixScale = 0.1) {
  const jaro = jaroSimilarity(a, b)
  let prefixLen = 0
  const maxPrefix = Math.min(4, a.length, b.length)
  while (prefixLen < maxPrefix && a[prefixLen] === b[prefixLen]) prefixLen += 1
  return jaro + prefixLen * prefixScale * (1 - jaro)
}

// ---------------------------------------------------------------------
// Cosine Similarity (على مستوى الكلمات)
// ---------------------------------------------------------------------
export function cosineSimilarity(a, b) {
  const wordsA = a.split(' ').filter(Boolean)
  const wordsB = b.split(' ').filter(Boolean)
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const freqA = {}
  const freqB = {}
  for (const w of wordsA) freqA[w] = (freqA[w] || 0) + 1
  for (const w of wordsB) freqB[w] = (freqB[w] || 0) + 1

  const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)])
  let dot = 0
  let magA = 0
  let magB = 0
  for (const w of allWords) {
    const x = freqA[w] || 0
    const y = freqB[w] || 0
    dot += x * y
    magA += x * x
    magB += y * y
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// ---------------------------------------------------------------------
// أعلى تشابه بين كلمة واحدة وأي كلمة في جملة (Jaro-Winkler، لأنها
// المقياس المخصص للكلمات القصيرة)
// ---------------------------------------------------------------------
function bestWordSimilarity(word, sentenceWords) {
  let best = 0
  for (const w of sentenceWords) {
    const sim = jaroWinklerSimilarity(word, w)
    if (sim > best) best = sim
  }
  return best
}

// نسبة "احتواء" جملة العميل لكلمات العبارة المسجّلة — لكل كلمة في
// العبارة، بندوّر على أقرب كلمة ليها في جملة العميل، ولو التشابه وصل
// WORD_MATCH_THRESHOLD تعتبر "اتلاقت". بترجع نسبة كلمات العبارة اللي
// اتلاقت — كويسة لما جملة العميل أطول من العبارة وفيها كلام زيادة
// حواليها
const WORD_MATCH_THRESHOLD = 0.82

function phraseContainmentScore(phraseWords, sentenceWords) {
  if (phraseWords.length === 0) return 0
  let matched = 0
  for (const w of phraseWords) {
    if (bestWordSimilarity(w, sentenceWords) >= WORD_MATCH_THRESHOLD) matched += 1
  }
  return matched / phraseWords.length
}

// ---------------------------------------------------------------------
// النسبة النهائية للتشابه بين جملة العميل وعبارة تفعيل واحدة — بناخد
// أعلى قيمة من:
//   1) تشابه النصين كاملين (Levenshtein + Jaro-Winkler) — كويسة لما
//      طول العبارة والجملة متقارب (زي "امتى بتفتحوا؟" مع "امتى بتفتحوا")
//   2) نسبة احتواء الجملة لكلمات العبارة — كويسة لما جملة العميل أطول
//      (زي "عايز اعرف المواعيد بتاعتكم لو سمحت" مع عبارة "المواعيد")
//   3) Cosine على مستوى الكلمات — مقياس عام إضافي بيراعي تكرار الكلمات
// ---------------------------------------------------------------------
export function phraseSimilarity(userText, phrase) {
  const normUser = normalizeArabic(userText)
  const normPhrase = normalizeArabic(phrase)
  if (!normUser || !normPhrase) return 0

  const fullTextScore =
    (levenshteinSimilarity(normUser, normPhrase) + jaroWinklerSimilarity(normUser, normPhrase)) / 2

  const userWords = normUser.split(' ').filter(Boolean)
  const phraseWords = normPhrase.split(' ').filter(Boolean)
  const containmentScore = phraseContainmentScore(phraseWords, userWords)
  const cosineScore = cosineSimilarity(normUser, normPhrase)

  return Math.max(fullTextScore, containmentScore, cosineScore)
}

// الحد الأدنى الافتراضي لاعتبار تطابق "كفاية" — 80%، زي المتعارف عليه
// عادةً في أنظمة المطابقة المرنة. لو حابب تخليه قابل للتعديل من لوحة
// التحكم بعدين (زي باقي القيم اللي متسجلة في app_settings)، تقدر تمرر
// threshold مختلف لـ findBestReplyMatch من غير ما تلمس الملف ده
export const DEFAULT_FUZZY_THRESHOLD = 0.8

// بيدور جوه قايمة ردود (كل عنصر فيه phrases: string[] و reply: string
// — نفس الشكل اللي بيرجعه assistant-replies.php) عن أقرب عبارة تفعيل
// لجملة العميل، وبيرجع الرد بتاعها لو النسبة وصلت threshold. بيرجع
// null لو مفيش تطابق كفاية
export function findBestReplyMatch(userText, replies, threshold = DEFAULT_FUZZY_THRESHOLD) {
  if (!userText || !userText.trim() || !Array.isArray(replies)) return null

  let best = null
  for (const entry of replies) {
    const phrases = entry.phrases || []
    for (const phrase of phrases) {
      const score = phraseSimilarity(userText, phrase)
      if (score >= threshold && (!best || score > best.score)) {
        best = { reply: entry.reply, matchedPhrase: phrase, score }
      }
    }
  }
  return best
}
