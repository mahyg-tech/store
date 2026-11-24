export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={40} strokeWidth={1.5} color="var(--color-ink-400)" aria-hidden="true" />}
      <h3 style={{ fontSize: 'var(--fs-title)' }}>{title}</h3>
      {subtitle && <p className="text-caption">{subtitle}</p>}
      {action}
    </div>
  )
}
