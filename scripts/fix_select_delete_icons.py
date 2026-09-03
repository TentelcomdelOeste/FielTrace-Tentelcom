#!/usr/bin/env python3
"""Fix missing project select/delete helpers + regenerate icons/splash properly."""
from pathlib import Path
import sys

app_path = Path("src/App.tsx")
text = app_path.read_text(encoding="utf-8")

# ---- 1) Inject missing helpers if absent ----
if "const toggleProjectSelect" not in text:
    marker = """  const handleSelectProject = async (p: Project) => {
    setSelectedProject(p);
    const evs = await storageService.getEvidencesByProject(p.id!);
    setEvidences(evs);
    setCurrentStep('history');
  };"""
    helpers = """  const handleSelectProject = async (p: Project) => {
    setSelectedProject(p);
    const evs = await storageService.getEvidencesByProject(p.id!);
    setEvidences(evs);
    setCurrentStep('history');
  };

  const toggleProjectSelect = (id: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearProjectSelection = () => {
    setSelectedProjectIds([]);
    setProjectSelectMode(false);
  };

  const requestDeleteProjects = (ids: number[]) => {
    const unique = Array.from(new Set(ids.filter((id) => id != null)));
    if (!unique.length) return;
    setPendingDeleteProjectIds(unique);
    setConfirmDeleteProjectsStep(1);
  };

  const executeDeleteProjects = async () => {
    const ids = pendingDeleteProjectIds;
    if (!ids.length) {
      setConfirmDeleteProjectsStep(0);
      return;
    }
    try {
      if ((storageService as any).deleteProjects) {
        await (storageService as any).deleteProjects(ids);
      } else {
        for (const id of ids) {
          if ((storageService as any).deleteAllEvidencesByProject) {
            await (storageService as any).deleteAllEvidencesByProject(id);
          }
          await (storageService as any).deleteProject?.(id);
        }
      }
      if (selectedProject?.id != null && ids.includes(selectedProject.id)) {
        setSelectedProject(null);
        setEvidences([]);
        setCurrentStep('home');
      }
      clearProjectSelection();
      await loadData();
    } catch (e) {
      console.error('[Projects] delete failed', e);
    } finally {
      setPendingDeleteProjectIds([]);
      setConfirmDeleteProjectsStep(0);
    }
  };"""
    if marker in text:
        text = text.replace(marker, helpers, 1)
        print("helpers: inserted after handleSelectProject")
    else:
        alt = "const handleSelectProject = async (p: Project) => {"
        idx = text.find(alt)
        if idx < 0:
            print("ERROR: cannot find handleSelectProject", file=sys.stderr)
            sys.exit(1)
        end = text.find("\n  const captureBatchPhoto", idx)
        if end < 0:
            end = text.find("\n  const ", idx + len(alt) + 50)
        if end < 0:
            print("ERROR: cannot find insert point", file=sys.stderr)
            sys.exit(1)
        block = helpers[helpers.find("  const toggleProjectSelect"):]
        text = text[:end] + "\n\n" + block + text[end:]
        print("helpers: inserted via alt path")
else:
    print("helpers: already present")

if "selectedProjectIds" not in text:
    print("ERROR: selectedProjectIds state missing", file=sys.stderr)
    sys.exit(1)

if "confirmDeleteProjectsStep === 1" not in text:
    print("WARN: modals missing - injecting")
    insert_before = "        {confirmClearAllStep === 1 && ("
    if insert_before not in text:
        insert_before = "        {editingEvidence && ("
    modal = """
        {confirmDeleteProjectsStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                {pendingDeleteProjectIds.length === 1 ? '¿Eliminar proyecto?' : `¿Eliminar ${pendingDeleteProjectIds.length} proyectos?`}
              </h3>
              <p className="text-sm text-gray-600">
                Se borrarán el proyecto y todos sus registros. Las fotos del álbum Field Trace no se eliminan automáticamente.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmDeleteProjectsStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteProjectsStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[201] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>.
                {pendingDeleteProjectIds.length === 1
                  ? ' ¿Eliminar definitivamente este proyecto?'
                  : ` ¿Eliminar definitivamente ${pendingDeleteProjectIds.length} proyectos?`}
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => { void executeDeleteProjects(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Sí, eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

"""
    if insert_before in text:
        text = text.replace(insert_before, modal + insert_before, 1)
        print("modals: injected")
    else:
        print("ERROR: cannot inject modals", file=sys.stderr)
        sys.exit(1)

app_path.write_text(text, encoding="utf-8")
print("App.tsx updated, size", app_path.stat().st_size)
for k in ["const toggleProjectSelect", "const requestDeleteProjects", "const executeDeleteProjects", "const clearProjectSelection"]:
    print(k, k in text)

# ---- 2) Regenerate icons ----
try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "Pillow"])
    from PIL import Image

ROOT = Path(".")
SRC_CANDIDATES = [
    ROOT / "public" / "pwa-512x512.png",
    ROOT / "public" / "android-chrome-512x512.png",
]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
src = next((p for p in SRC_CANDIDATES if p.exists()), None)
if src is None:
    print("ERROR: no source icon", file=sys.stderr)
    sys.exit(1)

img = Image.open(src).convert("RGBA")
print("icon source", src, img.size)

def resize_cover(im, size):
    return im.resize((size, size), Image.Resampling.LANCZOS)

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
for folder, size in DENSITIES.items():
    out_dir = RES / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = resize_cover(img, size)
    icon.save(out_dir / "ic_launcher.png", "PNG")
    icon.save(out_dir / "ic_launcher_round.png", "PNG")

ADAPTIVE_FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
for folder, size in ADAPTIVE_FG.items():
    out_dir = RES / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.66)
    icon = resize_cover(img, inner)
    offset = (size - inner) // 2
    canvas.paste(icon, (offset, offset), icon)
    canvas.save(out_dir / "ic_launcher_foreground.png", "PNG")

anydpi = RES / "mipmap-anydpi-v26"
anydpi.mkdir(parents=True, exist_ok=True)
adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
(anydpi / "ic_launcher.xml").write_text(adaptive_xml, encoding="utf-8")
(anydpi / "ic_launcher_round.xml").write_text(adaptive_xml, encoding="utf-8")

values = RES / "values"
values.mkdir(parents=True, exist_ok=True)
(values / "ic_launcher_background.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2563EB</color>
</resources>
""",
    encoding="utf-8",
)
(values / "colors.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#2563EB</color>
    <color name="colorPrimaryDark">#1D4ED8</color>
    <color name="colorAccent">#2563EB</color>
    <color name="splash_background">#FFFFFF</color>
</resources>
""",
    encoding="utf-8",
)
(values / "strings.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Field Trace</string>
    <string name="title_activity_main">Field Trace</string>
    <string name="package_name">com.fieldtrace.app</string>
    <string name="custom_url_scheme">com.fieldtrace.app</string>
</resources>
""",
    encoding="utf-8",
)
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
""",
    encoding="utf-8",
)

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
""",
    encoding="utf-8",
)

drawable = RES / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
for stale in ("splash.png", "splash.jpg", "splash.jpeg", "splash.webp"):
    p = drawable / stale
    if p.exists():
        p.unlink()
        print("removed", p)

splash_logo = resize_cover(img, 192)
splash_logo.save(drawable / "splash_icon.png", "PNG")
(drawable / "splash.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_icon"/>
    </item>
</layer-list>
""",
    encoding="utf-8",
)

for folder, size in {
    "drawable-mdpi": 128,
    "drawable-hdpi": 192,
    "drawable-xhdpi": 256,
    "drawable-xxhdpi": 384,
    "drawable-xxxhdpi": 512,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    resize_cover(img, size).save(d / "splash_icon.png", "PNG")
    for stale in ("splash.png", "splash.jpg"):
        p = d / stale
        if p.exists():
            p.unlink()

print("OK icons + splash regenerated (safe-zone adaptive, white splash)")
