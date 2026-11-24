// حالة الجولة التعريفية — مرة واحدة لكل عميل على الجهاز ده. المفتاح بيعتمد
// على id العميل (أو رقمه) عشان لو عميل تاني سجل دخول على نفس الجهاز يشوفها.
const PREFIX = 'elmahi_tour_done:'

function keyFor(customer) {
  const id = customer?.id ?? customer?.phone
  return id ? PREFIX + id : null
}

export function isTourDone(customer) {
  const key = keyFor(customer)
  if (!key) return true // مفيش عميل = مفيش جولة
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return true // لو التخزين مش شغال منزعجش العميل بجولة تتكرر كل مرة
  }
}

export function markTourDone(customer) {
  const key = keyFor(customer)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* تجاهل */
  }
}

export function resetTour(customer) {
  const key = keyFor(customer)
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* تجاهل */
  }
}

// المساعد (components/VoiceAssistant.jsx) بيسمع الحدث ده عشان الجولة تفتحه/تقفله
export function setAssistantOpenForTour(open) {
  window.dispatchEvent(new CustomEvent('elmahi:assistant', { detail: { open } }))
}
