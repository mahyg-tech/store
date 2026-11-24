# تطبيق الماحي — تسوق كاش

تطبيق React (جاهز لـ Capacitor) للعملاء الكاش، بنفس أسلوب تطبيق "زاد" (تصفح بالأقسام، سلة، تشيك أوت، دفع كاش عند الاستلام) لكن بهوية بصرية خاصة بالماحي.

## تشغيل المشروع محليًا

```bash
npm install
npm run dev
```

هيفتح على `http://localhost:5173`. التطبيق شغال حاليًا في **وضع Mock** — يعني بيانات المنتجات والأقسام وهمية ومحلية (`src/data/mockData.js`)، عشان تقدر تجرب كل الشاشات فورًا من غير ما تحتاج سيرفر.

- تسجيل الدخول: أي رقم موبايل مصري صحيح (01xxxxxxxxx)
- كود التحقق (OTP) في وضع الـ Mock: **1234**

## وصل التطبيق بقاعدة بيانات elmahi-sales الحقيقية

كل الاتصال بالـ API متجمّع في ملف واحد: **`src/api/client.js`**. مفيش أي مكان تاني في المشروع بيتكلم مباشرة مع سيرفر.

طبقة الـ API الجاهزة (PHP، بتقرا من نفس قاعدة بيانات elmahi-sales) موجودة في مشروع منفصل اسمه **`elmahi-cash-api`** — راجع الـ README بتاعه لخطوات الرفع والإعداد.

الخطوات هنا في مشروع React:

1. انسخ `.env.example` لملف اسمه `.env`
2. خلي `VITE_USE_MOCK=false`
3. حط رابط الـ API بعد ما ترفعه في `VITE_API_BASE_URL`

مسارات الـ endpoints في `client.js` مطابقة بالظبط لأسماء ملفات PHP في `elmahi-cash-api`:

| الوظيفة | الملف |
|---|---|
| إرسال OTP | `POST request-otp.php` |
| تأكيد OTP | `POST verify-otp.php` → يرجّع `{ token, customer }` |
| الأقسام | `GET categories.php` |
| منتجات قسم | `GET products-by-category.php?category_id=` |
| تفاصيل منتج | `GET product.php?id=` |
| بحث | `GET search.php?q=` |
| وارد حديثًا | `GET new-arrivals.php` |
| رشحنالك | `GET recommended.php` |
| السلايدرات | `GET promos.php` |
| البوب أب | `GET welcome-popup.php` |
| إرسال طلب | `POST orders-create.php` |
| كل الطلبات | `GET orders-list.php` |
| طلب واحد | `GET order-detail.php?id=` |

## هيكل المشروع

```
src/
  api/client.js         ← كل الاتصال بالسيرفر من هنا
  context/               ← حالة تسجيل الدخول (AuthContext) والسلة (CartContext)
  data/mockData.js       ← بيانات تجريبية (أقسام + منتجات) لوضع Mock
  theme/tokens.css        ← نظام الألوان والخطوط والمسافات
  theme/global.css        ← الأنماط المشتركة (أزرار، كروت، حقول إدخال...)
  components/             ← عناصر قابلة لإعادة الاستخدام (كارت منتج، شريط سلة، تنقل سفلي...)
  pages/                  ← كل شاشة في ملف مستقل
```

## بناء تطبيق أندرويد (Capacitor)

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

`capacitor.config.json` موجود بالفعل بإعدادات مبدئية (appId: `com.elmahi.cashcustomer`) — غيّره لو حابب اسم تاني.

## نقاط تحتاج قرار منك قبل الإطلاق

- **صور المنتجات**: حاليًا كل منتج بياخد بلاسيهولدر (أول حرف من الاسم). لازم تضيف حقل `image` في رد الـ API وتستخدمه في `ProductCard.jsx` و`ProductDetail.jsx`
- **رسوم التوصيل والحد الأدنى للتوصيل المجاني**: مضبوطة حاليًا كثابت في `Cart.jsx` و`Checkout.jsx` (300 ج.م حد أدنى، 20 ج.م رسوم) — ينفع تتحول لإعداد من السيرفر
- **حالات الطلب**: التتبع في `OrderDetail.jsx` مبني على 4 حالات ثابتة (قيد المراجعة → جاري التجهيز → خرج للتوصيل → اتسلم) — لازم تتطابق مع نفس الأسماء اللي هيرجعها السيرفر بالظبط
