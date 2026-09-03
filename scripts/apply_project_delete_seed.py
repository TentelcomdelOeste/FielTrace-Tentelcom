#!/usr/bin/env python3
"""Home: multi-select + delete projects (double confirm). First install: demo project + 2 sample records."""
from pathlib import Path
import sys

app_path = Path("src/App.tsx")
storage_path = Path("src/services/storageService.ts")

if not app_path.exists():
    print("App.tsx missing", file=sys.stderr)
    sys.exit(1)

text = app_path.read_text(encoding="utf-8")

# ---------- storageService: deleteProject + deleteProjects ----------
if storage_path.exists():
    st = storage_path.read_text(encoding="utf-8")
    if "async deleteProject(" not in st:
        anchor = """  async deleteAllEvidencesByProject(projectId: number): Promise<number> {
    const list = await this.getEvidencesByProject(projectId);
    let n = 0;
    for (const ev of list) {
      if (ev.id != null) {
        await manager.delete(STORE_EVIDENCES, ev.id);
        n += 1;
      }
    }
    return n;
  },"""
        addition = """  async deleteAllEvidencesByProject(projectId: number): Promise<number> {
    const list = await this.getEvidencesByProject(projectId);
    let n = 0;
    for (const ev of list) {
      if (ev.id != null) {
        await manager.delete(STORE_EVIDENCES, ev.id);
        n += 1;
      }
    }
    return n;
  },

  async deleteProject(projectId: number): Promise<void> {
    await this.deleteAllEvidencesByProject(projectId);
    await manager.delete(STORE_PROJECTS, projectId);
  },

  async deleteProjects(projectIds: number[]): Promise<number> {
    let n = 0;
    for (const id of projectIds) {
      if (id == null) continue;
      await this.deleteProject(id);
      n += 1;
    }
    return n;
  },"""
        if anchor in st:
            st = st.replace(anchor, addition, 1)
            storage_path.write_text(st, encoding="utf-8")
            print("storage: deleteProject/deleteProjects added")
        else:
            print("WARN: deleteAllEvidencesByProject anchor not found", file=sys.stderr)
    else:
        print("storage: deleteProject already present")
else:
    print("WARN: storageService missing", file=sys.stderr)

# ---------- App state ----------
if "projectSelectMode" not in text:
    old = "  const [confirmClearAllStep, setConfirmClearAllStep] = useState<0 | 1 | 2>(0);"
    if old not in text:
        old = "  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);"
        new = """  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);
  const [projectSelectMode, setProjectSelectMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [confirmDeleteProjectsStep, setConfirmDeleteProjectsStep] = useState<0 | 1 | 2>(0);
  const [pendingDeleteProjectIds, setPendingDeleteProjectIds] = useState<number[]>([]);"""
    else:
        new = """  const [confirmClearAllStep, setConfirmClearAllStep] = useState<0 | 1 | 2>(0);
  const [projectSelectMode, setProjectSelectMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [confirmDeleteProjectsStep, setConfirmDeleteProjectsStep] = useState<0 | 1 | 2>(0);
  const [pendingDeleteProjectIds, setPendingDeleteProjectIds] = useState<number[]>([]);"""
    if old in text:
        text = text.replace(old, new, 1)
        print("state: project select/delete added")
    else:
        print("WARN: state insertion point not found", file=sys.stderr)

old_seed = """    if (sortedProjects.length === 0) {
      const id = await storageService.createProject({
        name: "INSTALACIÓN SECTOR ALPHA",
        client: "ENEL",
        showDateTime: true,
        dateTimeFormat: "format1",
        showGps: true,
        showLocation: true,
        showTech: true,
        techName: "L. RUIZ",
        customFields: [{ name: "Perno 10\"", value: "05 UNID", showInPhoto: true, active: true }],
        locationFormat: 'completa',
        customLocationFormat: { road: true, suburb: true, city: true, state: true },
        allowPdf: true,
        allowExcel: true,
        overlayPosition: 'top-left',
        fontSizeScale: 'medium',
        overlayColor: '#FFFFFF',
        createdAt: new Date()
      });
      loadData();
      return;
    }"""

new_seed = """    if (sortedProjects.length === 0) {
      // Primera instalación: solo un proyecto DEMO con 2 registros de ejemplo (sin datos reales del usuario)
      const demoId = await storageService.createProject({
        name: "PROYECTO DEMO",
        client: "CLIENTE EJEMPLO",
        showDateTime: true,
        dateTimeFormat: "format1",
        showGps: true,
        showLocation: true,
        showTech: true,
        techName: "TÉCNICO DEMO",
        customFields: [
          { name: "Material", value: "Cable FO", showInPhoto: true, active: true },
          { name: "Cantidad", value: "02 UNID", showInPhoto: true, active: true },
        ],
        locationFormat: 'completa',
        customLocationFormat: { road: true, suburb: true, city: true, state: true },
        allowPdf: true,
        allowExcel: true,
        overlayPosition: 'top-left',
        fontSizeScale: 'medium',
        overlayColor: '#FFFFFF',
        createdAt: new Date()
      } as any);

      const now = new Date();
      const sampleFields1 = [
        { name: "Material", value: "Cable FO", showInPhoto: true, active: true },
        { name: "Cantidad", value: "02 UNID", showInPhoto: true, active: true },
      ];
      const sampleFields2 = [
        { name: "Material", value: "Conector SC/APC", showInPhoto: true, active: true },
        { name: "Cantidad", value: "04 UNID", showInPhoto: true, active: true },
      ];

      const baseDemo = {
        projectId: demoId,
        projectName: "PROYECTO DEMO",
        latitude: 9.9281,
        longitude: -84.0907,
        gpsLabel: "9.92810, -84.09070",
        locationText: "San José, Costa Rica (ejemplo)",
        baseFields: { tecnico: "TÉCNICO DEMO" },
        sharedWhatsApp: false,
        syncStatus: "pending" as const,
      };

      await storageService.addEvidence({
        ...baseDemo,
        customFields: sampleFields1,
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
        timestamp: now.getTime() - 5 * 60 * 1000,
      } as any, "");

      await storageService.addEvidence({
        ...baseDemo,
        customFields: sampleFields2,
        createdAt: now,
        timestamp: now.getTime(),
      } as any, "");

      loadData();
      return;
    }"""

if "PROYECTO DEMO" in text and "sampleFields1" in text:
    print("seed already demo+2")
elif old_seed in text:
    text = text.replace(old_seed, new_seed, 1)
    print("seed: demo project + 2 sample evidences")
else:
    marker = 'if (sortedProjects.length === 0) {'
    if marker in text and "PROYECTO DEMO" not in text:
        start = text.find(marker)
        end_marker = "loadData();\n      return;\n    }"
        end = text.find(end_marker, start)
        if end > start:
            end = end + len(end_marker)
            text = text[:start] + new_seed.strip() + text[end:]
            print("seed: replaced via flexible match")
        else:
            print("WARN: seed block end not found", file=sys.stderr)
    else:
        print("WARN: seed block not found or already updated", file=sys.stderr)

if "toggleProjectSelect" not in text:
    insert_after = "  const clearGallerySelection = () => {\n    setSelectedGalleryUris([]);\n    setGallerySelectMode(false);\n  };"
    helpers = """  const clearGallerySelection = () => {
    setSelectedGalleryUris([]);
    setGallerySelectMode(false);
  };

  const toggleProjectSelect = (id: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearProjectSelection = () => {
    setSelectedProjectIds([]);
    setProjectSelectMode(false);
  };

  const requestDeleteProjects = (ids: number[]) => {
    const unique = Array.from(new Set(ids.filter((id) => id != null)));
    if (!unique.length) return;
    setPendingDeleteProjectIds(unique);
    setConfirmDeleteProjectsStep(1);
  };

  const executeDeleteProjects = async () => {
    const ids = pendingDeleteProjectIds;
    if (!ids.length) {
      setConfirmDeleteProjectsStep(0);
      return;
    }
    try {
      if ((storageService as any).deleteProjects) {
        await (storageService as any).deleteProjects(ids);
      } else {
        for (const id of ids) {
          if ((storageService as any).deleteAllEvidencesByProject) {
            await (storageService as any).deleteAllEvidencesByProject(id);
          }
          await (storageService as any).deleteProject?.(id);
        }
      }
      if (selectedProject?.id != null && ids.includes(selectedProject.id)) {
        setSelectedProject(null);
        setEvidences([]);
        setCurrentStep('home');
      }
      clearProjectSelection();
      await loadData();
    } catch (e) {
      console.error('[Projects] delete failed', e);
    } finally {
      setPendingDeleteProjectIds([]);
      setConfirmDeleteProjectsStep(0);
    }
  };"""
    if insert_after in text:
        text = text.replace(insert_after, helpers, 1)
        print("helpers: project select/delete")
    else:
        alt = "  const shareSelectedGallery = (uris: string[]) => {"
        if alt in text and "toggleProjectSelect" not in text:
            text = text.replace(alt, helpers.replace("  const clearGallerySelection = () => {\n    setSelectedGalleryUris([]);\n    setGallerySelectMode(false);\n  };\n\n", "") + "\n\n  const shareSelectedGallery = (uris: string[]) => {", 1)
            print("helpers: inserted before shareSelectedGallery")
        else:
            print("WARN: helpers insertion failed", file=sys.stderr)

old_list_header = """                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Proyectos Recientes</span>
                    <button onClick={handleCreateProject} className="text-blue-600 font-bold text-xs uppercase tracking-tighter hover:bg-blue-50 px-3 py-1 rounded-lg">+ Nuevo Proyecto</button>
                  </div>"""

new_list_header = """                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Proyectos Recientes</span>
                    <div className="flex items-center gap-1">
                      {!projectSelectMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => { setProjectSelectMode(true); setSelectedProjectIds([]); }}
                            className="text-gray-500 font-bold text-[10px] uppercase tracking-tighter hover:bg-gray-50 px-2 py-1 rounded-lg"
                          >
                            Seleccionar
                          </button>
                          <button onClick={handleCreateProject} className="text-blue-600 font-bold text-xs uppercase tracking-tighter hover:bg-blue-50 px-3 py-1 rounded-lg">+ Nuevo Proyecto</button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const visible = projects.filter(p => {
                                const term = searchTerm.toLowerCase();
                                return (
                                  p.name.toLowerCase().includes(term) ||
                                  p.client.toLowerCase().includes(term) ||
                                  p.techName.toLowerCase().includes(term)
                                );
                              });
                              const ids = visible.map(p => p.id!).filter(Boolean) as number[];
                              if (selectedProjectIds.length === ids.length) setSelectedProjectIds([]);
                              else setSelectedProjectIds(ids);
                            }}
                            className="text-blue-600 font-bold text-[10px] uppercase tracking-tighter hover:bg-blue-50 px-2 py-1 rounded-lg"
                          >
                            {selectedProjectIds.length ? 'Ninguno' : 'Todos'}
                          </button>
                          <button
                            type="button"
                            onClick={clearProjectSelection}
                            className="text-gray-500 font-bold text-[10px] uppercase tracking-tighter hover:bg-gray-50 px-2 py-1 rounded-lg"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {projectSelectMode && selectedProjectIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => requestDeleteProjects(selectedProjectIds)}
                      className="w-full py-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                        Eliminar ({selectedProjectIds.length})
                      </span>
                    </button>
                  )}"""

if "projectSelectMode" in text and "Eliminar (" in text and "requestDeleteProjects" in text and old_list_header not in text:
    print("home header already patched")
elif old_list_header in text:
    text = text.replace(old_list_header, new_list_header, 1)
    print("home: select header + bulk delete bar")
else:
    print("WARN: list header not found", file=sys.stderr)

old_card = """                    .map((p) => (
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      key={p.id} 
                      onClick={() => handleSelectProject(p)}
                      className="p-5 bg-white border border-gray-100 rounded-[2rem] flex justify-between items-center hover:shadow-xl hover:shadow-blue-600/5 transition-all cursor-pointer group shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]"
                    >
                      <div className="flex gap-5 items-center">
                        <div className="w-14 h-14 bg-[#F8FAFC] rounded-[1.5rem] flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                          <MapPin className="w-6 h-6 text-gray-400 group-hover:text-blue-600"/>
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-gray-950 uppercase tracking-tight">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.client}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-200 group-hover:text-blue-600"/>
                    </motion.div>
                  ))}"""

new_card = """                    .map((p) => {
                    const isSelected = p.id != null && selectedProjectIds.includes(p.id);
                    return (
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      key={p.id} 
                      onClick={() => {
                        if (projectSelectMode) {
                          if (p.id != null) toggleProjectSelect(p.id);
                        } else {
                          handleSelectProject(p);
                        }
                      }}
                      className={`p-5 bg-white border rounded-[2rem] flex justify-between items-center hover:shadow-xl hover:shadow-blue-600/5 transition-all cursor-pointer group shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}
                    >
                      <div className="flex gap-4 items-center min-w-0">
                        {projectSelectMode ? (
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        ) : (
                          <div className="w-14 h-14 bg-[#F8FAFC] rounded-[1.5rem] flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                            <MapPin className="w-6 h-6 text-gray-400 group-hover:text-blue-600"/>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-gray-950 uppercase tracking-tight truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{p.client}</p>
                        </div>
                      </div>
                      {!projectSelectMode && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.id != null) requestDeleteProjects([p.id]);
                            }}
                            className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95"
                            title="Eliminar proyecto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-6 h-6 text-gray-200 group-hover:text-blue-600"/>
                        </div>
                      )}
                    </motion.div>
                    );
                  })}"""

if "requestDeleteProjects([p.id])" in text:
    print("card already has per-project delete")
elif old_card in text:
    text = text.replace(old_card, new_card, 1)
    print("home: project cards with select + delete")
else:
    print("WARN: project card block not found", file=sys.stderr)

if "confirmDeleteProjectsStep === 1" not in text:
    insert_before = "        {confirmClearAllStep === 1 && ("
    if insert_before not in text:
        insert_before = "        {editingEvidence && ("
    modal = """
        {confirmDeleteProjectsStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                {pendingDeleteProjectIds.length === 1 ? '¿Eliminar proyecto?' : `¿Eliminar ${pendingDeleteProjectIds.length} proyectos?`}
              </h3>
              <p className="text-sm text-gray-600">
                Se borrarán el proyecto y todos sus registros. Las fotos del álbum Field Trace no se eliminan automáticamente.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmDeleteProjectsStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteProjectsStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[201] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>.
                {pendingDeleteProjectIds.length === 1
                  ? ' ¿Eliminar definitivamente este proyecto?'
                  : ` ¿Eliminar definitivamente ${pendingDeleteProjectIds.length} proyectos?`}
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => { void executeDeleteProjects(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Sí, eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

"""
    if insert_before in text:
        text = text.replace(insert_before, modal + insert_before, 1)
        print("modals: double confirm project delete")
    else:
        print("WARN: could not insert project delete modals", file=sys.stderr)

old_confirm_handler_end = """                    } else if (confirmDelete.type === 'evidence' && confirmDelete.id != null) {
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

new_confirm_handler_end = """                    } else if (confirmDelete.type === 'evidence' && confirmDelete.id != null) {
                      try {
                        await storageService.deleteEvidence(confirmDelete.id);
                        if (selectedProject?.id) {
                          const evs = await storageService.getEvidencesByProject(selectedProject.id);
                          setEvidences(evs);
                        }
                      } catch (e) {
                        console.error('Error eliminando evidencia', e);
                      }
                    } else if (confirmDelete.type === 'project' && confirmDelete.id != null) {
                      requestDeleteProjects([confirmDelete.id]);
                    }
                    setConfirmDelete(null);"""

if "confirmDelete.type === 'project' && confirmDelete.id != null" in text:
    print("legacy project confirm already wired")
elif old_confirm_handler_end in text:
    text = text.replace(old_confirm_handler_end, new_confirm_handler_end, 1)
    print("legacy confirmDelete project wired to double-confirm")
else:
    print("WARN: confirmDelete handler not patched", file=sys.stderr)

app_path.write_text(text, encoding="utf-8")
print("App.tsx size", app_path.stat().st_size)

for k in ["PROYECTO DEMO", "projectSelectMode", "requestDeleteProjects", "confirmDeleteProjectsStep", "executeDeleteProjects", "toggleProjectSelect"]:
    print(k, k in text)
