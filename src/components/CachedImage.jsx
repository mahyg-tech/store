import { useEffect, useState } from 'react'
import { cacheImage, getCachedImageUrl, peekImageUrl } from '../utils/imageCache'

/**
 * بديل <img> بيعرض الصورة من الكاش المحلي (IndexedDB) لو موجودة — فتفضل
 * ظاهرة من غير نت — وإلا بيحمّلها من الشبكة وأول ما تتحمّل بنحفظ نسخة منها
 * (utils/imageCache.js). نفس props بتاعة <img> بالظبط (className, style,
 * draggable, onLoad…)، فبيتبدّل بها من غير ما الـ CSS يتغيّر.
 *
 * لو الصورة مش متخزنة ومفيش نت، بنخفيها بدل ما تبان أيقونة صورة مكسورة
 * (الحاوية بتاعتها بتفضل محتفظة بحجمها وخلفيتها).
 */
export default function CachedImage({ src, alt = '', onLoad, onError, ...rest }) {
  const [resolved, setResolved] = useState(() => (src ? peekImageUrl(src) || null : null))
  const [checked, setChecked] = useState(() => Boolean(src && peekImageUrl(src)))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!src) {
      setResolved(null)
      setChecked(true)
      return undefined
    }
    const inMemory = peekImageUrl(src)
    if (inMemory) {
      setResolved(inMemory)
      setChecked(true)
      return undefined
    }

    let cancelled = false
    setChecked(false)
    getCachedImageUrl(src)
      .then((url) => {
        if (cancelled) return
        setResolved(url)
        setChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setResolved(null)
        setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  // لحد ما نعرف الصورة متخزنة ولا لأ مبنرسمش حاجة (بدل ما نبدأ تحميل من
  // الشبكة وبعدين نبدّل للمحلي ويحصل وميض/صورة مكسورة أوفلاين)
  if (!src || !checked || failed) return null

  return (
    <img
      {...rest}
      src={resolved || src}
      alt={alt}
      onLoad={(e) => {
        // اتحمّلت من الشبكة لأول مرة → نخزّن نسخة للأوفلاين
        if (!resolved) cacheImage(src)
        if (onLoad) onLoad(e)
      }}
      onError={(e) => {
        setFailed(true)
        if (onError) onError(e)
      }}
    />
  )
}
