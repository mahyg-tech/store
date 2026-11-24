import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import './PageHeader.css'

// زرار الرجوع هنا بيرجّع للصفحة اللي "قبلها في ترتيب التطبيق" (نفس منطق
// زرار الرجوع الأصلي بتاع الموبايل) مش لتاريخ الصفحات اللي اتزارت — شوف
// utils/backNavigation.js. onBack اختياري لو صفحة عايزة سلوك مخصص.
export default function PageHeader({ title, onBack, action }) {
  const navigate = useNavigate()
  const goBack = useGoBack()

  function handleBack() {
    if (onBack) return onBack()
    if (!goBack()) navigate('/', { replace: true })
  }

  return (
    <header className="page-header canopy">
      <button type="button" className="page-header__back" onClick={handleBack} aria-label="رجوع">
        ›
      </button>
      <h1 className="page-header__title">{title}</h1>
      <div className="page-header__action">{action}</div>
    </header>
  )
}
