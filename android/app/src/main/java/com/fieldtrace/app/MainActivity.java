package com.fieldtrace.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * 1) mediaPlaybackRequiresUserGesture = false  →  autoplay de getUserMedia sin gesto.
 * 2) getDefaultVideoPoster() transparente     →  elimina el botón PLAY gigante de WebView.
 * 3) Re-aplicar en onStart/onResume + post()  →  sobrevive a recreaciones del Bridge.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyCameraWebViewFixes();
  }

  @Override
  public void onStart() {
    super.onStart();
    applyCameraWebViewFixes();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyCameraWebViewFixes();
  }

  private void applyCameraWebViewFixes() {
    try {
      if (this.bridge == null) return;
      WebView webView = this.bridge.getWebView();
      if (webView == null) return;

      WebSettings settings = webView.getSettings();
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setDomStorageEnabled(true);
      settings.setJavaScriptEnabled(true);
      webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

      // Elimina el poster/play button nativo del WebView (causa del triángulo grande)
      webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
        @Override
        public Bitmap getDefaultVideoPoster() {
          // 1x1 transparente → no se dibuja el botón de play
          Bitmap bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
          Canvas canvas = new Canvas(bitmap);
          canvas.drawARGB(0, 0, 0, 0);
          return bitmap;
        }
      });

      // Re-aplicar después del layout (Bridge a veces resetea settings)
      webView.post(() -> {
        try {
          webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception ignored) {}
      });
    } catch (Exception ignored) {
      // Bridge puede no estar listo todavía
    }
  }
}
