#!/usr/bin/env python3
"""Restore gallery multi-select + share/delete; shrink splash/icon so logo is not cropped."""
from pathlib import Path
import sys

app_path = Path("src/App.tsx")
text = app_path.read_text(encoding="utf-8")

# ---- 1) State for gallery select ----
if "gallerySelectMode" not in text:
    marker = "  const [showPhotoViewer, setShowPhotoViewer] = useState(false);"
    inject = """  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [gallerySelectMode, setGallerySelectMode] = useState(false);
  const [selectedGalleryUris, setSelectedGalleryUris] = useState<string[]>([]);
  const [confirmDeleteGalleryStep, setConfirmDeleteGalleryStep] = useState<0 | 1 | 2>(0);"""
    if marker not in text:
        print("ERROR: cannot find showPhotoViewer state", file=sys.stderr)
        sys.exit(1)
    text = text.replace(marker, inject, 1)
    print("state: gallery select injected")
else:
    print("state: already present")

# ---- 2) Helpers ----
if "const toggleGallerySelect" not in text:
    insert_after = None
    for cand in [
        "  const openPhotoViewer = (idx: number) => {\n    setViewerIndex(idx);\n    setShowPhotoViewer(true);\n  };",
        "  const openPhotoViewer = (idx: number) => {\n    setViewerIndex(idx);\n    setShowPhotoViewer(true);\n  }",
    ]:
        if cand in text:
            insert_after = cand
            break

    helpers = """
  const toggleGallerySelect = (uri: string) => {
    setSelectedGalleryUris((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]
    );
  };

  const clearGallerySelection = () => {
    setSelectedGalleryUris([]);
    setGallerySelectMode(false);
  };

  const shareSelectedGallery = (uris?: string[]) => {
    const list = uris && uris.length ? uris : selectedGalleryUris;
    if (!list.length) return;
    try {
      const native = (window as any).FieldTraceNative;
      if (native && typeof native.shareUris === 'function') {
        native.shareUris(JSON.stringify(list));
      } else {
        console.warn('[Gallery] shareUris not available');
      }
    } catch (e) {
      console.error('[Gallery] share failed', e);
    }
  };

  const requestDeleteGallery = (uris?: string[]) => {
    const list = uris && uris.length ? uris : selectedGalleryUris;
    if (!list.length) return;
    setSelectedGalleryUris(list);
    setConfirmDeleteGalleryStep(1);
  };

  const executeDeleteGallery = async () => {
    const list = [...selectedGalleryUris];
    if (!list.length) {
      setConfirmDeleteGalleryStep(0);
      return;
    }
    try {
      const native = (window as any).FieldTraceNative;
      if (native && typeof native.deleteUris === 'function') {
        native.deleteUris(JSON.stringify(list));
      }
      const remaining = galleryThumbs.filter((p) => !list.includes(p.uri));
      setGalleryThumbs(remaining);
      if (showPhotoViewer) {
        if (remaining.length === 0) {
          setShowPhotoViewer(false);
        } else {
          setViewerIndex((i) => Math.min(i, remaining.length - 1));
        }
      }
      clearGallerySelection();
      try {
        const photos = await cameraService.listAlbumPhotos(60);
        const mapped = (photos || []).map((p: any) => ({
          uri: p.uri,
          thumb: p.thumb || p.uri,
        }));
        setGalleryThumbs(mapped);
      } catch (_) {}
    } catch (e) {
      console.error('[Gallery] delete failed', e);
    } finally {
      setConfirmDeleteGalleryStep(0);
    }
  };
"""

    if insert_after:
        text = text.replace(insert_after, insert_after + "\n" + helpers, 1)
        print("helpers: inserted after openPhotoViewer")
    else:
        alt = "  const openPhotoViewer"
        idx = text.find(alt)
        if idx < 0:
            alt2 = "  const executeDeleteProjects = async () => {"
            idx2 = text.find(alt2)
            if idx2 < 0:
                print("ERROR: cannot find insert point for gallery helpers", file=sys.stderr)
                sys.exit(1)
            end = text.find("\n  const captureBatchPhoto", idx2)
            if end < 0:
                end = text.find("\n  const openPhotoViewer", idx2)
            if end < 0:
                print("ERROR: cannot find end of executeDeleteProjects", file=sys.stderr)
                sys.exit(1)
            text = text[:end] + "\n" + helpers + text[end:]
            print("helpers: inserted near project delete helpers")
        else:
            brace = text.find("{", idx)
            depth = 0
            i = brace
            while i < len(text):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            text = text[:i] + "\n" + helpers + text[i:]
            print("helpers: inserted after openPhotoViewer (parsed)")
else:
    print("helpers: already present")

# ---- 3) Gallery grid header ----
old_grid_header = """            <div className=\"flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0\">
              <button
                type=\"button\"
                onClick={() => setShowGalleryGrid(false)}
                className=\"w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white\"
              >
                <ArrowLeft className=\"w-5 h-5\" />
              </button>
              <h2 className=\"text-sm font-black uppercase tracking-tight text-white\">Field Trace</h2>
              <button
                type=\"button\"
                onClick={() => {
                  setShowGalleryGrid(false);
                  void cameraService.openFieldTraceAlbum(true);
                }}
                className=\"text-[10px] font-black uppercase text-blue-400 px-2 py-2\"
              >
                Galeria
              </button>
            </div>"""

new_grid_header = """            <div className=\"flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0\">
              <button
                type=\"button\"
                onClick={() => { clearGallerySelection(); setShowGalleryGrid(false); }}
                className=\"w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white\"
              >
                <ArrowLeft className=\"w-5 h-5\" />
              </button>
              <h2 className=\"text-sm font-black uppercase tracking-tight text-white\">
                {gallerySelectMode
                  ? (selectedGalleryUris.length ? `${selectedGalleryUris.length} seleccionada(s)` : 'Seleccionar')
                  : 'Field Trace'}
              </h2>
              <div className=\"flex items-center gap-1\">
                {!gallerySelectMode ? (
                  <>
                    <button
                      type=\"button\"
                      onClick={() => { setGallerySelectMode(true); setSelectedGalleryUris([]); }}
                      className=\"text-[10px] font-black uppercase text-blue-400 px-2 py-2\"
                    >
                      Seleccionar
                    </button>
                    <button
                      type=\"button\"
                      onClick={() => {
                        setShowGalleryGrid(false);
                        void cameraService.openFieldTraceAlbum(true);
                      }}
                      className=\"text-[10px] font-black uppercase text-white/50 px-2 py-2\"
                    >
                      Galeria
                    </button>
                  </>
                ) : (
                  <button
                    type=\"button\"
                    onClick={clearGallerySelection}
                    className=\"text-[10px] font-black uppercase text-white/70 px-2 py-2\"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>"""

if old_grid_header in text:
    text = text.replace(old_grid_header, new_grid_header, 1)
    print("grid header: replaced")
else:
    print("WARN: grid header pattern not exact")

old_cells = """              {!galleryLoading && galleryThumbs.length > 0 && (
                <div className=\"grid grid-cols-3 gap-1.5\">
                  {galleryThumbs.map((item, idx) => (
                    <button
                      key={item.uri}
                      type=\"button\"
                      className=\"aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80\"
                      onClick={() => openPhotoViewer(idx)}
                    >
                      <img src={item.thumb} alt=\"\" className=\"w-full h-full object-cover\" />
                    </button>
                  ))}
                </div>
              )}
            </div>"""

new_cells = """              {!galleryLoading && galleryThumbs.length > 0 && (
                <div className=\"grid grid-cols-3 gap-1.5\">
                  {galleryThumbs.map((item, idx) => {
                    const isSel = selectedGalleryUris.includes(item.uri);
                    return (
                      <button
                        key={item.uri}
                        type=\"button\"
                        className={`relative aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80 ${isSel ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => {
                          if (gallerySelectMode) toggleGallerySelect(item.uri);
                          else openPhotoViewer(idx);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!gallerySelectMode) setGallerySelectMode(true);
                          toggleGallerySelect(item.uri);
                        }}
                      >
                        <img src={item.thumb} alt=\"\" className=\"w-full h-full object-cover\" />
                        {gallerySelectMode && (
                          <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center ${isSel ? 'bg-blue-500 text-white' : 'bg-black/40 border border-white/40 text-transparent'}`}>
                            <CheckCircle2 className=\"w-4 h-4\" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {gallerySelectMode && selectedGalleryUris.length > 0 && (
              <div className=\"shrink-0 border-t border-white/10 px-4 py-3 flex gap-3 bg-black/90\">
                <button
                  type=\"button\"
                  onClick={() => shareSelectedGallery()}
                  className=\"flex-1 py-3 rounded-2xl bg-white/10 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2\"
                >
                  <Share2 className=\"w-4 h-4\" /> Compartir
                </button>
                <button
                  type=\"button\"
                  onClick={() => requestDeleteGallery()}
                  className=\"flex-1 py-3 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2\"
                >
                  <Trash2 className=\"w-4 h-4\" /> Eliminar
                </button>
              </div>
            )}"""

if old_cells in text:
    text = text.replace(old_cells, new_cells, 1)
    print("grid cells: replaced")
else:
    print("WARN: grid cells pattern not exact")

old_viewer_footer = """            <p className=\"text-center text-[9px] text-white/35 py-3 shrink-0\">
              Desliza izquierda / derecha para ver otras fotos
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

new_viewer_footer = """            <div className=\"shrink-0 border-t border-white/10 px-4 py-3 flex items-center justify-between gap-3 bg-black\">
              <p className=\"text-[9px] text-white/35\">Desliza para ver otras</p>
              <div className=\"flex gap-2\">
                <button
                  type=\"button\"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) shareSelectedGallery([uri]);
                  }}
                  className=\"px-4 py-2.5 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5\"
                >
                  <Share2 className=\"w-3.5 h-3.5\" /> Compartir
                </button>
                <button
                  type=\"button\"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) requestDeleteGallery([uri]);
                  }}
                  className=\"px-4 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5\"
                >
                  <Trash2 className=\"w-3.5 h-3.5\" /> Eliminar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

if old_viewer_footer in text:
    text = text.replace(old_viewer_footer, new_viewer_footer, 1)
    print("viewer footer: replaced")
else:
    print("WARN: viewer footer pattern not exact")

if "confirmDeleteGalleryStep === 1" not in text:
    insert_before = "        {confirmDeleteProjectsStep === 1 && ("
    if insert_before not in text:
        insert_before = "        {confirmClearAllStep === 1 && ("
    if insert_before not in text:
        insert_before = "        {editingEvidence && ("
    modal = """
        {confirmDeleteGalleryStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                {selectedGalleryUris.length === 1 ? '¿Eliminar foto?' : `¿Eliminar ${selectedGalleryUris.length} fotos?`}
              </h3>
              <p className="text-sm text-gray-600">
                Se eliminarán del álbum Field Trace del dispositivo.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteGalleryStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[211] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>.
                {selectedGalleryUris.length === 1
                  ? ' ¿Eliminar definitivamente esta foto?'
                  : ` ¿Eliminar definitivamente ${selectedGalleryUris.length} fotos?`}
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => { void executeDeleteGallery(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Sí, eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

"""
    if insert_before in text:
        text = text.replace(insert_before, modal + insert_before, 1)
        print("modals: gallery delete injected")
    else:
        print("ERROR: cannot inject gallery modals", file=sys.stderr)
        sys.exit(1)
else:
    print("modals: already present")

app_path.write_text(text, encoding="utf-8")
print("App.tsx size", app_path.stat().st_size)
checks = [
    "gallerySelectMode",
    "const toggleGallerySelect",
    "const shareSelectedGallery",
    "const executeDeleteGallery",
    "confirmDeleteGalleryStep === 1",
    "Compartir",
    "requestDeleteGallery",
]
for c in checks:
    print(c, c in text)

# ---- Icons/splash ----
try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "Pillow"])
    from PIL import Image

ROOT = Path(".")
src = None
for p in [ROOT / "public" / "pwa-512x512.png", ROOT / "public" / "android-chrome-512x512.png"]:
    if p.exists():
        src = p
        break
if src is None:
    print("WARN: no source icon, skip icon regen")
    sys.exit(0)

img = Image.open(src).convert("RGBA")
RES = ROOT / "android" / "app" / "src" / "main" / "res"

def resize_cover(im, size):
    return im.resize((size, size), Image.Resampling.LANCZOS)

for folder, size in {
    "mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    icon = resize_cover(img, size)
    icon.save(d / "ic_launcher.png", "PNG")
    icon.save(d / "ic_launcher_round.png", "PNG")

for folder, size in {
    "mipmap-mdpi": 108, "mipmap-hdpi": 162, "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324, "mipmap-xxxhdpi": 432,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.55)
    icon = resize_cover(img, inner)
    off = (size - inner) // 2
    canvas.paste(icon, (off, off), icon)
    canvas.save(d / "ic_launcher_foreground.png", "PNG")

anydpi = RES / "mipmap-anydpi-v26"
anydpi.mkdir(parents=True, exist_ok=True)
ax = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
(anydpi / "ic_launcher.xml").write_text(ax, encoding="utf-8")
(anydpi / "ic_launcher_round.xml").write_text(ax, encoding="utf-8")

values = RES / "values"
values.mkdir(parents=True, exist_ok=True)
(values / "ic_launcher_background.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2563EB</color>
</resources>
""", encoding="utf-8")
(values / "colors.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#2563EB</color>
    <color name="colorPrimaryDark">#1D4ED8</color>
    <color name="colorAccent">#2563EB</color>
    <color name="splash_background">#FFFFFF</color>
</resources>
""", encoding="utf-8")
(values / "strings.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Field Trace</string>
    <string name="title_activity_main">Field Trace</string>
    <string name="package_name">com.fieldtrace.app</string>
    <string name="custom_url_scheme">com.fieldtrace.app</string>
</resources>
""", encoding="utf-8")
(values / "styles.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowBackground">@drawable/splash</item>
        <item name="android:windowSplashScreenBackground">@color/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenIconBackgroundColor">@color/splash_background</item>
    </style>
</resources>
""", encoding="utf-8")

values31 = RES / "values-v31"
values31.mkdir(parents=True, exist_ok=True)
(values31 / "styles.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:windowSplashScreenBackground">@color/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenIconBackgroundColor">@color/splash_background</item>
        <item name="android:windowSplashScreenBrandingImage">@null</item>
    </style>
</resources>
""", encoding="utf-8")

drawable = RES / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
for stale in ("splash.png", "splash.jpg", "splash.jpeg", "splash.webp"):
    p = drawable / stale
    if p.exists():
        p.unlink()

splash_logo = resize_cover(img, 128)
splash_logo.save(drawable / "splash_icon.png", "PNG")
(drawable / "splash.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_icon"/>
    </item>
</layer-list>
""", encoding="utf-8")

for folder, size in {
    "drawable-mdpi": 96, "drawable-hdpi": 128, "drawable-xhdpi": 160,
    "drawable-xxhdpi": 192, "drawable-xxxhdpi": 256,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    resize_cover(img, size).save(d / "splash_icon.png", "PNG")
    for stale in ("splash.png", "splash.jpg"):
        p = d / stale
        if p.exists():
            p.unlink()

print("OK: gallery select restored + splash/icon smaller")
