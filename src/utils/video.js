// =============================================================================
// تحليل لينك فيديو (يوتيوب/فيميو/لينك فيديو مباشر زي mp4) وتحويله لصيغة
// قابلة للعرض من غير تشغيل تلقائي أبدًا — العميل هو اللي لازم يضغط بلاي.
// =============================================================================

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/

export function parseVideoUrl(url) {
  if (!url) return null

  const ytMatch = url.match(YOUTUBE_RE)
  if (ytMatch) {
    // autoplay=0 صراحةً (وهو الافتراضي أصلاً) — العميل لازم يضغط بلاي بنفسه
    return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0` }
  }

  const vimeoMatch = url.match(VIMEO_RE)
  if (vimeoMatch) {
    return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0` }
  }

  // لينك فيديو مباشر (mp4/webm/إلخ) — بيتعرض بـ <video> عادي من غير autoPlay
  return { type: 'file', src: url }
}

// بترجّع فيديوهات الصفحة الرئيسية اللي anchor بتاعها هو ده بالظبط، مرتبة
// بالـ sortOrder، والـ id كمُحدد تاني عشان الترتيب يفضل ثابت لو فيه تساوي —
// نفس فكرة getPromosForAnchor بالظبط
export function getVideosForAnchor(videos, anchor) {
  if (!videos || videos.length === 0) return []

  return videos
    .filter((v) => v.anchor === anchor)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.id).localeCompare(String(b.id)))
}
