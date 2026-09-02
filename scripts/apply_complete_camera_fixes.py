#!/usr/bin/env python3
from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text()

old_capture = "CameraPreview.capture({ quality:90, format:'jpeg' })"
new_capture = "CameraPreview.capture({ quality:80, format:'jpeg', photoQualityPrioritization:'speed' })"
if old_capture in app:
    app = app.replace(old_capture, new_capture, 1)
elif new_capture not in app:
    raise SystemExit('Capture call pattern not found')

old_gallery = "onOpenGallery={() => { void cameraService.openFieldTraceAlbum(true); }}"
new_gallery = "onOpenGallery={() => { void cameraService.openFieldTraceAlbum(false); }}"
if old_gallery in app:
    app = app.replace(old_gallery, new_gallery, 1)
elif new_gallery not in app:
    raise SystemExit('Gallery handler pattern not found')

app_path.write_text(app)
print('Complete camera UX patch applied successfully.')
