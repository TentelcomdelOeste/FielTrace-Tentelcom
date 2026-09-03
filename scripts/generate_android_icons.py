#!/usr/bin/env python3
"""Generate Android launcher icons + splash resources from public/pwa-512x512.png."""
from pathlib import Path
import sys

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
    print("ERROR: no 512 source icon found", file=sys.stderr)
    sys.exit(1)

img = Image.open(src).convert("RGBA")
print(f"source={src} size={img.size}")

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

ADAPTIVE_FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

def resize_cover(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)

for folder, size in DENSITIES.items():
    out_dir = RES / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = resize_cover(img, size)
    icon.save(out_dir / "ic_launcher.png", "PNG")
    icon.save(out_dir / "ic_launcher_round.png", "PNG")
    print(f"wrote {folder}/ic_launcher.png ({size}x{size})")

for folder, size in ADAPTIVE_FG.items():
    out_dir = RES / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    # Use full icon as foreground (better match to brand art on adaptive masks)
    icon = resize_cover(img, size)
    icon.save(out_dir / "ic_launcher_foreground.png", "PNG")
    print(f"wrote {folder}/ic_launcher_foreground.png ({size}x{size})")

anydpi = RES / "mipmap-anydpi-v26"
anydpi.mkdir(parents=True, exist_ok=True)
(anydpi / "ic_launcher.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
""",
    encoding="utf-8",
)
(anydpi / "ic_launcher_round.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
""",
    encoding="utf-8",
)

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

# Merge-safe colors: write only our names; keep file complete for first install
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

    <!-- Launch / splash theme: white background + centered logo -->
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>
""",
    encoding="utf-8",
)

drawable = RES / "drawable"
drawable.mkdir(parents=True, exist_ok=True)

# Capacitor may ship drawable/splash.png — remove it to avoid duplicate with splash.xml
for stale in ("splash.png", "splash.jpg", "splash.jpeg", "splash.webp"):
    p = drawable / stale
    if p.exists():
        p.unlink()
        print(f"removed conflicting {p}")

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
print("wrote drawable/splash.xml + splash_icon.png")

for folder, size in {
    "drawable-mdpi": 192,
    "drawable-hdpi": 288,
    "drawable-xhdpi": 384,
    "drawable-xxhdpi": 576,
    "drawable-xxxhdpi": 768,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    resize_cover(img, size).save(d / "splash_icon.png", "PNG")
    # remove capacitor splash bitmaps if present in density folders
    for stale in ("splash.png", "splash.jpg"):
        p = d / stale
        if p.exists():
            p.unlink()
            print(f"removed conflicting {p}")
    print(f"wrote {folder}/splash_icon.png ({size})")

xml_dir = RES / "xml"
xml_dir.mkdir(parents=True, exist_ok=True)
(xml_dir / "file_paths.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="external_files" path="."/>
    <cache-path name="cache" path="."/>
    <files-path name="files" path="."/>
</paths>
""",
    encoding="utf-8",
)

print("OK android icons + splash resources generated")
