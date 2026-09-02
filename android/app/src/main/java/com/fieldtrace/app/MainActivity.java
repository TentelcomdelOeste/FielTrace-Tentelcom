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
import android.os.Build;
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
        launchViewer(uri);
      } catch (Exception ignored) {
        // Never send an absolute file path to ACTION_VIEW: that can trigger
        // Android's generic "Abrir con" chooser. Fall back to MediaStore/gallery.
        try {
          String raw = uriString.trim();
          String fileName = raw.contains("/") ? raw.substring(raw.lastIndexOf('/') + 1) : raw;
          if (!fileName.isEmpty()) {
            openByFileName(fileName);
            return;
          }
        } catch (Exception ignoredAgain) {}
        openGallery();
      }
    }

    @JavascriptInterface
    public void openByFileName(String fileName) {
      if (fileName == null || fileName.trim().isEmpty()) {
        openGallery();
        return;
      }
      try {
        String name = fileName.trim();
        if (!name.contains(".")) name = name + ".jpg";
        String[] projection = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME };
        String selection = MediaStore.Images.Media.DISPLAY_NAME + "=?";
        String[] args = new String[]{ name };
        String sort = MediaStore.Images.Media.DATE_ADDED + " DESC";
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, selection, args, sort)) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            launchViewer(ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id));
            return;
          }
        }

        String base = name.replaceAll("\\.[^.]+$", "");
        selection = MediaStore.Images.Media.DISPLAY_NAME + " LIKE ?";
        args = new String[]{ base + "%" };
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, selection, args, sort)) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            launchViewer(ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id));
            return;
          }
        }
      } catch (Exception ignored) {}
      openGallery();
    }

    private static final String[] PREFERRED_GALLERY_PACKAGES = {
        "com.google.android.apps.photos",
        "com.google.android.apps.photosgo",
        "com.sec.android.gallery3d",
        "com.miui.gallery",
        "com.huawei.photos",
        "com.oneplus.gallery",
        "com.android.gallery3d",
        "com.google.android.gallery3d"
    };

    private void launchViewer(Uri uri) {
      if (uri == null || uri.getScheme() == null || !"content".equalsIgnoreCase(uri.getScheme())) {
        openGallery();
        return;
      }

      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.addCategory(Intent.CATEGORY_DEFAULT);
      intent.setDataAndType(uri, "image/*");
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
      }

      if (startPreferred(intent)) return;
      openGallery();
    }

    private boolean startPreferred(Intent template) {
      for (String pkg : PREFERRED_GALLERY_PACKAGES) {
        try {
          Intent copy = new Intent(template);
          copy.setPackage(pkg);
          if (copy.resolveActivity(getPackageManager()) != null) {
            startActivity(copy);
            return true;
          }
        } catch (Exception ignored) {}
      }
      return false;
    }

    private Uri resolveImageContentUri(String uriString) {
      Uri parsed = Uri.parse(uriString);
      if ("content".equalsIgnoreCase(parsed.getScheme())) return parsed;

      String path = "file".equalsIgnoreCase(parsed.getScheme()) ? parsed.getPath() : uriString;
      if (path == null) path = uriString;

      String[] projection = {
          MediaStore.Images.Media._ID,
          MediaStore.Images.Media.DATA,
          MediaStore.Images.Media.DISPLAY_NAME
      };

      try (Cursor cursor = getContentResolver().query(
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
          projection,
          MediaStore.Images.Media.DATA + "=?",
          new String[]{ path },
          null)) {
        if (cursor != null && cursor.moveToFirst()) {
          long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
          return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
        }
      } catch (Exception ignored) {}

      try {
        String fileName = path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path;
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Images.Media.DISPLAY_NAME + "=?",
            new String[]{ fileName },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
          }
        }
      } catch (Exception ignored) {}

      try (Cursor cursor = getContentResolver().query(
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
          projection,
          MediaStore.Images.Media.DATA + " LIKE ?",
          new String[]{ "%" + path },
          MediaStore.Images.Media.DATE_ADDED + " DESC")) {
        if (cursor != null && cursor.moveToFirst()) {
          long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
          return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
        }
      } catch (Exception ignored) {}

      throw new IllegalArgumentException("Image not found in MediaStore: " + path);
    }

    @JavascriptInterface
    public void openGallery() {
      Intent viewImages = new Intent(Intent.ACTION_VIEW);
      viewImages.addCategory(Intent.CATEGORY_DEFAULT);
      viewImages.setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
      viewImages.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      if (startPreferred(viewImages)) return;

      Intent galleryApp = new Intent(Intent.ACTION_MAIN);
      galleryApp.addCategory(Intent.CATEGORY_APP_GALLERY);
      galleryApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      if (startPreferred(galleryApp)) return;

      try {
        startActivity(galleryApp);
      } catch (Exception ignored) {
        try { startActivity(viewImages); } catch (Exception ignoredAgain) {}
      }
    }
  }
}
