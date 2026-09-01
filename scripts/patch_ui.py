#!/usr/bin/env python3
from pathlib import Path
import re

APP = Path("src/App.tsx")
CAM = Path("src/services/cameraService.ts")
STO = Path("src/services/storageService.ts")

def main():
    t = CAM.read_text()
    if "openFieldTraceAlbum" not in t:
        block = (
            "\n  async openFieldTraceAlbum(): Promise<void> {\n"
            "    try {\n"
            "      if (Capacitor.getPlatform() === 'android') {\n"
            "        const intents = [\n"
            "          'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_GALLERY;end',\n"
            "          'intent:#Intent;action=android.intent.action.VIEW;type=image/*;end',\n"
            "          'content://media/external/images/media'\n"
            "        ];\n"
            "        for (const url of intents) {\n"
            "          try { window.location.href = url; return; } catch (_) {}\n"
            "        }\n"
            "        window.open('content://media/external/images/media', '_system');\n"
            "      } else {\n"
            "        window.open('photos://', '_blank');\n"
            "      }\n"
            "    } catch (e) {\n"
            "      console.warn('[Gallery] open failed', e);\n"
            "    }\n"
            "  },\n"
        )
        m = "    return album.identifier;\n  },\n};"
        if m not in t:
            raise SystemExit("cam marker")
        CAM.write_text(t.replace(m, "    return album.identifier;\n  },\n" + block + "};"))
    if "Media.savePhoto" not in CAM.read_text():
        raise SystemExit("no Media.savePhoto")

    t = STO.read_text()
    if "async deleteEvidence" not in t:
        nm = (
            "\n  async updateEvidence(id: number, updates: Partial<Evidence>): Promise<void> {\n"
            "    const existing = await manager.get<Evidence>(STORE_EVIDENCES, id);\n"
            "    if (!existing) throw new Error('Evidence not found');\n"
            "    const updated: Evidence = { ...existing, ...updates, id, updatedAt: new Date(), syncStatus: 'pending' };\n"
            "    await manager.put(STORE_EVIDENCES, updated);\n"
            "    if (navigator.onLine) {\n"
            "      firebaseService.syncEvidenceToCloud(updated).then(async (success) => {\n"
            "        if (success) {\n"
            "          updated.syncStatus = 'synced';\n"
            "          updated.lastSyncedAt = new Date();\n"
            "          await manager.put(STORE_EVIDENCES, updated);\n"
            "        }\n"
            "      }).catch(() => {});\n"
            "    }\n"
            "  },\n\n"
            "  async deleteEvidence(id: number): Promise<void> {\n"
            "    await manager.delete(STORE_EVIDENCES, id);\n"
            "  },\n\n"
        )
        STO.write_text(t.replace("  async saveTemplate(template: Template): Promise<number> {", nm + "  async saveTemplate(template: Template): Promise<number> {"))

    t = APP.read_text()
    if "Pencil" not in t.split("from 'lucide-react'")[0]:
        t = t.replace("  Unlock\n} from 'lucide-react';", "  Unlock,\n  Pencil\n} from 'lucide-react';")

    if "viewingEvidence" not in t:
        old = (
            "  const [showEvidenceList, setShowEvidenceList] = useState(false);\n"
            "  const [showQuickConfig, setShowQuickConfig] = useState(false);\n"
            "  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field', id?: number, index?: number } | null>(null);"
        )
        new = (
            "  const [showEvidenceList, setShowEvidenceList] = useState(false);\n"
            "  const [showQuickConfig, setShowQuickConfig] = useState(false);\n"
            "  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);\n"
            "  const [viewingEvidence, setViewingEvidence] = useState<any | null>(null);\n"
            "  const [editingEvidence, setEditingEvidence] = useState<any | null>(null);\n"
            "  const [editConfirmOpen, setEditConfirmOpen] = useState(false);\n"
            "  const [pendingEditSave, setPendingEditSave] = useState<any | null>(null);"
        )
        if old not in t:
            raise SystemExit("state")
        t = t.replace(old, new)

    if "setViewingEvidence(ev)" not in t:
        pat = re.compile(
            r'<div className="grid grid-cols-2 gap-4 pb-20">[\s\S]*?</div>\s*</motion\.div>\s*\)\}',
            re.M,
        )
        nl = (
            '<div className="space-y-2 pb-24">\n'
            "                  {evidences.length === 0 ? (\n"
            '                    <div className="py-16 text-center space-y-3">\n'
            '                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><CameraIcon className="w-8 h-8 text-gray-200" /></div>\n'
            '                       <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">No hay registros<br/>tecnicos capturados</p>\n'
            "                    </div>\n"
            "                  ) : (\n"
            "                    reversedEvidences.map((ev) => {\n"
            "                      const tech = ev.baseFields?.tecnico || '-';\n"
            "                      const gpsShort = ev.gpsLabel || (ev.latitude ? `${Number(ev.latitude).toFixed(5)}, ${Number(ev.longitude).toFixed(5)}` : 'SIN GPS');\n"
            "                      const mainField = (ev.customFields || []).find((f: any) => f.active !== false && f.showInPhoto && (f.value || f.name));\n"
            "                      const fieldText = mainField ? (mainField.value ? `${mainField.name}: ${mainField.value}` : mainField.name) : '';\n"
            "                      return (\n"
            '                      <div key={ev.id || ev.uuid} className="bg-white border border-gray-100 rounded-2xl px-3.5 py-3 shadow-sm flex items-center gap-3">\n'
            '                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_6px_#22c55e]"></div>\n'
            '                        <div className="flex-1 min-w-0">\n'
            '                          <div className="flex items-center gap-2 flex-wrap">\n'
            "                            <p className=\"text-[12px] font-black text-gray-950 tracking-tight\">{ev.fecha} {ev.hora || ''}</p>\n"
            '                            <span className="text-[10px] font-bold text-gray-500 uppercase truncate">{tech}</span>\n'
            "                          </div>\n"
            '                          <p className="text-[10px] font-mono text-green-700 truncate mt-0.5">{gpsShort}</p>\n'
            '                          {fieldText && <p className="text-[9px] text-gray-400 uppercase truncate">{fieldText}</p>}\n'
            "                        </div>\n"
            '                        <div className="flex items-center gap-1 shrink-0">\n'
            '                          <button type="button" onClick={() => setViewingEvidence(ev)} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 active:scale-95" title="Ver"><Eye className="w-4 h-4" /></button>\n'
            '                          <button type="button" onClick={() => setEditingEvidence({ ...ev, customFields: (ev.customFields || []).map((f: any) => ({ ...f })) })} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 active:scale-95" title="Editar"><Pencil className="w-4 h-4" /></button>\n'
            "                          <button type=\"button\" onClick={() => setConfirmDelete({ type: 'evidence', id: ev.id })} className=\"w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95\" title=\"Eliminar\"><Trash2 className=\"w-4 h-4\" /></button>\n"
            "                        </div>\n"
            "                      </div>\n"
            "                      );\n"
            "                    })\n"
            "                  )}\n"
            "                </div>\n"
            "              </motion.div>\n"
            "            )}"
        )
        m = pat.search(t)
        if not m:
            raise SystemExit("grid")
        t = t[: m.start()] + nl + t[m.end() :]

    if "openFieldTraceAlbum" not in t:
        t = t.replace(
            "onClick={() => setShowEvidenceList(true)}",
            "onClick={() => { void cameraService.openFieldTraceAlbum(); }}",
            1,
        )

    if "confirmDelete.type === 'evidence'" not in t:
        om = (
            "{confirmDelete.type === 'field' \n"
            "                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'\n"
            "                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}"
        )
        nm = (
            "{confirmDelete.type === 'field' \n"
            "                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'\n"
            "                  : confirmDelete.type === 'evidence'\n"
            "                  ? '¿Eliminar este registro? Esta acción no se puede deshacer. La foto en el álbum Field Trace no se eliminará automáticamente.'\n"
            "                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}"
        )
        if om not in t:
            raise SystemExit("msg")
        t = t.replace(om, nm)
        oh = (
            "                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {\n"
            "                      if (currentStep === 'setup' && editingProject) {\n"
            "                        const newFields = [...(editingProject.customFields || [])];\n"
            "                        newFields.splice(confirmDelete.index, 1);\n"
            "                        setEditingProject({...editingProject, customFields: newFields});\n"
            "                      } else if (selectedProject) {\n"
            "                        const newFields = [...(selectedProject.customFields || [])];\n"
            "                        newFields.splice(confirmDelete.index, 1);\n"
            "                        setSelectedProject({...selectedProject, customFields: newFields});\n"
            "                      }\n"
            "                    }\n"
            "                    setConfirmDelete(null);"
        )
        nh = (
            "                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {\n"
            "                      if (currentStep === 'setup' && editingProject) {\n"
            "                        const newFields = [...(editingProject.customFields || [])];\n"
            "                        newFields.splice(confirmDelete.index, 1);\n"
            "                        setEditingProject({...editingProject, customFields: newFields});\n"
            "                      } else if (selectedProject) {\n"
            "                        const newFields = [...(selectedProject.customFields || [])];\n"
            "                        newFields.splice(confirmDelete.index, 1);\n"
            "                        setSelectedProject({...selectedProject, customFields: newFields});\n"
            "                      }\n"
            "                    } else if (confirmDelete.type === 'evidence' && confirmDelete.id != null) {\n"
            "                      try {\n"
            "                        await storageService.deleteEvidence(confirmDelete.id);\n"
            "                        if (selectedProject?.id) {\n"
            "                          const evs = await storageService.getEvidencesByProject(selectedProject.id);\n"
            "                          setEvidences(evs);\n"
            "                        }\n"
            "                      } catch (e) {\n"
            "                        console.error('Error eliminando evidencia', e);\n"
            "                      }\n"
            "                    }\n"
            "                    setConfirmDelete(null);"
        )
        if oh not in t:
            raise SystemExit("handler")
        t = t.replace(oh, nh)

    if "Detalle del registro" not in t:
        modals = (
            "\n        {viewingEvidence && (\n"
            '          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">\n'
            '            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">\n'
            '              <h2 className="text-sm font-black uppercase tracking-tight">Detalle del registro</h2>\n'
            '              <button type="button" onClick={() => setViewingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>\n'
            "            </div>\n"
            '            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-3">\n'
            '              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2.5 shadow-sm">\n'
            '                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Proyecto</p>\n'
            "                <p className=\"text-sm font-black text-gray-950 uppercase\">{viewingEvidence.projectName || '-'}</p>\n"
            '                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Fecha / Hora</p>\n'
            "                <p className=\"text-sm font-mono text-gray-800\">{viewingEvidence.fecha} {viewingEvidence.hora || ''}</p>\n"
            '                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">GPS</p>\n'
            "                <p className=\"text-sm font-mono text-green-700\">{viewingEvidence.gpsLabel || (viewingEvidence.latitude ? `${viewingEvidence.latitude}, ${viewingEvidence.longitude}` : 'SIN GPS')}</p>\n"
            "                {viewingEvidence.ubicacion && (<><p className=\"text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2\">Ubicacion</p><p className=\"text-sm text-gray-700 uppercase\">{viewingEvidence.ubicacion}</p></>)}\n"
            '                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Tecnico</p>\n'
            "                <p className=\"text-sm font-bold text-gray-900 uppercase\">{viewingEvidence.baseFields?.tecnico || '-'}</p>\n"
            "                {(viewingEvidence.customFields || []).filter((f: any) => f.active !== false).map((f: any, i: number) => (\n"
            "                  <div key={i}><p className=\"text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2\">{f.name || 'Campo'}</p><p className=\"text-sm text-gray-800 uppercase\">{f.value || '-'}</p></div>\n"
            "                ))}\n"
            '                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Referencia foto</p>\n'
            "                <p className=\"text-[11px] font-mono text-gray-400 break-all\">{viewingEvidence.photoPath || viewingEvidence.uuid || '-'}</p>\n"
            "              </div>\n"
            '              <p className="text-center text-[10px] text-gray-400 pt-2">La foto real esta en Galeria</p>\n'
            "            </div>\n"
            "          </motion.div>\n"
            "        )}\n"
            "        {editingEvidence && (\n"
            '          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">\n'
            '            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">\n'
            '              <h2 className="text-sm font-black uppercase tracking-tight">Editar registro</h2>\n'
            '              <button type="button" onClick={() => setEditingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cancelar</button>\n'
            "            </div>\n"
            '            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-4">\n'
            '              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3"><p className="text-[11px] text-amber-800 font-medium">Si editas esta informacion, no coincidira con el texto impreso en la fotografia.</p></div>\n'
            '              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tecnico</label>\n'
            "                <input type=\"text\" value={editingEvidence.baseFields?.tecnico || ''} onChange={(e) => setEditingEvidence({ ...editingEvidence, baseFields: { ...(editingEvidence.baseFields || {}), tecnico: e.target.value.toUpperCase() } })} className=\"w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none\" />\n"
            "              </div>\n"
            "              {(editingEvidence.customFields || []).map((f: any, idx: number) => (\n"
            "                <div key={idx} className=\"space-y-1.5\"><label className=\"text-[10px] font-black uppercase text-gray-400 tracking-widest\">{f.name || `Campo ${idx + 1}`}</label>\n"
            "                  <input type=\"text\" value={f.value || ''} onChange={(e) => { const fields = [...(editingEvidence.customFields || [])]; fields[idx] = { ...fields[idx], value: e.target.value }; setEditingEvidence({ ...editingEvidence, customFields: fields }); }} className=\"w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none\" />\n"
            "                </div>\n"
            "              ))}\n"
            "              <button type=\"button\" onClick={() => { setPendingEditSave(editingEvidence); setEditConfirmOpen(true); }} className=\"w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase\">Guardar cambios</button>\n"
            "            </div>\n"
            "          </motion.div>\n"
            "        )}\n"
            "        {editConfirmOpen && (\n"
            "          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className=\"fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md\">\n"
            "            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className=\"bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center\">\n"
            "              <h3 className=\"text-lg font-black uppercase mb-3\">Confirmar edicion</h3>\n"
            "              <p className=\"text-sm text-gray-500 mb-8\">Si editas esta informacion, no coincidira con el texto impreso en la fotografia. ¿Continuar?</p>\n"
            "              <div className=\"flex gap-4\">\n"
            "                <button onClick={() => { setEditConfirmOpen(false); setPendingEditSave(null); }} className=\"flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase\">Cancelar</button>\n"
            "                <button onClick={async () => { if (pendingEditSave?.id != null) { try { await storageService.updateEvidence(pendingEditSave.id, { baseFields: pendingEditSave.baseFields, customFields: pendingEditSave.customFields }); if (selectedProject?.id) { const evs = await storageService.getEvidencesByProject(selectedProject.id); setEvidences(evs); } } catch (e) { console.error(e); } } setEditConfirmOpen(false); setPendingEditSave(null); setEditingEvidence(null); }} className=\"flex-1 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold uppercase\">Continuar</button>\n"
            "              </div>\n"
            "            </motion.div>\n"
            "          </motion.div>\n"
            "        )}\n"
        )
        i = t.rfind("      </AnimatePresence>")
        if i < 0:
            raise SystemExit("AP")
        t = t[:i] + modals + "\n" + t[i:]

    APP.write_text(t)
    print("patch done", len(t.splitlines()))

if __name__ == "__main__":
    main()
