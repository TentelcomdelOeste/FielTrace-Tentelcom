#!/usr/bin/env python3
"""Temporary build helper: generate launcher + splash assets from the 512 master."""
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
for p in [PUBLIC / "android-chrome-512x512.png", PUBLIC / "pwa-512x512.png"]:
    if p.exists():
        src = p
        break
if src is None:
    print("ERROR: no 512 source", file=sys.stderr)
    sys.exit(1)

img = Image.open(src).convert("RGBA")
print("512 source", src, img.size)

def fit(im, size):
    return im.resize((size, size), Image.Resampling.LANCZOS)

def padded(im, canvas_size, content_ratio):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    inner = max(1, int(canvas_size * content_ratio))
    icon = fit(im, inner)
    off = (canvas_size - inner) // 2
    canvas.paste(icon, (off, off), icon)
    return canvas

# Android adaptive-icon safe region: keep the logo around 61% of the 108dp canvas.
LAUNCHER_RATIO = 0.61
launcher_sizes = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
for folder, size in launcher_sizes.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    foreground = padded(img, size, LAUNCHER_RATIO)
    foreground.save(d / "ic_launcher_foreground.png", "PNG")
    foreground.save(d / "ic_launcher.png", "PNG")
    foreground.save(d / "ic_launcher_round.png", "PNG")
    print("wrote launcher", folder, size)

# Android 12+ splash: stay just inside the icon mask while retaining the 512px master detail.
SPLASH_RATIO = 0.66
drawable = RES / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
for stale in ("splash.png", "splash.jpg", "splash.jpeg", "splash.webp"):
    p = drawable / stale
    if p.exists():
        p.unlink()

padded(img, 512, SPLASH_RATIO).save(drawable / "splash_icon.png", "PNG")
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

# Stage only the generated launcher/splash resources so the existing workflow commits them.
import subprocess
subprocess.run([
    "git", "add",
    "android/app/src/main/res/mipmap-mdpi",
    "android/app/src/main/res/mipmap-hdpi",
    "android/app/src/main/res/mipmap-xhdpi",
    "android/app/src/main/res/mipmap-xxhdpi",
    "android/app/src/main/res/mipmap-xxxhdpi",
    "android/app/src/main/res/drawable",
    "android/app/src/main/res/drawable-mdpi",
    "android/app/src/main/res/drawable-hdpi",
    "android/app/src/main/res/drawable-xhdpi",
    "android/app/src/main/res/drawable-xxhdpi",
    "android/app/src/main/res/drawable-xxxhdpi",
], check=True)
print(f"OK launcher safe-zone={LAUNCHER_RATIO}, splash safe-zone={SPLASH_RATIO}")
