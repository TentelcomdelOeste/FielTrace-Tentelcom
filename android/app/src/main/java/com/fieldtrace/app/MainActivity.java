package com.fieldtrace.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Color;
import android.provider.MediaStore;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

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
      webView.setBackgroundColor(Color.TRANSPARENT);
      webView.getRootView().setBackgroundColor(Color.TRANSPARENT);
      webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
      try {
        webView.addJavascriptInterface(new FieldTraceBridge(), "FieldTraceNative");
      } catch (Exception ignored) {}
      webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
        @Override
        public Bitmap getDefaultVideoPoster() {
          Bitmap bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
          Canvas canvas = new Canvas(bitmap);
          canvas.drawARGB(0, 0, 0, 0);
          return bitmap;
        }
      });
      webView.post(() -> {
        try {
          webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception ignored) {}
      });
    } catch (Exception ignored) {}
  }

  public class FieldTraceBridge {
    @JavascriptInterface
    public void openUri(String uriString) {
      if (uriString == null || uriString.trim().isEmpty()) {
        openGallery();
        return;
      }
      try {
        Uri uri = resolveImageContentUri(uriString.trim());
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "image/*");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(intent);
      } catch (Exception e1) {
        try {
          Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriString.trim()));
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(intent);
        } catch (Exception e2) {
          openGallery();
        }
      }
    }

    private Uri resolveImageContentUri(String uriString) {
      Uri parsed=Uri.parse(uriString);
      if ("content".equalsIgnoreCase(parsed.getScheme())) return parsed;
      String path="file".equalsIgnoreCase(parsed.getScheme()) ? parsed.getPath() : uriString;
      String[] projection={MediaStore.Images.Media._ID,MediaStore.Images.Media.DATA};
      try (Cursor cursor=getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,projection,MediaStore.Images.Media.DATA+"=?",new String[]{path},null)) {
        if(cursor!=null && cursor.moveToFirst()) { long id=cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)); return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,id); }
      }
      throw new IllegalArgumentException("Image not found in MediaStore: "+path);
    }

    @JavascriptInterface
    public void openGallery() {
      try {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse("content://media/external/images/media"), "image/*");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return;
      } catch (Exception ignored) {}
      try {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_APP_GALLERY);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return;
      } catch (Exception ignored) {}
      try {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setType("image/*");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
      } catch (Exception ignored) {}
    }
  }
}
