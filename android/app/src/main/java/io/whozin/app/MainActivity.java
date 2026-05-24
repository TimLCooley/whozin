package io.whozin.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * We override the WebChromeClient's onPermissionRequest because Capacitor's
 * default flow (ActivityResultLauncher inside BridgeWebChromeClient) was
 * silently dropping camera permission requests on some Android builds — the
 * system dialog never appeared and the WebView reported NotAllowedError, with
 * "Camera" not even showing up under the app's permission list in Settings.
 *
 * This override uses the classic ActivityCompat.requestPermissions API,
 * which reliably surfaces the system dialog on every Android version we
 * support.
 */
public class MainActivity extends BridgeActivity {

    private static final int CAMERA_PERMISSION_REQUEST_CODE = 9201;
    private PermissionRequest pendingWebViewPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    boolean needsCamera = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                            needsCamera = true;
                            break;
                        }
                    }

                    if (!needsCamera) {
                        // Hand non-camera requests (audio, MIDI, etc.) back to the default handler.
                        super.onPermissionRequest(request);
                        return;
                    }

                    runOnUiThread(() -> {
                        if (ContextCompat.checkSelfPermission(
                                MainActivity.this,
                                Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                            return;
                        }
                        pendingWebViewPermissionRequest = request;
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                CAMERA_PERMISSION_REQUEST_CODE
                        );
                    });
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            PermissionRequest req = pendingWebViewPermissionRequest;
            pendingWebViewPermissionRequest = null;
            if (req != null) {
                boolean granted = grantResults.length > 0
                        && grantResults[0] == PackageManager.PERMISSION_GRANTED;
                if (granted) {
                    req.grant(req.getResources());
                } else {
                    req.deny();
                }
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
}
