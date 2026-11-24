import { Phone, MessageCircle, Mail, MapPin, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { useSettings } from '../context/SettingsContext'
import './ContactUs.css'

// lucide-react شالت أيقونات العلامات التجارية (فيسبوك/انستجرام...) من
// المكتبة من كذا نسخة، فبنرسمهم إحنا كـ SVG بسيط بدل ما نعتمد عليها
function FacebookIcon({ size = 20, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.5c0-.86.24-1.44 1.47-1.44h1.57V4.42C16.33 4.29 15.44 4.2 14.4 4.2c-2.32 0-3.9 1.42-3.9 4.02v2.24H7.9v2.96h2.6V21h3z" />
    </svg>
  )
}

function InstagramIcon({ size = 20, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm0 6.27a2.47 2.47 0 1 1 0-4.94 2.47 2.47 0 0 1 0 4.94z" />
      <path d="M16.9 3.5H7.1A3.6 3.6 0 0 0 3.5 7.1v9.8a3.6 3.6 0 0 0 3.6 3.6h9.8a3.6 3.6 0 0 0 3.6-3.6V7.1a3.6 3.6 0 0 0-3.6-3.6zm2.27 13.4a2.27 2.27 0 0 1-2.27 2.27H7.1a2.27 2.27 0 0 1-2.27-2.27V7.1A2.27 2.27 0 0 1 7.1 4.83h9.8A2.27 2.27 0 0 1 19.17 7.1z" />
      <circle cx="16.8" cy="7.15" r="0.9" />
    </svg>
  )
}

function whatsappLink(number) {
  const digits = String(number).replace(/\D/g, '')
  if (!digits) return null
  const local = digits.startsWith('0') ? digits.slice(1) : digits
  return `https://wa.me/20${local}`
}

export default function ContactUs() {
  const settings = useSettings()
  const contact = settings.contact || {}

  const rows = [
    contact.phone && {
      key: 'phone', Icon: Phone, label: 'اتصل بينا', value: contact.phone, href: `tel:${contact.phone}`,
    },
    contact.whatsapp && {
      key: 'whatsapp', Icon: MessageCircle, label: 'واتساب', value: contact.whatsapp, href: whatsappLink(contact.whatsapp), external: true,
    },
    contact.email && {
      key: 'email', Icon: Mail, label: 'إيميل', value: contact.email, href: `mailto:${contact.email}`,
    },
    contact.address && {
      key: 'address', Icon: MapPin, label: 'العنوان', value: contact.address,
    },
    contact.workingHours && {
      key: 'hours', Icon: Clock, label: 'مواعيد العمل', value: contact.workingHours,
    },
  ].filter(Boolean)

  const socialLinks = [
    contact.facebookUrl && { key: 'facebook', Icon: FacebookIcon, href: contact.facebookUrl, label: 'فيسبوك' },
    contact.instagramUrl && { key: 'instagram', Icon: InstagramIcon, href: contact.instagramUrl, label: 'انستجرام' },
  ].filter(Boolean)

  const hasAnything = rows.length > 0 || socialLinks.length > 0

  return (
    <div>
      <PageHeader title="تواصل معانا" />
      <div className="container contact-page">
        {!hasAnything ? (
          <EmptyState icon={MessageCircle} title="بيانات التواصل هتظهر هنا قريب" />
        ) : (
          <>
            <ul className="contact-list">
              {rows.map(({ key, Icon, label, value, href, external }) => {
                const content = (
                  <>
                    <span className="contact-row__icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span className="contact-row__text">
                      <span className="contact-row__label">{label}</span>
                      <span className="contact-row__value">{value}</span>
                    </span>
                  </>
                )
                return (
                  <li key={key} className="contact-row">
                    {href ? (
                      <a
                        className="contact-row__link"
                        href={href}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {content}
                      </a>
                    ) : (
                      <div className="contact-row__link">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>

            {socialLinks.length > 0 && (
              <div className="contact-social">
                {socialLinks.map(({ key, Icon, href, label }) => (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="contact-social__btn" aria-label={label}>
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
