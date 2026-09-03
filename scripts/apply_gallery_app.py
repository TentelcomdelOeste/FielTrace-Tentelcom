#!/usr/bin/env python3
"""Apply gallery UX improvements to src/App.tsx without touching GPS/shutter."""
from pathlib import Path
import sys

p = Path("src/App.tsx")
text = p.read_text(encoding="utf-8")
orig = text

# 1) state
old_state = """  const [lastImage, setLastImage] = useState<string | null>(null);
  const [showLastImage, setShowLastImage] = useState(false);
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""

new_state = """  const [lastImage, setLastImage] = useState<string | null>(null);
  const [showLastImage, setShowLastImage] = useState(false);
  const [showGalleryGrid, setShowGalleryGrid] = useState(false);
  const [galleryThumbs, setGalleryThumbs] = useState<Array<{ uri: string; thumb: string }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""

if "showGalleryGrid" not in text:
    if old_state not in text:
        print("FAIL: state block not found")
        sys.exit(1)
    text = text.replace(old_state, new_state, 1)
    print("OK: state")
else:
    print("SKIP: state already present")

# 2) load thumb on camera enter
marker = """  useEffect(() => {
    document.documentElement.classList.toggle('native-camera-active', currentStep === 'camera');
    return () => document.documentElement.classList.remove('native-camera-active');
  }, [currentStep]);"""

insert = """  useEffect(() => {
    document.documentElement.classList.toggle('native-camera-active', currentStep === 'camera');
    return () => document.documentElement.classList.remove('native-camera-active');
  }, [currentStep]);

  // Load last Field Trace album thumbnail when entering camera (survives app restart)
  useEffect(() => {
    if (currentStep !== 'camera') return;
    let cancelled = false;
    (async () => {
      try {
        const thumb = await cameraService.getLastThumbnail(256);
        if (!cancelled && thumb) setLastImage(thumb);
      } catch (e) {
        console.warn('[Gallery] load last thumb:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentStep]);"""

if "getLastThumbnail" not in text:
    if marker not in text:
        print("FAIL: camera-active effect not found")
        sys.exit(1)
    text = text.replace(marker, insert, 1)
    print("OK: thumb effect")
else:
    print("SKIP: thumb effect")

# 3) openGalleryGrid helper
old_share = """  const shareNative = async () => {
    if (!lastImage || !selectedProject) return;"""

new_share = """  const openGalleryGrid = async () => {
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

  const shareNative = async () => {
    if (!lastImage || !selectedProject) return;"""

if "openGalleryGrid" not in text:
    if old_share not in text:
        print("FAIL: shareNative not found")
        sys.exit(1)
    text = text.replace(old_share, new_share, 1)
    print("OK: openGalleryGrid")
else:
    print("SKIP: openGalleryGrid")

# 4) gallery button
old_btn = """            <button 
              type=\"button\"
              onClick={() => {
                void cameraService.openFieldTraceAlbum(true);
              }} 
              className=\"w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95\"
            >
              {lastImage ? (
                <img src={lastImage} className=\"w-full h-full object-cover\" alt=\"Ultima foto\" />
              ) : (
                <History className=\"w-7 h-7 opacity-40\"/>
              )}
            </button>"""

new_btn = """            <button 
              type=\"button\"
              onClick={() => {
                void (async () => {
                  const photos = await cameraService.listAlbumPhotos(1);
                  if (photos.length > 0) {
                    await openGalleryGrid();
                  } else if (lastImage) {
                    setShowLastImage(true);
                  } else {
                    void cameraService.openFieldTraceAlbum(true);
                  }
                })();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                void openGalleryGrid();
              }}
              className=\"w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95\"
            >
              {lastImage ? (
                <img src={lastImage} className=\"w-full h-full object-cover\" alt=\"Ultima foto\" />
              ) : (
                <History className=\"w-7 h-7 opacity-40\"/>
              )}
            </button>"""

if "listAlbumPhotos(1)" not in text:
    if old_btn not in text:
        print("FAIL: gallery button not found")
        sys.exit(1)
    text = text.replace(old_btn, new_btn, 1)
    print("OK: gallery button")
else:
    print("SKIP: gallery button")

# 5) grid modal
old_modal = """      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

grid_modal = """      <AnimatePresence>
        {showGalleryGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className=\"fixed inset-0 z-[100] bg-black flex flex-col\"
          >
            <div className=\"flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0\">
              <button
                type=\"button\"
                onClick={() => setShowGalleryGrid(false)}
                className=\"w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white\"
              >
                <ArrowLeft className=\"w-5 h-5\" />
              </button>
              <h2 className=\"text-sm font-black uppercase tracking-tight text-white\">Field Trace</h2>
              <button
                type=\"button\"
                onClick={() => {
                  setShowGalleryGrid(false);
                  void cameraService.openFieldTraceAlbum(true);
                }}
                className=\"text-[10px] font-black uppercase text-blue-400 px-2 py-2\"
              >
                Galeria
              </button>
            </div>
            <div className=\"flex-1 overflow-y-auto p-2\">
              {galleryLoading && (
                <p className=\"text-center text-white/50 text-xs font-bold uppercase py-16 tracking-widest\">Cargando fotos...</p>
              )}
              {!galleryLoading && galleryThumbs.length === 0 && (
                <div className=\"py-16 text-center space-y-3\">
                  <History className=\"w-12 h-12 text-white/20 mx-auto\" />
                  <p className=\"text-[11px] text-white/40 font-black uppercase tracking-widest\">Sin fotos en el album<br/>Field Trace</p>
                </div>
              )}
              {!galleryLoading && galleryThumbs.length > 0 && (
                <div className=\"grid grid-cols-3 gap-1.5\">
                  {galleryThumbs.map((item) => (
                    <button
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
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className=\"text-center text-[9px] text-white/30 py-2 shrink-0\">Toca una foto para abrir · desliza en el visor del sistema</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

if "showGalleryGrid &&" not in text:
    if old_modal not in text:
        print("FAIL: showQuickConfig block not found")
        sys.exit(1)
    text = text.replace(old_modal, grid_modal, 1)
    print("OK: grid modal")
else:
    print("SKIP: grid modal")

# Safety: GPS and shutter must remain
assert "SIN GPS (GPS DESACTIVADO)" in text
assert "capturingRef.current = false" in text
assert "CameraPreview.capture" in text

if text == orig:
    print("NO CHANGES needed")
else:
    p.write_text(text, encoding="utf-8")
    print("WRITTEN", p, "bytes", len(text))
