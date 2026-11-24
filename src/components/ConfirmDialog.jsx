import { useEffect, useState } from 'react'
import './ConfirmDialog.css'

/**
 * نافذة تأكيد من تصميم التطبيق بدل window.confirm (اللي بيظهر في أندرويد
 * بعنوان "localhost says"). لو requireReason=true بتظهر خانة سبب إجبارية
 * وزرار التأكيد بيفضل مقفول لحد ما العميل يكتب سبب (3 حروف على الأقل).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'رجوع',
  danger = false,
  requireReason = false,
  reasonLabel = 'السبب',
  reasonPlaceholder = '',
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  const trimmed = reason.trim()
  const canConfirm = !busy && (!requireReason || trimmed.length >= 3)

  return (
    <div className="confirm-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-card__title">{title}</h3>
        {message && <p className="confirm-card__message">{message}</p>}

        {requireReason && (
          <label className="confirm-card__field">
            <span>{reasonLabel}</span>
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              placeholder={reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </label>
        )}

        {error && <p className="confirm-card__error">{error}</p>}

        <div className="confirm-card__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
