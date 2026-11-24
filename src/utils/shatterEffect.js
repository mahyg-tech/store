// =============================================================================
// تأثير "الفرقعة" عند إغلاق بوب أب الترحيب — بياخد نسخة من شكل الكارت
// الحقيقي (مش صورة ثابتة أو لون واحد) ويفرّقه لعدد من القطع الصغيرة اللي
// بتطير لبرّه وتتلاشى، فبيحس المستخدم إن الكارت "فرقع وتحول لأجزاء صغيرة
// وتلاشى" بدل ما يختفي فجأة أو يتلاشى ككتلة واحدة.
//
// الطريقة: مفيش أي screenshot (html2canvas أو حاجة زيها) — كل قطعة هي
// نسخة كاملة (cloneNode) من عنصر الكارت نفسه، متحطوطة في صندوق صغير
// overflow:hidden في مكان القطعة دي بالظبط من الكارت، ومزحزحة بإزاحة
// سالبة عشان يبان منها بس الجزء المطلوب (نفس خدعة الـ sprite). لما كل
// القطع دي تتحط جنب بعض، الشكل الكامل للكارت بيبان زي ما هو — وبعدين كل
// قطعة بتطير في اتجاهها (بعيدًا عن نص الكارت) وتتلاشى.
//
// مينفعش يتطبّق على عنصر React حي مباشرة (مش بنلمس شجرة الـ React خالص)؛
// بيتحط في عنصر مستقل بـ position:fixed فوق كل حاجة، وبيشيل نفسه لوحده
// بعد ما الأنيميشن يخلص.
// =============================================================================

const PIECE_ANIMATION_NAME = 'popup-shatter-piece'

/**
 * بيفرّق شكل `sourceNode` (أي عنصر DOM حقيقي، زي كارت بوب أب الترحيب)
 * لقطع صغيرة بتطير وتتلاشى. بيرجّع فورًا؛ القطع بتتحط كعنصر مستقل فوق
 * كل حاجة ({@link document.body}) وبتشيل نفسها لوحدها بعد الأنيميشن.
 */
export function spawnShatterEffect(sourceNode, { rows = 4, cols = 4, duration = 650 } = {}) {
  if (!sourceNode || typeof document === 'undefined') return

  const rect = sourceNode.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '9999',
    pointerEvents: 'none',
  })

  const cellWidth = rect.width / cols
  const cellHeight = rect.height / rows
  const centerX = rect.width / 2
  const centerY = rect.height / 2

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const piece = document.createElement('div')
      Object.assign(piece.style, {
        position: 'absolute',
        top: `${row * cellHeight}px`,
        left: `${col * cellWidth}px`,
        width: `${cellWidth}px`,
        height: `${cellHeight}px`,
        overflow: 'hidden',
      })

      // نسخة كاملة من الكارت، مزحزحة سالب عشان القطعة دي تبين منها بس
      // الجزء اللي في مكانها — بنلغي أي transform/transition موروثة عشان
      // الأنيميشن يبدأ من الوضع الطبيعي بالظبط من غير أي قفشة بصرية
      const clone = sourceNode.cloneNode(true)
      Object.assign(clone.style, {
        position: 'absolute',
        top: `${-row * cellHeight}px`,
        left: `${-col * cellWidth}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        transform: 'none',
        transition: 'none',
      })
      piece.appendChild(clone)

      // اتجاه الطيران: بعيدًا عن نص الكارت (زي شظية فعلية)، مع عشوائية بسيطة
      // في المسافة والدوران عشان مفيش قطعتين بيطيروا بنفس الشكل بالظبط
      const pieceCenterX = col * cellWidth + cellWidth / 2
      const pieceCenterY = row * cellHeight + cellHeight / 2
      const dx = pieceCenterX - centerX
      const dy = pieceCenterY - centerY
      const dist = Math.hypot(dx, dy) || 1
      const magnitude = 55 + Math.random() * 85
      const tx = (dx / dist) * magnitude + (Math.random() - 0.5) * 24
      const ty = (dy / dist) * magnitude + (Math.random() - 0.5) * 24 - 16 // ميل بسيط لفوق زي انفجار حقيقي
      const rotate = (Math.random() - 0.5) * 150
      const delay = Math.random() * 80

      piece.style.setProperty('--shatter-tx', `${tx}px`)
      piece.style.setProperty('--shatter-ty', `${ty}px`)
      piece.style.setProperty('--shatter-rot', `${rotate}deg`)
      piece.style.animation = `${PIECE_ANIMATION_NAME} ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}ms both`

      container.appendChild(piece)
    }
  }

  document.body.appendChild(container)
  setTimeout(() => container.remove(), duration + 150)
}
