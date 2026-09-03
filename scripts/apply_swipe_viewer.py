#!/usr/bin/env python3
"""Apply in-app photo viewer with swipe to src/App.tsx."""
from pathlib import Path
import sys

path = Path("src/App.tsx")
if not path.exists():
    print("src/App.tsx missing", file=sys.stderr)
    sys.exit(1)

text = path.read_text(encoding="utf-8")

if "showPhotoViewer" in text and "openPhotoViewer" in text and 'drag="x"' in text:
    print("Swipe viewer already present; skip")
    sys.exit(0)

# 1) ChevronLeft import
old_import = """  ChevronRight,
  Smartphone,"""
new_import = """  ChevronRight,
  ChevronLeft,
  Smartphone,"""
if old_import not in text:
    print("import block not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_import, new_import, 1)

# 2) State
old_state = """  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""
new_state = """  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFullImages, setViewerFullImages] = useState<Record<string, string>>({});
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""
if old_state not in text:
    print("state block not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_state, new_state, 1)

# 3) openPhotoViewer after openGalleryGrid
old_open = """  const openGalleryGrid = async () => {
    setShowGalleryGrid(true);
    setGalleryLoading(true);
    setGalleryThumbs([]);
    try {
      const photos = await cameraService.listAlbumPhotos(60);
      const withThumbs: Array<{ uri: string; thumb: string }> = [];
      for (const ph of photos) {
        const t = await cameraService.getPhotoThumbnail(ph.uri, 200);
        if (t) withThumbs.push({ uri: ph.uri, thumb: t });
      }
      setGalleryThumbs(withThumbs);
    } catch (e) {
      console.warn('[Gallery] grid load failed', e);
    } finally {
      setGalleryLoading(false);
    }
  };"""

new_open = """  const openGalleryGrid = async () => {
    setShowGalleryGrid(true);
    setGalleryLoading(true);
    setGalleryThumbs([]);
    try {
      const photos = await cameraService.listAlbumPhotos(60);
      const withThumbs: Array<{ uri: string; thumb: string }> = [];
      for (const ph of photos) {
        const t = await cameraService.getPhotoThumbnail(ph.uri, 200);
        if (t) withThumbs.push({ uri: ph.uri, thumb: t });
      }
      setGalleryThumbs(withThumbs);
    } catch (e) {
      console.warn('[Gallery] grid load failed', e);
    } finally {
      setGalleryLoading(false);
    }
  };

  const openPhotoViewer = (index: number) => {
    if (!galleryThumbs.length) return;
    const safe = Math.max(0, Math.min(index, galleryThumbs.length - 1));
    setViewerIndex(safe);
    setShowPhotoViewer(true);
  };

  // Cargar imagen de alta calidad al cambiar de foto en el visor in-app
  useEffect(() => {
    if (!showPhotoViewer || !galleryThumbs.length) return;
    let cancelled = false;
    const loadAround = async () => {
      const indices = [viewerIndex, viewerIndex - 1, viewerIndex + 1].filter(
        (i) => i >= 0 && i < galleryThumbs.length
      );
      for (const i of indices) {
        const uri = galleryThumbs[i].uri;
        if (viewerFullImages[uri]) continue;
        try {
          const full = await cameraService.getPhotoThumbnail(uri, 1600);
          if (!cancelled && full) {
            setViewerFullImages((prev) => (prev[uri] ? prev : { ...prev, [uri]: full }));
          }
        } catch (e) {
          console.warn('[Viewer] full image load failed', e);
        }
      }
    };
    void loadAround();
    return () => { cancelled = true; };
  }, [showPhotoViewer, viewerIndex, galleryThumbs]);"""

if old_open not in text:
    print("openGalleryGrid block not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_open, new_open, 1)

# 4) map index + onClick
if "galleryThumbs.map((item) => (" in text:
    text = text.replace("galleryThumbs.map((item) => (", "galleryThumbs.map((item, idx) => (", 1)
elif "galleryThumbs.map((item, idx) => (" not in text:
    print("gallery map not found", file=sys.stderr)
    sys.exit(1)

old_click = """                    <button
                      key={item.uri}
                      type=\"button\"
                      className=\"aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80\"
                      onClick={() => {
                        const native = (window as any).FieldTraceNative;
                        if (native?.openUri) {
                          native.openUri(item.uri);
                        } else {
                          void cameraService.openFieldTraceAlbum(true);
                        }
                      }}
                    >
                      <img src={item.thumb} alt=\"\" className=\"w-full h-full object-cover\" />
                    </button>"""

new_click = """                    <button
                      key={item.uri}
                      type=\"button\"
                      className=\"aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80\"
                      onClick={() => openPhotoViewer(idx)}
                    >
                      <img src={item.thumb} alt=\"\" className=\"w-full h-full object-cover\" />
                    </button>"""

if old_click not in text:
    print("grid onClick block not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_click, new_click, 1)

# 5) Hint
old_hint = """            <p className=\"text-center text-[9px] text-white/30 py-2 shrink-0\">Toca una foto para abrir · desliza en el visor del sistema</p>"""
new_hint = """            <p className=\"text-center text-[9px] text-white/30 py-2 shrink-0\">Toca una foto para abrir · desliza para ver otras</p>"""
if old_hint in text:
    text = text.replace(old_hint, new_hint, 1)

# 6) Viewer UI before showQuickConfig
marker = """      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

viewer_block = """      <AnimatePresence>
        {showPhotoViewer && galleryThumbs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className=\"fixed inset-0 z-[120] bg-black flex flex-col\"
          >
            <div className=\"flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0\">
              <button
                type=\"button\"
                onClick={() => setShowPhotoViewer(false)}
                className=\"w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white\"
              >
                <X className=\"w-5 h-5\" />
              </button>
              <p className=\"text-xs font-black uppercase tracking-widest text-white/80\">
                {viewerIndex + 1} / {galleryThumbs.length}
              </p>
              <button
                type=\"button\"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setShowGalleryGrid(true);
                }}
                className=\"text-[10px] font-black uppercase text-blue-400 px-2 py-2\"
              >
                Cuadrícula
              </button>
            </div>

            <div className=\"flex-1 relative overflow-hidden flex items-center justify-center\">
              <motion.div
                key={galleryThumbs[viewerIndex]?.uri || viewerIndex}
                className=\"w-full h-full flex items-center justify-center touch-pan-y\"
                drag=\"x\"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -80 && viewerIndex < galleryThumbs.length - 1) {
                    setViewerIndex((i) => Math.min(galleryThumbs.length - 1, i + 1));
                  } else if (info.offset.x > 80 && viewerIndex > 0) {
                    setViewerIndex((i) => Math.max(0, i - 1));
                  }
                }}
              >
                <img
                  src={
                    viewerFullImages[galleryThumbs[viewerIndex].uri] ||
                    galleryThumbs[viewerIndex].thumb
                  }
                  alt={`Foto ${viewerIndex + 1}`}
                  className=\"max-w-full max-h-full object-contain select-none pointer-events-none\"
                  draggable={false}
                />
              </motion.div>

              {viewerIndex > 0 && (
                <button
                  type=\"button\"
                  onClick={() => setViewerIndex((i) => Math.max(0, i - 1))}
                  className=\"absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:scale-95\"
                >
                  <ChevronLeft className=\"w-6 h-6\" />
                </button>
              )}
              {viewerIndex < galleryThumbs.length - 1 && (
                <button
                  type=\"button\"
                  onClick={() => setViewerIndex((i) => Math.min(galleryThumbs.length - 1, i + 1))}
                  className=\"absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:scale-95\"
                >
                  <ChevronRight className=\"w-6 h-6\" />
                </button>
              )}
            </div>

            <p className=\"text-center text-[9px] text-white/35 py-3 shrink-0\">
              Desliza izquierda / derecha para ver otras fotos
            </p>
          </motion.div>
        )}
      </AnimatePresence>

"""

if marker not in text:
    print("quick config marker not found", file=sys.stderr)
    sys.exit(1)
if "showPhotoViewer && galleryThumbs.length > 0" not in text:
    text = text.replace(marker, viewer_block + marker, 1)

path.write_text(text, encoding="utf-8")
print("OK swipe viewer applied", path.stat().st_size)
print("has showPhotoViewer", "showPhotoViewer" in text)
print("has openPhotoViewer", "openPhotoViewer" in text)
print("has drag=x", 'drag="x"' in text)
