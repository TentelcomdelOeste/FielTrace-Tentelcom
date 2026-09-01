#!/usr/bin/env python3
"""Apply compact evidence list, view/edit/delete, and native gallery open."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'src' / 'App.tsx'
CAM = ROOT / 'src' / 'services' / 'cameraService.ts'
STO = ROOT / 'src' / 'services' / 'storageService.ts'

def patch_storage():
    text = STO.read_text()
    if 'async deleteEvidence' in text:
        print('storageService already has deleteEvidence')
        return
    new_methods = '''
  async updateEvidence(id: number, updates: Partial<Evidence>): Promise<void> {
    const existing = await manager.get<Evidence>(STORE_EVIDENCES, id);
    if (!existing) throw new Error('Evidence not found');
    const updated: Evidence = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
      syncStatus: 'pending'
    };
    await manager.put(STORE_EVIDENCES, updated);
    if (navigator.onLine) {
      firebaseService.syncEvidenceToCloud(updated).then(async (success) => {
        if (success) {
          updated.syncStatus = 'synced';
          updated.lastSyncedAt = new Date();
          await manager.put(STORE_EVIDENCES, updated);
        }
      }).catch(() => {});
    }
  },

  async deleteEvidence(id: number): Promise<void> {
    await manager.delete(STORE_EVIDENCES, id);
  },

'''
    text = text.replace(
        '  async saveTemplate(template: Template): Promise<number> {',
        new_methods + '  async saveTemplate(template: Template): Promise<number> {'
    )
    STO.write_text(text)
    print('storageService patched')

def patch_camera():
    text = CAM.read_text()
    if 'openFieldTraceAlbum' in text:
        print('cameraService already has openFieldTraceAlbum')
        return
    open_album = '''
  async openFieldTraceAlbum(): Promise<void> {
    try {
      if (Capacitor.getPlatform() === 'android') {
        const intents = [
          'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_GALLERY;end',
          'intent:#Intent;action=android.intent.action.VIEW;type=image/*;end',
          'content://media/external/images/media'
        ];
        for (const url of intents) {
          try {
            window.location.href = url;
            return;
          } catch (_) {}
        }
        window.open('content://media/external/images/media', '_system');
      } else {
        window.open('photos://', '_blank');
      }
    } catch (e) {
      console.warn('[Gallery] No se pudo abrir la galeria nativa:', e);
    }
  },
'''
    marker = '    return album.identifier;\n  },\n};'
    if marker not in text:
        raise SystemExit('cameraService marker not found')
    text = text.replace(marker, '    return album.identifier;\n  },\n' + open_album + '};')
    CAM.write_text(text)
    print('cameraService patched')

def patch_app():
    text = APP.read_text()
    if not text.strip():
        raise SystemExit('App.tsx is empty')

    # 1. Pencil import
    if 'Pencil' not in text.split("from 'lucide-react'")[0]:
        text = text.replace(
            "  Unlock\n} from 'lucide-react';",
            "  Unlock,\n  Pencil\n} from 'lucide-react';"
        )
        print('Added Pencil import')

    # 2. State
    old_state = """  const [showEvidenceList, setShowEvidenceList] = useState(false);
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field', id?: number, index?: number } | null>(null);"""
    new_state = """  const [showEvidenceList, setShowEvidenceList] = useState(false);
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<any | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<any | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSave, setPendingEditSave] = useState<any | null>(null);"""
    if 'viewingEvidence' not in text and old_state in text:
        text = text.replace(old_state, new_state)
        print('Added evidence state')

    # 3. History grid -> compact list
    # Find the grid block by unique markers
    start = text.find('<div className="grid grid-cols-2 gap-4 pb-20">')
    if start == -1:
        start = text.find('grid grid-cols-2 gap-4 pb-20')
    if start != -1 and 'setViewingEvidence' not in text[start:start+2500]:
        # find matching end of this block - look for next major section
        end_marker = "{/* CAMERA VIEW (OPERATIONAL FOCUS) */}"
        end = text.find(end_marker, start)
        if end == -1:
            raise SystemExit('Could not find camera view marker')
        # go back to close the history motion.div's list container - find last </div> before camera
        # Replace from grid start to just before CAMERA VIEW, keeping structure
        # Find the parent closing - actually replace from grid div through its close before </motion.div> of history
        chunk = text[start:end]
        # Find the last closing of the grid section inside chunk
        # Simpler: replace the whole evidences map section
        import re
        pattern = r'<div className="grid grid-cols-2 gap-4 pb-20">[\s\S]*?</div>\s*</motion\.div>\s*\{\/\* CAMERA VIEW'
        new_list = '''<div className="space-y-2 pb-24">
                  {evidences.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><CameraIcon className="w-8 h-8 text-gray-200" /></div>
                       <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">No hay registros<br/>tecnicos capturados</p>
                    </div>
                  ) : (
                    reversedEvidences.map((ev) => {
                      const tech = ev.baseFields?.tecnico || '-';
                      const gpsShort = ev.gpsLabel || (ev.latitude ? `${Number(ev.latitude).toFixed(5)}, ${Number(ev.longitude).toFixed(5)}` : 'SIN GPS');
                      const mainField = (ev.customFields || []).find((f: any) => f.active !== false && f.showInPhoto && (f.value || f.name));
                      const fieldText = mainField ? (mainField.value ? `${mainField.name}: ${mainField.value}` : mainField.name) : '';
                      return (
                      <div
                        key={ev.id || ev.uuid}
                        className="bg-white border border-gray-100 rounded-2xl px-3.5 py-3 shadow-sm flex items-center gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_6px_#22c55e]"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12px] font-black text-gray-950 tracking-tight">{ev.fecha} {ev.hora || ''}</p>
                            <span className="text-[10px] font-bold text-gray-500 uppercase truncate">{tech}</span>
                          </div>
                          <p className="text-[10px] font-mono text-green-700 truncate mt-0.5">{gpsShort}</p>
                          {fieldText && <p className="text-[9px] text-gray-400 uppercase truncate">{fieldText}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setViewingEvidence(ev)} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 active:scale-95" title="Ver">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setEditingEvidence({ ...ev, customFields: (ev.customFields || []).map((f: any) => ({ ...f })) })} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 active:scale-95" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete({ type: 'evidence', id: ev.id })} className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* CAMERA VIEW'''
        # Fix accidental space in className
        new_list = new_list.replace('tracking-tight\ {', 'tracking-tight">{')
        new_list = new_list.replace('truncate\ {', 'truncate">{')
        new_list = new_list.replace('mt-0.5\ {', 'mt-0.5">{')
        new_list = new_list.replace('truncate\ {', 'truncate">{')
        m = re.search(pattern, text)
        if m:
            text = text[:m.start()] + new_list + text[m.end():]
            print('Replaced history grid with compact list')
        else:
            print('WARNING: grid pattern not found via regex')

    # 4. Camera button -> open native gallery
    old_btn = "onClick={() => setShowEvidenceList(true)}"
    new_btn = "onClick={() => { void cameraService.openFieldTraceAlbum(); }}"
    if old_btn in text:
        text = text.replace(old_btn, new_btn, 1)
        print('Camera button opens native gallery')

    # 5. Extend confirmDelete for evidence + add modals if missing
    if "confirmDelete.type === 'evidence'" not in text:
        old_msg = """                {confirmDelete.type === 'field' 
                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}\"""
        # try without escape
        old_msg = """{confirmDelete.type === 'field' 
                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}"""
        new_msg = """{confirmDelete.type === 'field' 
                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'
                  : confirmDelete.type === 'evidence'
                  ? '¿Eliminar este registro? Esta acción no se puede deshacer. La foto en el álbum Field Trace no se eliminará automáticamente.'
                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}"""
        if old_msg in text:
            text = text.replace(old_msg, new_msg)
            print('Updated confirm delete message')

        old_handler = """                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {
                      if (currentStep === 'setup' && editingProject) {
                        const newFields = [...(editingProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setEditingProject({...editingProject, customFields: newFields});
                      } else if (selectedProject) {
                        const newFields = [...(selectedProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setSelectedProject({...selectedProject, customFields: newFields});
                      }
                    }
                    setConfirmDelete(null);"""
        new_handler = """                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {
                      if (currentStep === 'setup' && editingProject) {
                        const newFields = [...(editingProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setEditingProject({...editingProject, customFields: newFields});
                      } else if (selectedProject) {
                        const newFields = [...(selectedProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setSelectedProject({...selectedProject, customFields: newFields});
                      }
                    } else if (confirmDelete.type === 'evidence' && confirmDelete.id != null) {
                      try {
                        await storageService.deleteEvidence(confirmDelete.id);
                        if (selectedProject?.id) {
                          const evs = await storageService.getEvidencesByProject(selectedProject.id);
                          setEvidences(evs);
                        }
                      } catch (e) {
                        console.error('Error eliminando evidencia', e);
                      }
                    }
                    setConfirmDelete(null);"""
        if old_handler in text:
            text = text.replace(old_handler, new_handler)
            print('Updated confirm delete handler')

    # 6. Inject modals before final AnimatePresence close if missing
    if 'Detalle del registro' not in text:
        modals = r'''
        {viewingEvidence && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Detalle del registro</h2>
              <button type="button" onClick={() => setViewingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2.5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Proyecto</p>
                <p className="text-sm font-black text-gray-950 uppercase">{viewingEvidence.projectName || '-'}</p>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Fecha / Hora</p>
                <p className="text-sm font-mono text-gray-800">{viewingEvidence.fecha} {viewingEvidence.hora || ''}</p>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">GPS</p>
                <p className="text-sm font-mono text-green-700">{viewingEvidence.gpsLabel || (viewingEvidence.latitude ? `${viewingEvidence.latitude}, ${viewingEvidence.longitude}` : 'SIN GPS')}</p>
                {viewingEvidence.ubicacion && (<><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Ubicacion</p><p className="text-sm text-gray-700 uppercase">{viewingEvidence.ubicacion}</p></>)}
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Tecnico</p>
                <p className="text-sm font-bold text-gray-900 uppercase">{viewingEvidence.baseFields?.tecnico || '-'}</p>
                {(viewingEvidence.customFields || []).filter((f: any) => f.active !== false).map((f: any, i: number) => (
                  <div key={i}><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">{f.name || 'Campo'}</p><p className="text-sm text-gray-800 uppercase">{f.value || '-'}</p></div>
                ))}
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Referencia foto</p>
                <p className="text-[11px] font-mono text-gray-400 break-all">{viewingEvidence.photoPath || viewingEvidence.uuid || '-'}</p>
              </div>
              <p className="text-center text-[10px] text-gray-400 pt-2">La foto real esta en Galeria → album Field Trace</p>
            </div>
          </motion.div>
        )}

        {editingEvidence && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Editar registro</h2>
              <button type="button" onClick={() => setEditingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cancelar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">Si editas esta informacion, no coincidira con el texto impreso en la fotografia.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tecnico</label>
                <input type="text" value={editingEvidence.baseFields?.tecnico || ''} onChange={(e) => setEditingEvidence({ ...editingEvidence, baseFields: { ...(editingEvidence.baseFields || {}), tecnico: e.target.value.toUpperCase() } })} className="w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              {(editingEvidence.customFields || []).map((f: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{f.name || `Campo ${idx + 1}`}</label>
                  <input type="text" value={f.value || ''} onChange={(e) => { const fields = [...(editingEvidence.customFields || [])]; fields[idx] = { ...fields[idx], value: e.target.value }; setEditingEvidence({ ...editingEvidence, customFields: fields }); }} className="w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500" />
                </div>
              ))}
              <button type="button" onClick={() => { setPendingEditSave(editingEvidence); setEditConfirmOpen(true); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/30">Guardar cambios</button>
            </div>
          </motion.div>
        )}

        {editConfirmOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
              <h3 className="text-lg font-black uppercase tracking-tighter mb-3">Confirmar edicion</h3>
              <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">Si editas esta informacion, no coincidira con el texto impreso en la fotografia. ¿Continuar?</p>
              <div className="flex gap-4">
                <button onClick={() => { setEditConfirmOpen(false); setPendingEditSave(null); }} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95">Cancelar</button>
                <button onClick={async () => { if (pendingEditSave?.id != null) { try { await storageService.updateEvidence(pendingEditSave.id, { baseFields: pendingEditSave.baseFields, customFields: pendingEditSave.customFields }); if (selectedProject?.id) { const evs = await storageService.getEvidencesByProject(selectedProject.id); setEvidences(evs); } } catch (e) { console.error('Error actualizando evidencia', e); } } setEditConfirmOpen(false); setPendingEditSave(null); setEditingEvidence(null); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95 shadow-lg shadow-blue-500/30">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
'''
        # Fix spaces in JSX
        modals = modals.replace('uppercase\ {', 'uppercase">{').replace('tight\ {', 'tight">{').replace('pt-2\ {', 'pt-2">{').replace('gray-800\ {', 'gray-800">{').replace('green-700\ {', 'green-700">{').replace('gray-700\ {', 'gray-700">{').replace('gray-900\ {', 'gray-900">{').replace('all\ {', 'all">{')
        insert_at = text.rfind('      </AnimatePresence>')
        if insert_at == -1:
            raise SystemExit('AnimatePresence close not found')
        text = text[:insert_at] + modals + '\n' + text[insert_at:]
        print('Injected view/edit modals')

    APP.write_text(text)
    print('App.tsx written, lines:', len(text.splitlines()))

if __name__ == '__main__':
    patch_storage()
    patch_camera()
    patch_app()
    print('DONE')
