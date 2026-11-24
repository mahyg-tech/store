import { Link } from 'react-router-dom'
import { Store, MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useSettings } from '../context/SettingsContext'
import './About.css'

export default function About() {
  const settings = useSettings()
  const aboutText = settings.aboutText || ''

  return (
    <div>
      <PageHeader title="عن الماحي" />
      <div className="container about-page">
        <div className="about-page__brand">
          <span className="about-page__brand-icon">
            <Store size={30} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h2 className="about-page__brand-name">الماحي هايبر ماركت</h2>
        </div>

        {aboutText ? (
          <p className="about-page__text">{aboutText}</p>
        ) : (
          <p className="text-muted">هنكتب هنا قريب نبذة عن الماحي.</p>
        )}

        <Link to="/contact" className="about-page__contact-link">
          <MessageCircle size={18} strokeWidth={1.8} aria-hidden="true" />
          تواصل معانا
        </Link>
      </div>
    </div>
  )
}
