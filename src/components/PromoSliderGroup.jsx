import PromoSlider from './PromoSlider'
import { groupSlidesBySize } from '../utils/promoSlides'

// الارتفاع الأساسي (150) هو ارتفاع السلايدر "العادي"؛ القصير والنص = نصه
const HALF_RATIO = 0.5

/**
 * بيعرض شرايح سلايدر (لمكان واحد أو لصفحة قسم) حسب حجم كل شريحة:
 *   - عادي: السلايدر الحالي بالظبط.
 *   - قصير: نفس العرض بنص الارتفاع.
 *   - نص: نص العرض ونص الارتفاع — سلايدر على الشمال وسلايدر على اليمين
 *     جنب بعض في صف واحد (الشرايح اللي ليها نفس الناحية في سلايدر واحد).
 *     لو ناحية واحدة بس فيها شرايح، الناحية التانية بتفضل فاضية.
 * مفيش حاجة بتترندر لو مفيش شرايح. المسافة العلوية بين البلوكات بتتحكم
 * فيها هنا؛ الحاوية (container) والمسافة فوق أول بلوك بتيجي من اللي
 * بينادي الكومبوننت ده.
 */
export default function PromoSliderGroup({ slides, height = 150 }) {
  const blocks = groupSlidesBySize(slides)
  if (blocks.length === 0) return null

  return (
    <>
      {blocks.map((block, i) => {
        const style = i > 0 ? { marginTop: 'var(--sp-3)' } : undefined
        if (block.type === 'half') {
          return (
            <div key="half" className="promo-slider-row" style={style}>
              {['left', 'right'].map((side) => (
                <div key={side} className="promo-slider-row__cell">
                  {block[side].length > 0 && (
                    <PromoSlider
                      slides={block[side]}
                      height={height * HALF_RATIO}
                      slideWidthPercent={100}
                      compact
                      half
                    />
                  )}
                </div>
              ))}
            </div>
          )
        }
        return (
          <div key={block.type} style={style}>
            <PromoSlider
              slides={block.slides}
              height={block.type === 'short' ? height * HALF_RATIO : height}
              compact={block.type === 'short'}
            />
          </div>
        )
      })}
    </>
  )
}
