#!/usr/bin/env python3
"""ONLY improve splash sharpness using 512 master. Do not touch launcher or App.tsx."""
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
PUBLIC = ROOT / "public"

src = None
for p in [
    PUBLIC / "android-chrome-512x512.png",
    PUBLIC / "pwa-512x512.png",
]:
    if p.exists():
        src = p
        break
if src is None:
    print("ERROR: no 512 source", file=sys.stderr)
    sys.exit(1)

img = Image.open(src).convert("RGBA")
print("splash source", src, img.size)

def fit(im, size):
    return im.resize((size, size), Image.Resampling.LANCZOS)

def padded(im, canvas_size, content_ratio):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    inner = max(1, int(canvas_size * content_ratio))
    icon = fit(im, inner)
    off = (canvas_size - inner) // 2
    canvas.paste(icon, (off, off), icon)
    return canvas

# Larger logo in splash (~75%) so more pixels of the 512 are visible / sharper
SPLASH_RATIO = 0.75

drawable = RES / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
for stale in ("splash.png", "splash.jpg", "splash.jpeg", "splash.webp"):
    p = drawable / stale
    if p.exists():
        p.unlink()
        print("removed", p)

# Master splash_icon at full 512 canvas from HD source
padded(img, 512, SPLASH_RATIO).save(drawable / "splash_icon.png", "PNG")
print("wrote drawable/splash_icon.png 512")

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

# High-density variants (no downscale below source detail)
for folder, size in {
    "drawable-mdpi": 256,
    "drawable-hdpi": 384,
    "drawable-xhdpi": 512,
    "drawable-xxhdpi": 768,
    "drawable-xxxhdpi": 1024,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    padded(img, size, SPLASH_RATIO).save(d / "splash_icon.png", "PNG")
    for stale in ("splash.png", "splash.jpg"):
        p = d / stale
        if p.exists():
            p.unlink()
    print("wrote", folder, size)

# Ensure white splash background + theme hooks (do not alter launcher mipmaps)
values = RES / "values"
values.mkdir(parents=True, exist_ok=True)

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

# Keep launch theme pointing at splash drawable + Android 12 attributes
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

print(f"OK splash-only HD ratio={SPLASH_RATIO}")
