import './PageTransition.css'

/**
 * بيلف أي صفحة بأنيميشن دخول "بتنبثق من الداخل" (بتكبر شوية مع إحساس
 * إنها طالعة من جوه الشاشة) — شوف PageTransition.css. الأنيميشن بيتعاد
 * في كل مرة ننتقل لصفحة جديدة لأن transitionKey (location.key من
 * react-router) بيتغيّر مع كل تنقل، وده بيخلي React يشيل الـ div القديم
 * ويعمل واحد جديد بدل ما يحدّثه — فالأنيميشن بيبدأ من الأول كل مرة.
 *
 * ملحوظة: الصفحة (الكومبوننت اللي جواها) بتتبني من جديد مع كل تنقل حتى
 * لو نفس نوع الصفحة (مثلاً من /category/أ لـ /category/ب) — وده أصلاً
 * قريب من سلوك الصفحات دي النهاردة (بتعيد تحميل بياناتها لما الـ id
 * يتغيّر)، فمفيش فرق محسوس غير إن مكان السكرول بيرجع لفوق مع كل صفحة
 * جديدة، وده سلوك متوقع وطبيعي.
 */
export default function PageTransition({ transitionKey, children }) {
  return (
    <div key={transitionKey} className="page-transition">
      {children}
    </div>
  )
}
