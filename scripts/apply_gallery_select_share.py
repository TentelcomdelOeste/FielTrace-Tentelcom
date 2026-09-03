#!/usr/bin/env python3
"""Add multi-select, delete (confirm) and share to gallery grid + photo viewer."""
from pathlib import Path
import sys

path = Path("src/App.tsx")
if not path.exists():
    print("src/App.tsx missing", file=sys.stderr)
    sys.exit(1)

text = path.read_text(encoding="utf-8")

if "gallerySelectMode" in text and "shareSelectedGallery" in text and "deleteSelectedGallery" in text:
    print("Gallery select/share/delete already present; skip")
    sys.exit(0)

# --- 1) State after viewerFullImages ---
old_state = """  const [viewerFullImages, setViewerFullImages] = useState<Record<string, string>>({});
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""
new_state = """  const [viewerFullImages, setViewerFullImages] = useState<Record<string, string>>({});
  const [gallerySelectMode, setGallerySelectMode] = useState(false);
  const [selectedGalleryUris, setSelectedGalleryUris] = useState<string[]>([]);
  const [confirmGalleryDelete, setConfirmGalleryDelete] = useState<string[] | null>(null);
  const [showEvidenceList, setShowEvidenceList] = useState(false);"""
if old_state not in text:
    print("state block not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_state, new_state, 1)

# --- 2) Helpers after openPhotoViewer / useEffect block ---
old_after = """  }, [showPhotoViewer, viewerIndex, galleryThumbs]);

  const shareNative = async () => {"""

new_helpers = """  }, [showPhotoViewer, viewerIndex, galleryThumbs]);

  const toggleGallerySelect = (uri: string) => {
    setSelectedGalleryUris((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]
    );
  };

  const clearGallerySelection = () => {
    setSelectedGalleryUris([]);
    setGallerySelectMode(false);
  };

  const shareSelectedGallery = (uris: string[]) => {
    if (!uris.length) return;
    try {
      const native = (window as any).FieldTraceNative;
      if (native && typeof native.shareUris === 'function') {
        native.shareUris(JSON.stringify(uris));
        return;
      }
      console.warn('[Gallery] shareUris not available');
    } catch (e) {
      console.warn('[Gallery] share failed', e);
    }
  };

  const deleteSelectedGallery = async (uris: string[]) => {
    if (!uris.length) return;
    try {
      const native = (window as any).FieldTraceNative;
      let deleted = 0;
      if (native && typeof native.deleteUris === 'function') {
        deleted = Number(native.deleteUris(JSON.stringify(uris)) || 0);
      }
      const uriSet = new Set(uris);
      setGalleryThumbs((prev) => prev.filter((p) => !uriSet.has(p.uri)));
      setSelectedGalleryUris([]);
      setGallerySelectMode(false);
      setConfirmGalleryDelete(null);
      // Ajustar visor si estaba abierto
      if (showPhotoViewer) {
        const remaining = galleryThumbs.filter((p) => !uriSet.has(p.uri));
        if (!remaining.length) {
          setShowPhotoViewer(false);
        } else {
          setViewerIndex((i) => Math.min(i, remaining.length - 1));
        }
      }
      // Actualizar miniatura de cámara
      try {
        const thumb = await cameraService.getLastThumbnail(256);
        setLastImage(thumb);
      } catch {}
      console.log('[Gallery] deleted', deleted, 'of', uris.length);
    } catch (e) {
      console.warn('[Gallery] delete failed', e);
    }
  };

  const shareNative = async () => {"""

if old_after not in text:
    print("helper insertion point not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_after, new_helpers, 1)

grid_start_marker = """        {showGalleryGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >"""

if grid_start_marker not in text:
    print("grid panel start not found", file=sys.stderr)
    sys.exit(1)

viewer_marker = """        {showPhotoViewer && galleryThumbs.length > 0 && ("""
idx_grid = text.find(grid_start_marker)
idx_viewer = text.find(viewer_marker)
if idx_grid < 0 or idx_viewer < 0 or idx_viewer <= idx_grid:
    print("grid/viewer markers invalid", file=sys.stderr)
    sys.exit(1)

ap_grid_start = text.rfind("<AnimatePresence>", 0, idx_grid)
if ap_grid_start < 0:
    print("AnimatePresence for grid not found", file=sys.stderr)
    sys.exit(1)

ap_grid_end = text.rfind("</AnimatePresence>", ap_grid_start, idx_viewer)
if ap_grid_end < 0:
    print("grid AnimatePresence end not found", file=sys.stderr)
    sys.exit(1)
ap_grid_end += len("</AnimatePresence>")

new_grid_block = r"""      <AnimatePresence>
        {showGalleryGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (gallerySelectMode) {
                    clearGallerySelection();
                  } else {
                    setShowGalleryGrid(false);
                  }
                }}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0"
              >
                {gallerySelectMode ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>
              <h2 className="text-sm font-black uppercase tracking-tight text-white truncate">
                {gallerySelectMode
                  ? (selectedGalleryUris.length ? `${selectedGalleryUris.length} seleccionada(s)` : 'Seleccionar')
                  : 'Field Trace'}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                {!gallerySelectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setGallerySelectMode(true);
                        setSelectedGalleryUris([]);
                      }}
                      className="text-[10px] font-black uppercase text-white/80 px-2 py-2"
                    >
                      Seleccionar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGalleryGrid(false);
                        void cameraService.openFieldTraceAlbum(true);
                      }}
                      className="text-[10px] font-black uppercase text-blue-400 px-2 py-2"
                    >
                      Galeria
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedGalleryUris.length === galleryThumbs.length) {
                        setSelectedGalleryUris([]);
                      } else {
                        setSelectedGalleryUris(galleryThumbs.map((p) => p.uri));
                      }
                    }}
                    className="text-[10px] font-black uppercase text-blue-400 px-2 py-2"
                  >
                    {selectedGalleryUris.length === galleryThumbs.length ? 'Ninguna' : 'Todas'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {galleryLoading && (
                <p className="text-center text-white/50 text-xs font-bold uppercase py-16 tracking-widest">Cargando fotos...</p>
              )}
              {!galleryLoading && galleryThumbs.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <History className="w-12 h-12 text-white/20 mx-auto" />
                  <p className="text-[11px] text-white/40 font-black uppercase tracking-widest">Sin fotos en el album<br/>Field Trace</p>
                </div>
              )}
              {!galleryLoading && galleryThumbs.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {galleryThumbs.map((item, idx) => {
                    const selected = selectedGalleryUris.includes(item.uri);
                    return (
                      <button
                        key={item.uri}
                        type="button"
                        className={`relative aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80 ${selected ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => {
                          if (gallerySelectMode) {
                            toggleGallerySelect(item.uri);
                          } else {
                            openPhotoViewer(idx);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!gallerySelectMode) setGallerySelectMode(true);
                          toggleGallerySelect(item.uri);
                        }}
                      >
                        <img src={item.thumb} alt="" className="w-full h-full object-cover" />
                        {gallerySelectMode && (
                          <span
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              selected
                                ? 'bg-blue-500 border-blue-400 text-white'
                                : 'bg-black/40 border-white/50'
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-4 h-4" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {gallerySelectMode && selectedGalleryUris.length > 0 && (
              <div className="shrink-0 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4 bg-black/90">
                <button
                  type="button"
                  onClick={() => shareSelectedGallery(selectedGalleryUris)}
                  className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmGalleryDelete([...selectedGalleryUris])}
                  className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            )}
            {!gallerySelectMode && (
              <p className="text-center text-[9px] text-white/30 py-2 shrink-0">
                Toca una foto para abrir · mantén pulsado o &quot;Seleccionar&quot; para elegir varias
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
"""

text = text[:ap_grid_start] + new_grid_block + text[ap_grid_end:]

old_viewer_footer = """            <p className="text-center text-[9px] text-white/35 py-3 shrink-0">
              Desliza izquierda / derecha para ver otras fotos
            </p>
          </motion.div>
        )}
      </AnimatePresence>"""

new_viewer_footer = """            <div className="shrink-0 border-t border-white/10 px-4 py-3 flex flex-col gap-2 bg-black/90">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) shareSelectedGallery([uri]);
                  }}
                  className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) setConfirmGalleryDelete([uri]);
                  }}
                  className="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
              <p className="text-center text-[9px] text-white/35">
                Desliza izquierda / derecha para ver otras fotos
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>"""

if old_viewer_footer not in text:
    print("viewer footer not found", file=sys.stderr)
    sys.exit(1)
text = text.replace(old_viewer_footer, new_viewer_footer, 1)

confirm_marker = """      <AnimatePresence>
        {showQuickConfig && selectedProject && ("""

confirm_modal = """      <AnimatePresence>
        {confirmGalleryDelete && confirmGalleryDelete.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/80 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4"
            >
              <h3 className="text-base font-black uppercase tracking-tight text-white">
                Eliminar {confirmGalleryDelete.length === 1 ? 'foto' : `${confirmGalleryDelete.length} fotos`}
              </h3>
              <p className="text-sm text-white/60">
                {confirmGalleryDelete.length === 1
                  ? 'Esta foto se eliminará del álbum Field Trace. ¿Continuar?'
                  : `Se eliminarán ${confirmGalleryDelete.length} fotos del álbum Field Trace. ¿Continuar?`}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmGalleryDelete(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteSelectedGallery(confirmGalleryDelete);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

"""

if confirm_marker not in text:
    print("quick config marker not found for confirm modal", file=sys.stderr)
    sys.exit(1)
if "confirmGalleryDelete && confirmGalleryDelete.length" not in text:
    text = text.replace(confirm_marker, confirm_modal + confirm_marker, 1)

old_open = """  const openGalleryGrid = async () => {
    setShowGalleryGrid(true);
    setGalleryLoading(true);
    setGalleryThumbs([]);
    try {"""
new_open = """  const openGalleryGrid = async () => {
    setShowGalleryGrid(true);
    setGalleryLoading(true);
    setGalleryThumbs([]);
    setGallerySelectMode(false);
    setSelectedGalleryUris([]);
    setConfirmGalleryDelete(null);
    try {"""
if old_open in text:
    text = text.replace(old_open, new_open, 1)

path.write_text(text, encoding="utf-8")
print("OK gallery select/share/delete applied", path.stat().st_size)
for key in ["gallerySelectMode", "shareSelectedGallery", "deleteSelectedGallery", "confirmGalleryDelete", "Seleccionar", "Compartir"]:
    print(key, key in text)
