#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageOps
import re

ROOT = Path('.')
RES = ROOT / 'android/app/src/main/res'
PUBLIC = ROOT / 'public'

# --- Launcher: use the existing transparent foreground as the visual master.
# Android adaptive icon canvas is 108dp; keep the actual logo at 66dp max safe size.
fg_master = RES / 'mipmap-xxxhdpi/ic_launcher_foreground.png'
if not fg_master.exists():
    raise SystemExit('Missing existing launcher foreground')
fg = Image.open(fg_master).convert('RGBA')
alpha = fg.getchannel('A')
bbox = alpha.getbbox()
if not bbox:
    raise SystemExit('Launcher foreground has no visible pixels')
content = fg.crop(bbox)

# 61% of the adaptive 108dp canvas (~66dp): comfortably inside Android safe zone.
LAUNCHER_RATIO = 66 / 108

def make_foreground(size):
    target = max(1, round(size * LAUNCHER_RATIO))
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    im = ImageOps.contain(content, (target, target), Image.Resampling.LANCZOS)
    c.alpha_composite(im, ((size-im.width)//2, (size-im.height)//2))
    return c

# Density-specific adaptive foregrounds: 108dp at each density.
for folder, size in {
    'mipmap-mdpi':108,
    'mipmap-hdpi':162,
    'mipmap-xhdpi':216,
    'mipmap-xxhdpi':324,
    'mipmap-xxxhdpi':432,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    make_foreground(size).save(d / 'ic_launcher_foreground.png', 'PNG')

# Legacy flat launcher PNGs: preserve the existing blue launcher background and use the same safe visual size.
bg = (0, 52, 153, 255)  # existing #003499
for folder, size in {
    'mipmap-mdpi':48,
    'mipmap-hdpi':72,
    'mipmap-xhdpi':96,
    'mipmap-xxhdpi':144,
    'mipmap-xxxhdpi':192,
}.items():
    d = RES / folder
    canvas = Image.new('RGBA', (size, size), bg)
    # Match the adaptive safe-zone proportion on the legacy square icon.
    target = max(1, round(size * LAUNCHER_RATIO))
    im = ImageOps.contain(content, (target, target), Image.Resampling.LANCZOS)
    canvas.alpha_composite(im, ((size-im.width)//2, (size-im.height)//2))
    canvas.save(d / 'ic_launcher.png', 'PNG')
    canvas.save(d / 'ic_launcher_round.png', 'PNG')

# --- Splash: use the 512 master but keep the artwork inside Android 12's visible mask.
src = next((p for p in [PUBLIC/'android-chrome-512x512.png', PUBLIC/'pwa-512x512.png'] if p.exists()), None)
if src is None:
    raise SystemExit('Missing 512 splash source')
splash = Image.open(src).convert('RGBA')
# Android 12 splash without icon background exposes an inner circle of 192/288 = 66.7%.
SPLASH_RATIO = 2/3

def make_splash(size):
    target = max(1, round(size * SPLASH_RATIO))
    c = Image.new('RGBA', (size, size), (0,0,0,0))
    im = ImageOps.contain(splash, (target,target), Image.Resampling.LANCZOS)
    c.alpha_composite(im, ((size-im.width)//2, (size-im.height)//2))
    return c

for folder, size in {
    'drawable':512,
    'drawable-mdpi':256,
    'drawable-hdpi':384,
    'drawable-xhdpi':512,
    'drawable-xxhdpi':768,
    'drawable-xxxhdpi':1024,
}.items():
    d = RES / folder
    d.mkdir(parents=True, exist_ok=True)
    make_splash(size).save(d / 'splash_icon.png', 'PNG')

print('ICON_SPLASH_FIX_OK launcher=66dp-safe splash=192dp-safe')
