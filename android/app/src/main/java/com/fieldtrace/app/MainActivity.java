package com.fieldtrace.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Disable mediaPlaybackRequiresUserGesture so the camera preview
 * autoplays without the Android WebView big PLAY overlay.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try {
      WebView webView = this.bridge.getWebView();
      if (webView != null) {
        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
      }
    } catch (Exception e) {
      // Bridge may not be ready yet; also applied after bridge init below
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    try {
      WebView webView = this.bridge.getWebView();
      if (webView != null) {
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
      }
    } catch (Exception ignored) {}
  }
}
