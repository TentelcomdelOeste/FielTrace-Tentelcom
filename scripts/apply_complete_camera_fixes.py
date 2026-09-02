#!/usr/bin/env python3
from pathlib import Path

# Keep the existing UX fixes and remove the two largest Android capture bottlenecks:
# 1) CameraPreview returns a file path instead of a huge base64 bridge payload.
# 2) React's processing state is released as soon as the native capture/file conversion
#    finishes, while a ref prevents overlapping captures during the native operation.

app_path = Path('src/App.tsx')
app = app_path.read_text()

old_import = "import { CameraPreview } from '@capgo/camera-preview';"
new_import = "import { CameraPreview, getBase64FromFilePath } from '@capgo/camera-preview';"
if old_import in app and new_import not in app:
    app = app.replace(old_import, new_import, 1)
elif new_import not in app:
    raise SystemExit('CameraPreview import pattern not found')

old_state = "  const [isProcessing, setIsProcessing] = useState(false);"
new_state = "  const [isProcessing, setIsProcessing] = useState(false);\n  const captureBusyRef = useRef(false);"
if old_state in app and 'captureBusyRef' not in app:
    app = app.replace(old_state, new_state, 1)
elif 'captureBusyRef' not in app:
    raise SystemExit('isProcessing state pattern not found')

old_guard = "    if (!selectedProject || isProcessing) return;\n    setIsProcessing(true);"
new_guard = "    if (!selectedProject || isProcessing || captureBusyRef.current) return;\n    captureBusyRef.current = true;\n    setIsProcessing(true);"
if old_guard in app:
    app = app.replace(old_guard, new_guard, 1)
elif new_guard not in app:
    raise SystemExit('capture guard pattern not found')

old_capture = "      const captureResult = await CameraPreview.capture({ quality:80, format:'jpeg', photoQualityPrioritization:'speed' });\n      const capturedValue = captureResult?.value;\n      const rawImage = capturedValue ? (capturedValue.startsWith('data:') ? capturedValue : `data:image/jpeg;base64,${capturedValue}`) : null;\n      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara nativa');"
new_capture = "      const captureResult = await CameraPreview.capture({ quality:80, format:'jpeg', photoQualityPrioritization:'speed' });\n      const capturedValue = captureResult?.value;\n      let rawImage: string | null = null;\n      if (capturedValue) {\n        rawImage = capturedValue.startsWith('data:')\n          ? capturedValue\n          : await getBase64FromFilePath(capturedValue);\n        if (!capturedValue.startsWith('data:')) {\n          void CameraPreview.deleteFile({ path: capturedValue }).catch((error) =>\n            console.warn('[Camera] temp capture cleanup:', error)\n          );\n        }\n      }\n      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara nativa');"
if old_capture in app:
    app = app.replace(old_capture, new_capture, 1)
elif new_capture not in app:
    raise SystemExit('capture payload pattern not found')

old_release = "      setIsProcessing(false);\n\n      const { gps, locationData } = locationService.getCurrentState();"
new_release = "      setIsProcessing(false);\n      captureBusyRef.current = false;\n\n      const { gps, locationData } = locationService.getCurrentState();"
if old_release in app:
    app = app.replace(old_release, new_release, 1)
elif new_release not in app:
    raise SystemExit('capture release pattern not found')

old_catch = "    } catch (e: any) {\n      console.error('Batch capture error', e);\n      setIsProcessing(false);\n    }"
new_catch = "    } catch (e: any) {\n      console.error('Batch capture error', e);\n      captureBusyRef.current = false;\n      setIsProcessing(false);\n    }"
if old_catch in app:
    app = app.replace(old_catch, new_catch, 1)
elif new_catch not in app:
    raise SystemExit('capture catch pattern not found')

app_path.write_text(app)

camera_path = Path('src/components/CameraScreen.tsx')
camera = camera_path.read_text()
camera = camera.replace(
    "storeToFile: false,",
    "storeToFile: true,",
    1,
)
camera = camera.replace(
    "import { useEffect, useRef, useState } from 'react';",
    "import { useEffect, useRef, useState, type PointerEvent } from 'react';",
    1,
)
camera = camera.replace('React.PointerEvent<HTMLButtonElement>', 'PointerEvent<HTMLButtonElement>')
camera_path.write_text(camera)

print('Complete camera UX patch applied successfully.')
