import { parseVideoUrl, getVideosForAnchor } from '../utils/video'
import './HomeVideoSection.css'

/**
 * بيعرض فيديوهات الصفحة الرئيسية (لو موجودة) اللي مكانها (anchor) بالظبط
 * هو ده — نفس فكرة GridPromoSection بالظبط بس للفيديوهات وبعرض الصفحة
 * الكامل. من غير فيديوهات لـ anchor ده، الكومبوننت مبيرندرش أي حاجة خالص.
 *
 * التشغيل التلقائي ممنوع تمامًا هنا: مفيش autoplay في لينك اليوتيوب/فيميو،
 * ومفيش خاصية autoPlay على تاج الفيديو — العميل هو اللي لازم يضغط بلاي.
 */
export default function HomeVideoSection({ videos, anchor }) {
  const items = getVideosForAnchor(videos, anchor)
  if (items.length === 0) return null

  return (
    <section className="container home-video-section">
      {items.map((v) => {
        const parsed = parseVideoUrl(v.videoUrl)
        if (!parsed) return null
        return (
          <div key={v.id} className="home-video-section__item">
            {v.title && <p className="home-video-section__title section-title">{v.title}</p>}
            <div className="home-video-frame">
              {parsed.type === 'file' ? (
                <video src={parsed.src} controls preload="metadata" playsInline />
              ) : (
                <iframe
                  src={parsed.embedUrl}
                  title={v.title || 'فيديو'}
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                />
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
