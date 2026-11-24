package com.elmahi.cashcustomer;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // الـ WebView عنده نظام إذن داخلي منفصل عن إذن الأندرويد نفسه.
        // من غير الـ override ده، أي طلب مايك من الجافاسكريبت (زي
        // SpeechRecognition في VoiceAssistant.jsx) هيتفض تلقائيًا من
        // الـ WebView حتى لو المستخدم وافق على إذن RECORD_AUDIO فعلاً.
        bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean micAllowed = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED;

                    for (String resource : request.getResources()) {
                        if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && micAllowed) {
                            request.grant(new String[]{ PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                            return;
                        }
                    }
                    request.deny();
                });
            }
        });
    }
}
