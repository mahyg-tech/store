import { useEffect, useState } from 'react'
import { DownloadCloud, RefreshCw } from 'lucide-react'
import * as api from '../api/client'
import { getSyncMeta, syncOfflineData } from '../utils/offlineSync'
import { getImageCacheStats } from '../utils/imageCache'
import { useToast } from '../context/ToastContext'
import './OfflineSettings.css'

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

const PHASE_LABELS = { data: 'بنحمّل البيانات', images: 'بنحمّل الصور' }

/**
 * كارت في صفحة الحساب: آخر مرة اتحدثت فيها النسخة المحفوظة للأوفلاين، وزرارين:
 * تحديث دلوقتي، وتحميل كل صور المنتجات (بيستهلك باقة، فمش أوتوماتيك).
 * الكتالوج نفسه بيتحدث لوحده في الخلفية (hooks/useAutoOfflineSync.js).
 */
export default function OfflineSettings() {
  const { showToast } = useToast()
  const [meta, setMeta] = useState(getSyncMeta)
  const [stats, setStats] = useState({ count: 0, bytes: 0 })
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    getImageCacheStats().then(setStats)
  }, [meta])

  if (api.IS_MOCK_MODE) return null

  async function run(includeAllImages) {
    if (progress) return
    setProgress({ phase: 'data', done: 0, total: 1 })
    const result = await syncOfflineData({ includeAllImages, onProgress: setProgress })
    setProgress(null)
    setMeta(getSyncMeta())
    if (result.skipped === 'offline') showToast('محتاج نت عشان تحدّث')
    else if (result.ok) showToast('تم التحديث — التطبيق جاهز يشتغل بدون نت')
    else showToast('التحديث خلص بس في حاجات ماتحمّلتش، جرب تاني بعدين')
  }

  const lastSync = meta.lastSyncAt
    ? new Date(meta.lastSyncAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'لسه ماتحدّثتش'

  return (
    <section className="offline-settings card" aria-label="الاستخدام بدون نت">
      <div className="offline-settings__head">
        <DownloadCloud size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 className="offline-settings__title">الاستخدام بدون نت</h2>
      </div>
      <p className="offline-settings__line">آخر تحديث: {lastSync}</p>
      <p className="offline-settings__line">
        {meta.productCount ? `${meta.productCount} صنف محفوظ` : 'مفيش أصناف محفوظة لسه'}
        {stats.count > 0 ? ` — ${stats.count} صورة (${formatMb(stats.bytes)} ميجا)` : ''}
      </p>

      {progress ? (
        <p className="offline-settings__progress" role="status">
          {PHASE_LABELS[progress.phase] || 'بنحدّث'}… {progress.done}/{progress.total}
        </p>
      ) : (
        <div className="offline-settings__actions">
          <button type="button" className="btn btn--outline btn--block" onClick={() => run(false)}>
            <RefreshCw size={16} aria-hidden="true" /> حدّث دلوقتي
          </button>
          <button type="button" className="btn btn--outline btn--block" onClick={() => run(true)}>
            حمّل كل صور المنتجات (بيستهلك باقة)
          </button>
        </div>
      )}
    </section>
  )
}
