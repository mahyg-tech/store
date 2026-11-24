import { Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { useAssistantAnnounce } from '../context/AssistantAnnounceContext'
import './AssistantOfferBubble.css'

// فقاعة المساعد اللي بتظهر فوق أي شاشة لما المساعد يبلّغ العميل بعرض (شوف
// context/AssistantAnnounceContext.jsx). بتختفي لوحدها بعد كام ثانية، والعميل
// يقدر يقفلها بإيده أو يكتم صوت المساعد (بيتحفظ لحد ما يغيّره).
export default function AssistantOfferBubble() {
  const { current, muted, voiceSupported, dismiss, toggleMute } = useAssistantAnnounce()
  if (!current) return null

  return (
    // key بيخلّي الأنيميشن يتعاد لما رسالة جديدة تبدّل القديمة
    <div key={current.id} className="assistant-bubble" role="status" aria-live="polite">
      <div className="assistant-bubble__avatar" aria-hidden="true">
        <Sparkles size={18} strokeWidth={1.8} />
      </div>

      <div className="assistant-bubble__content">
        <p className="assistant-bubble__name">المساعد الذكي</p>
        {current.lines.map((line, i) => (
          <p key={i} className={`assistant-bubble__line${i === 0 ? ' assistant-bubble__line--lead' : ''}`}>
            {line}
          </p>
        ))}
      </div>

      <div className="assistant-bubble__actions">
        {voiceSupported && (
          <button
            type="button"
            className="assistant-bubble__btn"
            onClick={toggleMute}
            aria-label={muted ? 'تشغيل صوت المساعد' : 'كتم صوت المساعد'}
          >
            {muted ? <VolumeX size={16} strokeWidth={1.8} /> : <Volume2 size={16} strokeWidth={1.8} />}
          </button>
        )}
        <button type="button" className="assistant-bubble__btn" onClick={dismiss} aria-label="إغلاق">
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
