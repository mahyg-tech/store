// بيانات تجريبية محلية — تُستخدم فقط لما وضع المحاكاة (Mock) شغال
// (راجع src/api/client.js و.env — VITE_USE_MOCK)
// لما الـ API الحقيقي يتوصل بقاعدة بيانات elmahi-sales، امسح الملف ده
// أو سيبه للتطوير المحلي بس.
//
// units: كل منتج ليه مصفوفة وحدات (زي بيانات elmahi-sales الحقيقية —
// نفس الصنف بوحدات بيع مختلفة زي علبة/كرتونة بيتسجل كصفوف منفصلة، كل
// وحدة بسعرها ورصيدها الخاص). المنتجات اللي ليها وحدة واحدة بس بتاخد
// مصفوفة من عنصر واحد.

// icon: اسم أيقونة من src/components/AppIcon.jsx (مش إيموجي) — عشان تتعرض
// كأيقونة خطية سودا هادئة بدل إيموجي ملوّن.
// parentId: لو موجود، القسم ده فرعي تابع لقسم رئيسي بنفس الـ id — زي
// بيانات elmahi-sales الحقيقية (أقسام فرعية جوه أقسام رئيسية).
export const CATEGORIES = [
  { id: 'dairy', name: 'ألبان وأجبان', icon: 'Milk', color: '#e3f0ef' },
  { id: 'dairy-cheese', name: 'أجبان', icon: 'Milk', color: '#e3f0ef', parentId: 'dairy' },
  { id: 'dairy-yogurt', name: 'زبادي وألبان', icon: 'Milk', color: '#e3f0ef', parentId: 'dairy' },
  { id: 'grocery', name: 'بقالة جافة', icon: 'Wheat', color: '#fdeadb' },
  { id: 'oils', name: 'زيوت وسمن', icon: 'Droplet', color: '#fbe3e1' },
  { id: 'beverages', name: 'مشروبات', icon: 'CupSoda', color: '#e8f0dd' },
  { id: 'snacks', name: 'سناكس وبسكويت', icon: 'Cookie', color: '#fdeadb' },
  { id: 'cleaning', name: 'منظفات', icon: 'SprayCan', color: '#e3f0ef' },
  { id: 'personal-care', name: 'عناية شخصية', icon: 'ShowerHead', color: '#fbe3e1' },
  { id: 'canned', name: 'معلبات', icon: 'Package2', color: '#e8f0dd' },
]

export const PRODUCTS = [
  {
    id: 'p1',
    categoryId: 'dairy',
    name: 'جبنة رومي الماحي 500 جم',
    units: [{ id: 'p1-u1', unit: 'علبة', price: 145, stock: 42 }],
    oldPrice: 165,
    fresh: true,
    isNew: false,
    recommended: true,
    image: null,
  },
  {
    id: 'p2',
    categoryId: 'dairy',
    name: 'زبادي الماحي طبيعي 170 جم',
    units: [{ id: 'p2-u1', unit: 'كوب', price: 12, stock: 120 }],
    oldPrice: null,
    fresh: true,
    isNew: true,
    recommended: false,
    image: null,
  },
  {
    id: 'p3',
    categoryId: 'dairy',
    name: 'لبن جوهرة كامل الدسم 1 لتر',
    units: [{ id: 'p3-u1', unit: 'كرتونة', price: 38, stock: 60 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: true,
    image: null,
  },
  {
    id: 'p4',
    categoryId: 'oils',
    name: 'زيت عافية عباد الشمس 1.5 لتر',
    units: [{ id: 'p4-u1', unit: 'زجاجة', price: 89, stock: 30 }],
    oldPrice: 99,
    fresh: false,
    isNew: false,
    recommended: true,
    image: null,
  },
  {
    id: 'p5',
    categoryId: 'oils',
    name: 'سمن نباتي طبيعي 800 جم',
    units: [{ id: 'p5-u1', unit: 'علبة', price: 76, stock: 18 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p6',
    categoryId: 'grocery',
    name: 'أرز مصري أبو الحسن 5 كجم',
    // مثال منتج بوحدتين — كيس مفرّد وجوالة جملة، زي ما بيحصل فعليًا
    // في fs_section_products. مثال أيضًا لحدود الكمية (min/max) وخطوة
    // الكمية (fraction step) اللي بتتحدد من لوحة التحكم لكل وحدة —
    // "كيس" له حد أدنى وأقصى عاديين، و"جوالة" يسمح بطلب نص جوالة
    units: [
      { id: 'p6-u1', unit: 'كيس', price: 210, stock: 25, minQty: 1, maxQty: 10 },
      { id: 'p6-u2', unit: 'جوالة (6 كيس)', price: 1190, stock: 6, minQty: 0.5, qtyStep: 0.5 },
    ],
    oldPrice: null,
    fresh: false,
    isNew: true,
    recommended: false,
    image: null,
  },
  {
    id: 'p7',
    categoryId: 'grocery',
    name: 'مكرونة الملكة اسباجيتي 400 جم',
    units: [{ id: 'p7-u1', unit: 'كيس', price: 22, stock: 80 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p8',
    categoryId: 'beverages',
    name: 'عصير بيتي مانجو 1 لتر',
    units: [{ id: 'p8-u1', unit: 'كرتونة', price: 34, stock: 45 }],
    oldPrice: 39,
    fresh: false,
    isNew: false,
    recommended: true,
    image: null,
  },
  {
    id: 'p9',
    categoryId: 'beverages',
    name: 'مياه معدنية باراغات 1.5 لتر',
    // مثال تاني بوحدتين — باكيت مفرّد وكرتونة جملة. "كرتونة" هنا مثال
    // لخطوة ربع (0.25) — يسمح بطلب ربع كرتونة (باكيت واحد) أو نص
    units: [
      { id: 'p9-u1', unit: 'باكيت (6 زجاجات)', price: 55, stock: 55 },
      { id: 'p9-u2', unit: 'كرتونة (4 باكيت)', price: 205, stock: 12, minQty: 0.25, qtyStep: 0.25 },
    ],
    oldPrice: null,
    fresh: false,
    isNew: true,
    recommended: false,
    image: null,
  },
  {
    id: 'p10',
    categoryId: 'snacks',
    name: 'بسكويت مولتو فاين 12 قطعة',
    units: [{ id: 'p10-u1', unit: 'علبة', price: 48, stock: 5 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p11',
    categoryId: 'snacks',
    name: 'شيبسي طماطم عائلي',
    units: [{ id: 'p11-u1', unit: 'كيس', price: 15, stock: 0 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p12',
    categoryId: 'cleaning',
    name: 'بريل غسيل أطباق 750 مل',
    units: [{ id: 'p12-u1', unit: 'زجاجة', price: 42, stock: 33 }],
    oldPrice: 47,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p13',
    categoryId: 'cleaning',
    name: 'ديتول معقم أسطح 1 لتر',
    units: [{ id: 'p13-u1', unit: 'زجاجة', price: 68, stock: 20 }],
    oldPrice: null,
    fresh: false,
    isNew: true,
    recommended: false,
    image: null,
  },
  {
    id: 'p14',
    categoryId: 'personal-care',
    name: 'صابون لوكس معطر (باكيت 4)',
    units: [{ id: 'p14-u1', unit: 'باكيت', price: 58, stock: 40 }],
    oldPrice: null,
    fresh: false,
    isNew: false,
    recommended: false,
    image: null,
  },
  {
    id: 'p15',
    categoryId: 'canned',
    name: 'تونة الماحي بالزيت 170 جم',
    units: [{ id: 'p15-u1', unit: 'علبة', price: 65, stock: 90 }],
    oldPrice: 72,
    fresh: false,
    isNew: false,
    recommended: true,
    image: null,
  },
  {
    id: 'p16',
    categoryId: 'canned',
    name: 'فول مدمس معلب 400 جم',
    units: [{ id: 'p16-u1', unit: 'علبة', price: 19, stock: 70 }],
    oldPrice: null,
    fresh: false,
    isNew: true,
    recommended: false,
    image: null,
  },
]

// group: 'main' يظهر في السلايدر الرئيسي أعلى الشاشة، 'secondary' في
// السلايدر التاني تحت قسم "وارد حديثًا" — نفس شكل رد promos.php بالظبط.
// icon: اسم أيقونة (مش إيموجي) — راجع src/components/AppIcon.jsx
// categoryId: لو موجود، العرض ده بيظهر بس في صفحة القسم ده (مش الرئيسية)
// linkType (اختياري): 'category' (+ linkCategoryId) أو 'products' (+ linkProductIds)
// — لما العميل يضغط على الشريحة بتفتح القسم/المنتجات دي. من غيره (أو 'none')
// الشريحة مجرد إعلان مفيهوش حاجة بتتفتح.
// anchor بيحدد مكان كل سلايدر بالظبط في الصفحة الرئيسية (نفس قايمة
// anchor بتاعة كروت عروض الشبكة GRID_PROMOS تحت) — group فضل موجود
// للتوافق بس (مش بيتحسب منه المكان دلوقتي). عروض الأقسام (categoryId
// مسجل) مالهاش anchor خالص، بتتعرض في صفحة القسم بتاعها بس.
export const PROMOS = [
  { id: 'promo1', icon: 'Tag', title: 'عروض الأسبوع', subtitle: 'خصومات لحد 20% على الألبان', color: 'var(--color-mango-500)', anchor: 'top', linkType: 'products', linkCategoryId: null, linkProductIds: ['p1', 'p3'] },
  { id: 'promo2', icon: 'Truck', title: 'توصيل مجاني', subtitle: 'على الأوردرات فوق 300 جنيه', color: 'var(--color-teal-700)', anchor: 'top' },
  { id: 'promo3', icon: 'Clock', title: 'اطلب دلوقتي', subtitle: 'وصول خلال ساعة لباب البيت', color: 'var(--color-olive-500)', anchor: 'top', linkType: 'category', linkCategoryId: 'oils', linkProductIds: [] },
  { id: 'promo4', icon: 'Gift', title: 'عميل جديد', subtitle: 'خصم 15% على أول أوردر ليك', color: 'var(--color-tomato-500)', anchor: 'after_new_arrivals' },
  { id: 'promo5', icon: 'Package2', title: 'باقة المعلبات', subtitle: 'وفّر لحد 25 جنيه على المعلبات', color: 'var(--color-teal-900)', anchor: 'after_new_arrivals' },
  // مثال لأحجام السلايدر: واحد "نص الارتفاع" وسلايدرين "نص الحجم" جنب بعض (شمال/يمين) في نفس المكان
  { id: 'promo7', icon: 'Zap', title: 'عرض سريع', subtitle: 'نص الارتفاع', color: 'var(--color-mango-500)', anchor: 'after_categories', size: 'short' },
  { id: 'promo8', icon: 'Star', title: 'الأكثر طلبًا', subtitle: '', color: 'var(--color-olive-500)', anchor: 'after_categories', size: 'half', halfSide: 'right' },
  { id: 'promo9', icon: 'Percent', title: 'خصومات', subtitle: '', color: 'var(--color-tomato-500)', anchor: 'after_categories', size: 'half', halfSide: 'left' },
  { id: 'promo6', icon: 'Milk', title: 'عروض الألبان', subtitle: 'خصم على كل منتجات الألبان الأسبوع ده', color: 'var(--color-teal-700)', anchor: 'top', categoryId: 'dairy' },
]

// كروت عروض بحجم كارت المنتج، بس بتتحط كقسم مستقل بين أقسام الصفحة
// (مش جوه شبكة منتجات) — page/anchor بيحددوا مكانها بالظبط، وlinkType
// بيحدد لو الضغط عليها بيودّي لقسم أو لمجموعة منتجات مختارة. نفس شكل
// رد grid-promos.php بالظبط.
export const GRID_PROMOS = [
  {
    id: 'gp1',
    image: null,
    title: 'عرض خاص',
    page: 'home',
    anchor: 'after_new_arrivals',
    categoryId: null,
    sortOrder: 0,
    linkType: 'products',
    linkCategoryId: null,
    linkProductIds: ['p1', 'p3'],
  },
  {
    // مثال لكارت عرض "تحت عنوان رف الأكثر مبيعًا" (فوق المنتجات): anchor = railtop:...
    id: 'gp4',
    image: null,
    title: 'عرض فوق الرف',
    page: 'home',
    anchor: 'railtop:best_sellers',
    categoryId: null,
    sortOrder: 0,
    linkType: 'products',
    linkCategoryId: null,
    linkProductIds: ['p1', 'p2'],
  },
  {
    // مثال لكارت عرض "جوه رف الأكثر مبيعًا" (anchor = rail:...): بيظهر وسط
    // منتجات الرف بعد أول منتجين (sortOrder = 2)
    id: 'gp3',
    image: null,
    title: 'عرض الرف',
    page: 'home',
    anchor: 'rail:best_sellers',
    categoryId: null,
    sortOrder: 2,
    linkType: 'products',
    linkCategoryId: null,
    linkProductIds: ['p2', 'p4'],
  },
  {
    id: 'gp2',
    image: null,
    title: 'وفّر أكتر',
    page: 'category',
    anchor: 'top',
    categoryId: 'dairy',
    sortOrder: 0,
    linkType: 'category',
    linkCategoryId: 'oils',
    linkProductIds: [],
  },
]

// فيديو (أو أكتر) في الصفحة الرئيسية — بلينك بس (يوتيوب/فيميو/لينك
// فيديو مباشر)، وanchor بيحدد مكانه بالظبط زي كروت عروض الشبكة. التشغيل
// التلقائي ممنوع خالص من الفرونت إند. نفس شكل رد home-videos.php بالظبط.
export const HOME_VIDEOS = [
  {
    id: 'hv1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'إزاي تطلب من الماحي في دقيقة',
    anchor: 'after_main_slider',
    sortOrder: 0,
  },
]

// "شركاء النجاح" — قسم في الرئيسية بيعرض شعارات شركات، وفتح شركة بيعرض
// بس المنتجات اللي productIds هنا بتحددها. نفس شكل رد partners.php
// (القايمة) وpartner-products.php (المنتجات) بالظبط.
export const PARTNERS = [
  {
    id: 'pt1',
    name: 'شركة النيل للمنتجات الغذائية',
    image: null,
    productIds: ['p1', 'p3', 'p5'],
  },
  {
    id: 'pt2',
    name: 'مجموعة الدلتا للصناعات',
    image: null,
    productIds: ['p2', 'p4'],
  },
]

// أقسام مخصصة بالرئيسية (زي "رشحنالك" بالظبط بس الأدمن هو اللي بيختار
// المنتجات والمكان) — anchor بيحدد مكانها زي كروت عروض الشبكة، وproductIds
// بالترتيب اللي هيظهروا بيه. نفس شكل رد custom-sections.php بالظبط.
export const CUSTOM_SECTIONS = [
  {
    id: 'cs1',
    title: 'اختيارات المحل',
    anchor: 'after_recommended',
    sortOrder: 0,
    productIds: ['p2', 'p1', 'p4'],
  },
]

// محفظة تجريبية للعميل — رصيد بيضيفه الأدمن (كاش باك أو أي مبلغ تاني)
// وقابل للاستخدام في الدفع عند الأوردر. دي بس القيمة الابتدائية؛ بعد أول
// استخدام بتتخزن فعليًا في localStorage (شوف getMockWalletState في client.js)
// عشان أي شحن أو دفع تجريبي يفضل محفوظ بين الجلسات.
export const WALLET_MOCK = {
  balance: 45,
  transactions: [
    {
      id: 'wtx_seed_1',
      amount: 45,
      type: 'admin_credit',
      note: 'كاش باك ترحيبي',
      orderId: null,
      balanceAfter: 45,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ],
}

// عروض تجريبية (mock) — تلات أنواع: tiered (خصم كمية)، free_gift (اشتري
// واخد مجانًا)، bundle (تشكيلة بسعر ثابت). الـ id في كل config بيشاور
// على id الوحدة (زي 'p1-u1')، مش المنتج نفسه.
export const DEALS = [
  {
    id: 'deal1',
    type: 'tiered',
    title: 'خصم كمية على الجبنة الرومي',
    isActive: true,
    config: { productId: 'p1-u1', tiers: [{ minQty: 3, unitPrice: 130 }, { minQty: 6, unitPrice: 120 }] },
  },
  {
    id: 'deal2',
    type: 'free_gift',
    title: 'اشتري 6 عصير تاخد 1 مجانًا',
    isActive: true,
    config: { buyProductId: 'p8-u1', buyQty: 6, freeProductId: 'p8-u1', freeQty: 1 },
  },
  {
    id: 'deal3',
    type: 'bundle',
    title: 'تشكيلة سناكس ومعلبات بـ 150 جنيه',
    isActive: true,
    config: { productIds: ['p10-u1', 'p11-u1', 'p15-u1'], minTotalQty: 5, bundlePrice: 150 },
  },
]

// محتوى البوب أب اللي بيظهر أول ما التطبيق يفتح (مرة واحدة في الجلسة).
// مصفوفة عشان يدعم أكتر من بوب أب يتعرضوا واحد ورا التاني (زي لوحة
// التحكم بالظبط — كل بوب أب نشط بيتحط في الطابور بالترتيب).
export const WELCOME_POPUPS = [
  {
    id: 'welcome-2026-01',
    icon: 'PartyPopper',
    image: null,
    title: 'أهلاً بيك في تطبيق الماحي',
    subtitle: 'خصم 15% على أول أوردر ليك من خلال التطبيق — العرض لفترة محدودة',
    ctaLabel: 'يلا نتسوق',
  },
  {
    id: 'welcome-2026-02',
    icon: 'Truck',
    image: null,
    title: 'توصيل مجاني النهاردة',
    subtitle: 'على كل الأوردرات فوق 300 جنيه',
    ctaLabel: 'تمام',
  },
]

// إعدادات عامة (وضع mock) — نفس شكل رد settings.php الحقيقي
export const APP_SETTINGS = {
  promoAutoplayMs: 4200,
  // اتجاه حركة السلايدرات: 'side' (جانبي) أو 'up' (من تحت لفوق)
  promoDirection: 'side',
  // شحن المحفظة يدوي (محافظ إلكترونية/إنستاباي) — مفعّل في الديمو عشان
  // تقدر تجرب الشاشة؛ الرسالتين هنا مجرد مثال، الأدمن الحقيقي بيكتبهم
  // بنفسه من لوحة التحكم برقمه الفعلي ونسبة العمولة اللي يحددها
  walletTopupEnabled: true,
  walletTopupMessages: {
    wallets: 'اشحن على الرقم 01000000000 مع إضافة 1% عمولة الشركة الخاصة بالمحفظة، وصوّر الإيصال أو البيان وابعت صورته هنا، وهيتم إضافة الرصيد في حسابك خلال يوم عمل واحد.',
    instapay: 'حوّل على حساب إنستاباي elmahi@instapay مع إضافة 1% عمولة الشركة الخاصة بالمحفظة، وصوّر الإيصال أو البيان وابعت صورته هنا، وهيتم إضافة الرصيد في حسابك خلال يوم عمل واحد.',
  },
  contact: {
    phone: '01000000000',
    whatsapp: '01000000000',
    email: 'info@el-mahi.com',
    address: 'الماحي هايبر ماركت',
    workingHours: 'يوميًا من 9 الصبح لحد 12 بالليل',
    facebookUrl: '',
    instagramUrl: '',
  },
  aboutText: 'الماحي هايبر ماركت — جودة وأسعار تنافسية في متناول إيدك.',
  // روابط صفحة التطبيق على المتاجر — بتتحدد من لوحة التحكم (زي معلومات
  // التواصل بالظبط)؛ فاضية لحد ما الأدمن يكتبها. لو فاضية، نافذة تقييم
  // التطبيق (AppRatingModal.jsx) بتكتفي بالشكر من غير ما تعرض زرار "قيّمنا
  // على المتجر" حتى لو التقييم كان عالي.
  appRating: {
    playStoreUrl: '',
    appStoreUrl: '',
  },
  order: {
    deliveryFee: 20,
    freeDeliveryThreshold: 300,
    minOrderValue: 0,
  },
  // نظام نقاط الولاء — القيم هنا مجرد مثال ديمو؛ الأدمن الحقيقي بيتحكم فيها
  // من لوحة التحكم (تاب "النقاط"). showOnProducts false هنا عمدًا لأن
  // بيانات المنتجات التجريبية (PRODUCTS تحت) مفيهاش قيمة points محسوبة
  // لكل وحدة، فمش هتبان شارة النقاط على الكروت في وضع الـ mock حتى لو
  // فعّلتها هنا — ده محتاج الباك إند الحقيقي اللي بيحسبها فعليًا.
  points: {
    showOnProducts: false,
    redeemValue: 0.05,
    redeemMinPoints: 0,
    isRedeemOpen: true,
    redeemOpenFrom: null,
  },
}

// رصيد نقاط تجريبي للعميل — بيتضاف من الباك إند لما الأوردر يبقى "اتسلم"،
// وقابل للاستبدال بشحن في المحفظة. دي بس القيمة الابتدائية؛ بعد أول
// استخدام بتتخزن فعليًا في localStorage (شوف getMockPointsState في
// client.js) عشان أي استبدال تجريبي يفضل محفوظ بين الجلسات.
export const POINTS_MOCK = {
  balance: 120,
  transactions: [
    {
      id: 'ptx_seed_1',
      points: 120,
      type: 'earn',
      note: 'نقاط أوردر #1001',
      orderId: '1001',
      balanceAfter: 120,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
}

// مسابقة تجريبية (وضع mock) — نفس شكل رد competition.php الحقيقي. التقدم
// (amount) هنا قيمة ثابتة للديمو بس (مش محسوبة فعليًا من أوردرات العميل
// التجريبية زي ما POINTS_MOCK.balance مش محسوب من أوردراته برضه — الأوردرات
// في وضع mock بتتعمل بحالة "قيد المراجعة" وما فيش حاجة بتحوّلها "اتسلم"
// أوتوماتيك). عدّل amount تحت لو عايز تجرب شكل الشريط في مراحل تقدم مختلفة.
export const REGIONS_MOCK = [
  { id: '1', name: 'المنطقة الأولى' },
  { id: '2', name: 'المنطقة التانية' },
  { id: '3', name: 'المنطقة التالتة' },
]

export const COMPETITION_MOCK = {
  active: true,
  id: 'comp1',
  title: 'مسابقة الشراء الكبرى',
  subtitle: 'كل ما تشتري أكتر، تكسب أكتر!',
  targetAmount: 2000,
  amount: 650,
  endsAt: new Date(Date.now() + 86400000 * 18).toISOString(),
  tiers: [
    { id: 't1', threshold: 300, reward: 15, label: 'الجايزة الأولى' },
    { id: 't2', threshold: 800, reward: 40, label: 'الجايزة الثانية' },
    { id: 't3', threshold: 1500, reward: 100, label: 'الجايزة الكبرى' },
  ].map((t) => ({ ...t, reached: 650 >= t.threshold, credited: 650 >= t.threshold })),
}

// عنوان تجريبي بس في وضع الديمو (mock) — بيبدأ فاضي (null) وبيتسجّل في
// الذاكرة بس (مش متخزن حقيقي)، بيرجع فاضي تاني أول ما التطبيق يفتح من جديد.
// غلاف بكائن (مش متغيّر مباشر) عشان يتقدر يتعدّل من client.js من غير إعادة
// تصدير (import binding من نوع let منفصل ما بيتغيّرش من ملف تاني).
export const MOCK_ADDRESS_STORE = { value: null }

function totalStock(product) {
  return product.units.reduce((sum, u) => sum + u.stock, 0)
}

export function findProductsByCategory(categoryId) {
  return PRODUCTS.filter((p) => p.categoryId === categoryId)
}

export function findProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId)
}

export function searchProducts(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PRODUCTS.filter((p) => p.name.toLowerCase().includes(q))
}

export function findNewArrivals() {
  return PRODUCTS.filter((p) => p.isNew && totalStock(p) > 0)
}

// مجرد تقليد للأكثر مبيعًا في وضع الـ mock (السيرفر الحقيقي بيحسبها من الأوردرات)
export function findBestSellers() {
  return PRODUCTS.filter((p) => totalStock(p) > 0).slice(0, 8)
}

export function findRecommended() {
  return PRODUCTS.filter((p) => p.recommended && totalStock(p) > 0)
}
