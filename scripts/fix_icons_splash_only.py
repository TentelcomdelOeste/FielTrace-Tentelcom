#!/usr/bin/env python3
"""ONLY fix launcher icons + splash. Do not touch App.tsx or any other logic."""
from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "Pillow"])
    from PIL import Image

ROOT = Path(".")
RES = ROOT / "android" / "app" / "src" / "main" / "res"

src = None
for p in [
    ROOT / "public" / "pwa-512x512.png",
    ROOT / "public" / "android-chrome-512x512.png",
    ROOT / "public" / "pwa-192x192.png",
]:
    if p.exists():
        src = p
        break
if src is None:
    print("ERROR: no source icon in public/", file=sys.stderr)
    sys.exit(1)

img = Image.open(src).convert("RGBA")
print("source", src, img.size)

def fit(im, size):
    return im.resize((size, size), Image.Resampling.LANCZOS)

def padded(im, canvas_size, content_ratio):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    inner = max(1, int(canvas_size * content_ratio))
    icon = fit(im, inner)
    off = (canvas_size - inner) // 2
    canvas.paste(icon, (off, off), icon)
    return canvas

for folder, size in {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    icon = fit(img, size)
    icon.save(d / "ic_launcher.png", "PNG")
    icon.save(d / "ic_launcher_round.png", "PNG")

BRAND_BLUE = "#003499"
for folder, size in {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    fg = padded(img, size, 0.78)
    fg.save(d / "ic_launcher_foreground.png", "PNG")

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
    f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{BRAND_BLUE}</color>
</resources>
""",
    encoding="utf-8",
)

colors_path = values / "colors.xml"
if colors_path.exists():
    c = colors_path.read_text(encoding="utf-8")
    if "splash_background" not in c:
        c = c.replace("</resources>", '    <color name="splash_background">#FFFFFF</color>\n</resources>')
        colors_path.write_text(c, encoding="utf-8")
    else:
        import re
        c = re.sub(
            r'<color name="splash_background">[^<]*</color>',
            '<color name="splash_background">#FFFFFF</color>',
            c,
        )
        colors_path.write_text(c, encoding="utf-8")
else:
    colors_path.write_text(
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

padded(img, 288, 0.40).save(drawable / "splash_icon.png", "PNG")
(drawable / "splash.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_icon"/>
    </item>
</layer-list>
""",
    encoding="utf-8",
)

for folder, size in {
    "drawable-mdpi": 144,
    "drawable-hdpi": 216,
    "drawable-xhdpi": 288,
    "drawable-xxhdpi": 432,
    "drawable-xxxhdpi": 576,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    padded(img, size, 0.40).save(d / "splash_icon.png", "PNG")
    for stale in ("splash.png", "splash.jpg"):
        p = d / stale
        if p.exists():
            p.unlink()

print("OK: icons + splash only (no App.tsx changes)")
