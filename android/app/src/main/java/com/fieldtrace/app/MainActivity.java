package com.fieldtrace.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.Uri;
import android.content.ContentUris;
import android.database.Cursor;
import android.provider.MediaStore;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
  private static final String ALBUM_NAME = "Field Trace";

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
      webView.getRootView().setBackgroundColor(Color.BLACK);
      if (getWindow() != null && getWindow().getDecorView() != null) {
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);
      }
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
        openFieldTraceAlbum();
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
          openFieldTraceAlbum();
        }
      }
    }

    private Uri resolveImageContentUri(String uriString) {
      Uri parsed = Uri.parse(uriString);
      if ("content".equalsIgnoreCase(parsed.getScheme())) return parsed;
      String path = "file".equalsIgnoreCase(parsed.getScheme()) ? parsed.getPath() : uriString;
      String[] projection = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA };
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
      }
      throw new IllegalArgumentException("Image not found in MediaStore: " + path);
    }

    @JavascriptInterface
    public void openGallery() {
      openFieldTraceAlbum();
    }

    @JavascriptInterface
    public void openFieldTraceAlbum() {
      try {
        String latest = getLatestFieldTracePhotoUri();
        if (latest != null && !latest.isEmpty()) {
          Uri uri = Uri.parse(latest);
          Intent intent = new Intent(Intent.ACTION_VIEW);
          intent.setDataAndType(uri, "image/*");
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(intent);
          return;
        }
      } catch (Exception ignored) {}
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

    @JavascriptInterface
    public String getLatestFieldTracePhotoUri() {
      try {
        String[] projection = {
          MediaStore.Images.Media._ID,
          MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
          MediaStore.Images.Media.DATE_ADDED
        };
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME + "=?",
            new String[]{ ALBUM_NAME },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
          }
        }
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            new String[]{ MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA },
            MediaStore.Images.Media.DATA + " LIKE ? OR " + MediaStore.Images.Media.DATA + " LIKE ?",
            new String[]{ "%/Field Trace/%", "%/FieldTrace/%" },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
          }
        }
      } catch (Exception ignored) {}
      return "";
    }

    @JavascriptInterface
    public String listFieldTracePhotos(int limit) {
      JSONArray arr = new JSONArray();
      if (limit <= 0) limit = 60;
      if (limit > 200) limit = 200;
      try {
        String[] projection = {
          MediaStore.Images.Media._ID,
          MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
          MediaStore.Images.Media.DATE_ADDED
        };
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME + "=?",
            new String[]{ ALBUM_NAME },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null) {
            int n = 0;
            while (cursor.moveToNext() && n < limit) {
              long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
              String uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
              JSONObject obj = new JSONObject();
              obj.put("uri", uri);
              obj.put("id", id);
              arr.put(obj);
              n++;
            }
          }
        }
        if (arr.length() == 0) {
          try (Cursor cursor = getContentResolver().query(
              MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
              new String[]{ MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA },
              MediaStore.Images.Media.DATA + " LIKE ? OR " + MediaStore.Images.Media.DATA + " LIKE ?",
              new String[]{ "%/Field Trace/%", "%/FieldTrace/%" },
              MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            if (cursor != null) {
              int n = 0;
              while (cursor.moveToNext() && n < limit) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
                String uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
                JSONObject obj = new JSONObject();
                obj.put("uri", uri);
                obj.put("id", id);
                arr.put(obj);
                n++;
              }
            }
          }
        }
      } catch (Exception ignored) {}
      return arr.toString();
    }

    @JavascriptInterface
    public String getPhotoThumbnailBase64(String uriString, int maxSide) {
      if (uriString == null || uriString.trim().isEmpty()) return "";
      if (maxSide <= 0) maxSide = 256;
      if (maxSide > 2048) maxSide = 2048;
      try {
        Uri uri = Uri.parse(uriString.trim());
        if (!"content".equalsIgnoreCase(uri.getScheme()) && !"file".equalsIgnoreCase(uri.getScheme())) {
          try {
            uri = resolveImageContentUri(uriString.trim());
          } catch (Exception e) {
            uri = Uri.parse(uriString.trim());
          }
        }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream is = getContentResolver().openInputStream(uri)) {
          if (is == null) return "";
          BitmapFactory.decodeStream(is, null, bounds);
        }
        int sample = 1;
        int w = Math.max(1, bounds.outWidth);
        int h = Math.max(1, bounds.outHeight);
        while (Math.max(w / sample, h / sample) > maxSide) sample *= 2;

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp;
        try (InputStream is = getContentResolver().openInputStream(uri)) {
          if (is == null) return "";
          bmp = BitmapFactory.decodeStream(is, null, opts);
        }
        if (bmp == null) return "";
        int tw = bmp.getWidth();
        int th = bmp.getHeight();
        float scale = Math.min(1f, (float) maxSide / Math.max(tw, th));
        if (scale < 0.99f) {
          Bitmap scaled = Bitmap.createScaledBitmap(bmp, Math.round(tw * scale), Math.round(th * scale), true);
          if (scaled != bmp) {
            bmp.recycle();
            bmp = scaled;
          }
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        int quality = maxSide > 512 ? 85 : 72;
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos);
        bmp.recycle();
        String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        return "data:image/jpeg;base64," + b64;
      } catch (Exception e) {
        return "";
      }
    }

    @JavascriptInterface
    public String getLatestFieldTraceThumbnailBase64(int maxSide) {
      try {
        String uri = getLatestFieldTracePhotoUri();
        if (uri == null || uri.isEmpty()) return "";
        return getPhotoThumbnailBase64(uri, maxSide);
      } catch (Exception e) {
        return "";
      }
    }

    @JavascriptInterface
    public int deleteUris(String urisJson) {
      int deleted = 0;
      if (urisJson == null || urisJson.trim().isEmpty()) return 0;
      try {
        JSONArray arr = new JSONArray(urisJson);
        for (int i = 0; i < arr.length(); i++) {
          String s = arr.optString(i, "");
          if (s.isEmpty()) continue;
          try {
            Uri uri = Uri.parse(s);
            int n = getContentResolver().delete(uri, null, null);
            if (n > 0) deleted += n;
          } catch (Exception ignored) {}
        }
      } catch (Exception ignored) {}
      return deleted;
    }

    @JavascriptInterface
    public int deleteUri(String uriString) {
      if (uriString == null || uriString.trim().isEmpty()) return 0;
      try {
        return getContentResolver().delete(Uri.parse(uriString.trim()), null, null);
      } catch (Exception e) {
        return 0;
      }
    }

    @JavascriptInterface
    public void shareUris(String urisJson) {
      if (urisJson == null || urisJson.trim().isEmpty()) return;
      try {
        JSONArray arr = new JSONArray(urisJson);
        ArrayList<Uri> uris = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
          String s = arr.optString(i, "");
          if (s.isEmpty()) continue;
          try {
            Uri u = Uri.parse(s);
            uris.add(u);
          } catch (Exception ignored) {}
        }
        if (uris.isEmpty()) return;
        Intent intent;
        if (uris.size() == 1) {
          intent = new Intent(Intent.ACTION_SEND);
          intent.setType("image/jpeg");
          intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
          intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
          intent.setType("image/jpeg");
          intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent chooser = Intent.createChooser(intent, "Compartir fotos Field Trace");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(chooser);
      } catch (Exception ignored) {}
    }
  }
}
