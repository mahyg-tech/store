// =============================================================================
// التقاط إحداثيات الموقع (GPS) — بنفس فكرة رفع الموقع في تطبيق المناديب
// (elmahi-sales): إحداثيات lat/lng بس، من غير عنوان نصي أو خريطة.
//
// جوه تطبيق Capacitor الأصلي، لازم نستخدم @capacitor/geolocation (مش
// navigator.geolocation بتاع المتصفح مباشرة) — تصريح <uses-permission
// android:name="...ACCESS_FINE_LOCATION"/> في AndroidManifest.xml لوحده
// مش كافي خالص، ده مجرد "تسجيل نية" إن التطبيق ممكن يستخدم الميزة دي.
// من أندرويد 6 لحد دلوقتي، لازم كمان طلب فعلي وقت الاستخدام (runtime
// permission) يظهر فيه مربع حوار حقيقي للمستخدم يوافق فيه — وده بالظبط
// اللي @capacitor/geolocation بيعمله (نفس فكرة @capacitor/camera
// المستخدمة في WalletTopup.jsx لرفع صورة الإيصال). navigator.geolocation
// الخام جوه الـ WebView بتاع Capacitor مش بيطلب الإذن ده صح غالبًا،
// فبيفضل يفشل بصمت حتى لو خدمة الموقع شغالة على الموبايل والتصريح
// موجود في المانيفست — وده بالظبط اللي كان بيحصل.
// في متصفح عادي (مش جوه التطبيق)، الـ plugin ده بيشتغل برضو (بيستخدم
// navigator.geolocation بتاع المتصفح من تحت تلقائيًا) فمحتاجناش كود
// منفصل للحالتين.
//
// دايمًا "best effort": لو المستخدم رفض إذن الموقع، أو الجهاز مش بيدعم
// الخاصية، أو الطلب استنى كتير من غير رد، بترجع null من غير ما ترمي
// error — عشان التسجيل أو إرسال الأوردر يكمل عادي حتى من غير إحداثيات.
// =============================================================================

import { Geolocation } from '@capacitor/geolocation'

const DEFAULT_TIMEOUT_MS = 8000

export async function getCurrentCoords(timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    let perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      perm = await Geolocation.requestPermissions({ permissions: ['location'] })
    }
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      return null // المستخدم رفض الإذن فعليًا من مربع الحوار
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    })
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }
  } catch (err) {
    return null // أي خطأ تاني (مهلة، خدمة الموقع مقفولة، إلخ) — نكمل من غيرها
  }
}
