// =============================================================================
// حسابات الفلوس في إتمام الطلب (الدفع بالمحفظة الكلي/الجزئي) — دوال بحتة من
// غير React عشان تتختبر لوحدها. كل المبالغ بتتقرّب لقرشين (جنيه.قرش).
// =============================================================================

/** تقريب لقرشين (بيتفادى أخطاء الفاصلة العائمة: 0.1 + 0.2 → 0.3) */
export function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** رقم للعرض من غير أصفار زايدة: 12.5 → "12.5"، 100 → "100"، 12.55 → "12.55" */
export function formatMoney(value) {
  return String(parseFloat(roundMoney(value).toFixed(2)))
}

/**
 * بينضّف اللي العميل بيكتبه في خانة المبلغ: بيقبل الأرقام العربية والهندية
 * (٣٥٠ ← 350)، الفاصلة العربية (٫) والعادية كعلامة عشرية، بيشيل أي حروف
 * ومسافات، نقطة عشرية واحدة بس، وقرشين بعدها بالكتير. "1,250" (فاصل آلاف)
 * بيتفهم 1250 مش 1.25.
 */
export function sanitizeMoneyInput(raw) {
  let s = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, '')
    // حروف (وأي نقط بين حروف زي "ج.م") بتتشال بالكامل — وإلا لصق "ج.م 50" كان
    // هيتفهم .50 (نص جنيه) بدل 50
    .replace(/\p{L}[\p{L}.]*/gu, '')

  // فاصل الآلاف: 1,250 أو 12,345,678 (كل جزء بعد الفاصلة 3 أرقام بالظبط)
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')

  s = s.replace(/[٫,،]/g, '.').replace(/[^\d.]/g, '')

  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
    s = s.slice(0, firstDot + 3) // النقطة + قرشين
  }
  return s.replace(/^0+(?=\d)/, '') // "007" → "7"
}

/** المبلغ المكتوب كرقم متقرّب، أو null لو فاضي/مش رقم. */
export function parseMoneyInput(raw) {
  const s = sanitizeMoneyInput(raw)
  if (s === '' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? roundMoney(n) : null
}

/**
 * الحسبة الكاملة لطريقة الدفع في إتمام الطلب.
 *   payWith    : 'cash' | 'wallet'
 *   input      : اللي مكتوب في خانة مبلغ المحفظة (نص)
 *   balance    : رصيد المحفظة الحالي
 *   grandTotal : إجمالي الطلب (بالتوصيل)
 * بترجع:
 *   walletAmount : اللي هيتخصم من المحفظة فعلاً (0 لو كاش أو لو المبلغ غلط)
 *   cashDue      : اللي هيتدفع كاش عند الاستلام
 *   method       : 'cash' | 'wallet' (المحفظة غطّت كل الطلب) | 'mixed'
 *   max          : أقصى مبلغ ينفع يتدفع من المحفظة (أقل من الرصيد والإجمالي)
 *   error        : رسالة الخطأ لو المبلغ غلط (نص فاضي لو سليم)
 */
export function computeWalletPayment({ payWith, input, balance, grandTotal }) {
  const total = roundMoney(grandTotal)
  const bal = Math.max(0, roundMoney(balance))
  const max = roundMoney(Math.min(bal, total))

  if (payWith !== 'wallet') {
    return { walletAmount: 0, cashDue: total, method: 'cash', max, error: '' }
  }

  const amount = parseMoneyInput(input)
  let error = ''
  if (amount === null || amount <= 0) {
    error = 'اكتب المبلغ اللي هتدفعه من المحفظة'
  } else if (amount > bal) {
    error = `المبلغ أكبر من رصيدك (${formatMoney(bal)} ج.م)`
  } else if (amount > total) {
    error = 'المبلغ أكبر من إجمالي الطلب'
  }

  if (error) {
    return { walletAmount: 0, cashDue: total, method: 'cash', max, error }
  }

  const cashDue = roundMoney(total - amount)
  return { walletAmount: amount, cashDue, method: cashDue <= 0 ? 'wallet' : 'mixed', max, error: '' }
}
