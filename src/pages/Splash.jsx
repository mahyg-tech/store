import './Splash.css'
import logo from '../assets/logo-transparent.png'

export default function Splash() {
  return (
    <div className="splash canopy">
      {/* الخلفية البيضا اتشالت من الشعار نفسه (معالجة الصورة، شوف
          logo-transparent.png بدل logo.jpg الأصلية) فالختم بيطفو على
          خلفية السبلاش الغامقة مباشرة من غير كارت أبيض حواليه.
          جواه نفس صورة الشعار متكررة مرتين فوق بعض بالظبط: طبقة تحتية
          بتلف لفة كاملة مستمرة (الحلقات الدهبية + الكتابة اللي حواليها)،
          وطبقة فوقها ثابتة ومقصوصة (clip-path) على شكل دائرة صغيرة في
          النص بس — عشان تغطي نفس منطقة النص من الطبقة اللي بتلف تحتها،
          فيبان بصريًا إن وسط الدائرة (كلمة "الماحي" والورق الأخضر) ثابت
          مكانه من غير ما يلف، والباقي كله حواليه هو اللي بيلف فعلاً.
          .splash__logo-card بقى بس حاوية حجم/أنيميشن (الدخول + النبض)
          من غير أي خلفية أو ظل أو حواف مدوّرة — مفيهاش حاجة تتشاف. */}
      <div className="splash__logo-card">
        <div className="splash__logo-spinner">
          <img src={logo} alt="شعار شركة الماحي" className="splash__logo splash__logo--ring" />
          <img src={logo} alt="" aria-hidden="true" className="splash__logo splash__logo--center" />
        </div>
      </div>
    </div>
  )
}
