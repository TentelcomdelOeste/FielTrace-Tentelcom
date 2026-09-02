#!/usr/bin/env python3
"""Apply gallery / zoom / flash UX patches to src/App.tsx (idempotent)."""
from pathlib import Path
import re
import sys

p = Path('src/App.tsx')
if not p.exists():
    print('App.tsx missing')
    sys.exit(1)
src = p.read_text()
orig = src

old_div = (
    "                {/* Real-time Camera Bridge */}\n"
    "                <div className=\"relative flex-1 bg-gray-950 overflow-hidden\">\n"
    "                  <Webcam"
)
new_div = (
    "                {/* Real-time Camera Bridge */}\n"
    "                <div\n"
    "                  className=\"relative flex-1 bg-gray-950 overflow-hidden touch-none\"\n"
    "                  onTouchStart={onCameraTouchStart}\n"
    "                  onTouchMove={onCameraTouchMove}\n"
    "                  onTouchEnd={onCameraTouchEnd}\n"
    "                  onTouchCancel={onCameraTouchEnd}\n"
    "                >\n"
    "                  <Webcam"
)
if old_div in src:
    src = src.replace(old_div, new_div, 1)
    print('wired pinch handlers')
elif 'onTouchStart={onCameraTouchStart}' in src:
    print('pinch already wired')
else:
    print('WARN: camera div pattern not found')

old_thumb = (
    "                    onClick={() => {\n"
    "                      if (lastImage) setShowLastImage(true);\n"
    "                      void cameraService.openFieldTraceAlbum();\n"
    "                    }}"
)
new_thumb = (
    "                    onClick={() => {\n"
    "                      void cameraService.openFieldTraceAlbum(true);\n"
    "                    }}"
)
if old_thumb in src:
    src = src.replace(old_thumb, new_thumb, 1)
    print('thumbnail opens native gallery only')
elif 'openFieldTraceAlbum(true)' in src:
    print('thumbnail already native-only')
else:
    print('WARN: thumbnail handler pattern not found')

pat = re.compile(
    r"\n\s*<AnimatePresence>\s*\{showLastImage && lastImage && \([\s\S]*?"
    r"Abrir galeria / album Field Trace\s*</button>\s*</div>\s*</motion\.div>\s*"
    r"</motion\.div>\s*\)\}\s*</AnimatePresence>",
    re.M,
)
src2, n = pat.subn("\n", src, count=1)
if n:
    src = src2
    print('removed showLastImage modal')
elif 'showLastImage && lastImage' not in src:
    print('modal already removed')
else:
    print('WARN: modal still present, trying slice removal')
    start = src.find('{showLastImage && lastImage && (')
    if start != -1:
        ap_start = src.rfind('<AnimatePresence>', 0, start)
        mpos = src.find('Abrir galeria / album Field Trace', start)
        if ap_start != -1 and mpos != -1:
            ap_end = src.find('</AnimatePresence>', mpos) + len('</AnimatePresence>')
            src = src[:ap_start] + src[ap_end:]
            print('removed modal by slice')

old_apply = (
    "  const applyTorch = async (on: boolean) => {\n"
    "    try {\n"
    "      const video = webcamRef.current?.video as HTMLVideoElement | undefined;\n"
    "      const stream = video?.srcObject as MediaStream | null;\n"
    "      const track = stream?.getVideoTracks?.()[0];\n"
    "      if (!track) return;\n"
    "      const caps = track.getCapabilities?.() as any;\n"
    "      if (caps && 'torch' in caps) {\n"
    "        await track.applyConstraints({ advanced: [{ torch: on } as any] });\n"
    "      }\n"
    "    } catch (e) {\n"
    "      console.warn('Torch not supported', e);\n"
    "    }\n"
    "  };"
)
new_apply = (
    "  const [torchSupported, setTorchSupported] = useState<boolean | null>(null);\n\n"
    "  const applyTorch = async (on: boolean) => {\n"
    "    try {\n"
    "      const video = webcamRef.current?.video as HTMLVideoElement | undefined;\n"
    "      const stream = video?.srcObject as MediaStream | null;\n"
    "      const track = stream?.getVideoTracks?.()[0];\n"
    "      if (!track) return false;\n"
    "      const caps = track.getCapabilities?.() as any;\n"
    "      if (caps && 'torch' in caps) {\n"
    "        setTorchSupported(true);\n"
    "        await track.applyConstraints({ advanced: [{ torch: on } as any] });\n"
    "        return true;\n"
    "      }\n"
    "      setTorchSupported(false);\n"
    "      return false;\n"
    "    } catch (e) {\n"
    "      console.warn('Torch not supported', e);\n"
    "      setTorchSupported(false);\n"
    "      return false;\n"
    "    }\n"
    "  };"
)
if old_apply in src:
    src = src.replace(old_apply, new_apply, 1)
    print('applyTorch improved')
elif 'torchSupported' in src:
    print('torchSupported already present')
else:
    print('WARN: applyTorch pattern not found')

needle = (
    "                      setTimeout(forcePlay, 100);\n"
    "                      setTimeout(forcePlay, 400);\n"
    "                    }}"
)
repl = (
    "                      setTimeout(forcePlay, 100);\n"
    "                      setTimeout(forcePlay, 400);\n"
    "                      setTimeout(() => { void applyTorch(flashMode === 'on'); }, 200);\n"
    "                    }}"
)
if "void applyTorch(flashMode ===" not in src and needle in src:
    src = src.replace(needle, repl, 1)
    print('re-apply torch onUserMedia')
else:
    print('onUserMedia torch already or pattern missing')

src = src.replace(
    "  const [showLastImage, setShowLastImage] = useState(false);\n",
    "  // showLastImage modal removed — gallery opens natively\n",
)

if src == orig:
    print('No changes written')
else:
    p.write_text(src)
    print('App.tsx patched, new size', len(src))
