#!/usr/bin/env python3
"""History: newest first; edit field name+value; clear all project records with double confirm."""
from pathlib import Path
import sys

app_path = Path("src/App.tsx")
storage_path = Path("src/services/storageService.ts")

if not app_path.exists():
    print("App.tsx missing", file=sys.stderr)
    sys.exit(1)

text = app_path.read_text(encoding="utf-8")
changed = False

# --- 1) Order: use evidences (already newest-first from storage) instead of reverse ---
if "reversedEvidences.map((ev) => {" in text:
    text = text.replace("reversedEvidences.map((ev) => {", "evidences.map((ev) => {", 1)
    changed = True
    print("order: use evidences (newest first)")
elif "evidences.map((ev) => {" in text and "reversedEvidences.map" not in text:
    print("order already newest-first")
else:
    print("WARN: could not find list map", file=sys.stderr)

if "const reversedEvidences = useMemo(() => [...evidences].reverse(), [evidences]);" in text:
    if "reversedEvidences" not in text.replace(
        "const reversedEvidences = useMemo(() => [...evidences].reverse(), [evidences]);",
        "",
        1,
    ):
        text = text.replace(
            "  const reversedEvidences = useMemo(() => [...evidences].reverse(), [evidences]);\n",
            "",
            1,
        )
        changed = True
        print("removed unused reversedEvidences")

# --- 2) Edit form: allow editing field name (descripción) + value (cantidad) ---
old_edit_fields = """              {(editingEvidence.customFields || []).map((f: any, idx: number) => (
                <div key={idx} className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{f.name || `Campo ${idx + 1}`}</label>
                  <input type="text" value={f.value || ''} onChange={(e) => { const fields = [...(editingEvidence.customFields || [])]; fields[idx] = { ...fields[idx], value: e.target.value }; setEditingEvidence({ ...editingEvidence, customFields: fields }); }} className="w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none" />
                </div>
              ))}"""

new_edit_fields = """              {(editingEvidence.customFields || []).map((f: any, idx: number) => (
                <div key={idx} className="space-y-3 bg-white border border-gray-100 rounded-2xl p-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Descripción</label>
                    <input
                      type="text"
                      value={f.name || ''}
                      onChange={(e) => {
                        const fields = [...(editingEvidence.customFields || [])];
                        fields[idx] = { ...fields[idx], name: e.target.value };
                        setEditingEvidence({ ...editingEvidence, customFields: fields });
                      }}
                      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-400"
                      placeholder="Nombre del campo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cantidad / Valor</label>
                    <input
                      type="text"
                      value={f.value || ''}
                      onChange={(e) => {
                        const fields = [...(editingEvidence.customFields || [])];
                        fields[idx] = { ...fields[idx], value: e.target.value };
                        setEditingEvidence({ ...editingEvidence, customFields: fields });
                      }}
                      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-400"
                      placeholder="Valor"
                    />
                  </div>
                </div>
              ))}"""

if "Descripción" in text and "Cantidad / Valor" in text and "fields[idx] = { ...fields[idx], name:" in text:
    print("edit form already has name+value")
elif old_edit_fields in text:
    text = text.replace(old_edit_fields, new_edit_fields, 1)
    changed = True
    print("edit form: name + value editable")
else:
    marker = "{(editingEvidence.customFields || []).map((f: any, idx: number) => ("
    if marker in text and "fields[idx] = { ...fields[idx], name:" not in text:
        start = text.find(marker)
        end = text.find("))}", start)
        if end > start:
            end = end + 3
            chunk = text[start:end]
            if "f.value" in chunk and "f.name" in chunk:
                text = text[:start] + new_edit_fields.strip() + text[end:]
                changed = True
                print("edit form: replaced via flexible match")
            else:
                print("WARN: edit fields chunk unexpected", file=sys.stderr)
        else:
            print("WARN: could not find edit fields end", file=sys.stderr)
    else:
        print("WARN: edit fields block not found", file=sys.stderr)

# --- 3) State for clear-all double confirm ---
if "confirmClearAllStep" not in text:
    old_state = "  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);"
    new_state = """  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);
  const [confirmClearAllStep, setConfirmClearAllStep] = useState<0 | 1 | 2>(0);"""
    if old_state in text:
        text = text.replace(old_state, new_state, 1)
        changed = True
        print("added confirmClearAllStep state")
    else:
        print("WARN: confirmDelete state not found", file=sys.stderr)

if "Vaciar registros" in text or ("confirmClearAllStep" in text and "Eliminar todos los registros" in text):
    print("clear-all UI may already exist")
else:
    needle = 'PDF Report'
    pos = text.find(needle)
    if pos > 0 and "Vaciar registros" not in text:
        close1 = text.find('</button>', pos)
        close_grid = text.find('</div>', close1)
        if close_grid > 0:
            insert_at = close_grid + len('</div>')
            clear_ui = """

                {evidences.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAllStep(1)}
                    className="w-full py-3.5 bg-red-50 border border-red-200 rounded-[1.5rem] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Vaciar registros</span>
                  </button>
                )}"""
            text = text[:insert_at] + clear_ui + text[insert_at:]
            changed = True
            print("added Vaciar registros button")
        else:
            print("WARN: could not find grid close for clear button", file=sys.stderr)
    else:
        if "Vaciar registros" in text:
            print("Vaciar registros already present")
        else:
            print("WARN: PDF Report section not found", file=sys.stderr)

if "confirmClearAllStep === 1" not in text:
    insert_before = "        {editingEvidence && ("
    if insert_before not in text:
        insert_before = "{editingEvidence && ("

    modal_block = """
        {confirmClearAllStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">¿Vaciar todos los registros?</h3>
              <p className="text-sm text-gray-600">
                Se eliminarán <span className="font-bold text-gray-900">{evidences.length}</span> registro(s) de este proyecto. Las fotos del álbum Field Trace no se borran automáticamente.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmClearAllStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmClearAllStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmClearAllStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[201] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>. ¿Eliminar definitivamente todos los registros del proyecto?
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmClearAllStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (selectedProject?.id != null) {
                        if ((storageService as any).deleteAllEvidencesByProject) {
                          await (storageService as any).deleteAllEvidencesByProject(selectedProject.id);
                        } else {
                          for (const ev of evidences) {
                            if (ev.id != null) await storageService.deleteEvidence(ev.id);
                          }
                        }
                        setEvidences([]);
                      }
                    } catch (e) {
                      console.error('[ClearAll] failed', e);
                    } finally {
                      setConfirmClearAllStep(0);
                    }
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  Sí, eliminar todo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

"""
    if insert_before in text:
        text = text.replace(insert_before, modal_block + "        " + insert_before.lstrip(), 1)
        changed = True
        print("added double-confirm modals")
    else:
        print("WARN: could not insert clear-all modals", file=sys.stderr)

app_path.write_text(text, encoding="utf-8")
print("App.tsx written", app_path.stat().st_size, "changed=", changed)

if storage_path.exists():
    st = storage_path.read_text(encoding="utf-8")
    if "deleteAllEvidencesByProject" not in st:
        old = """  async deleteEvidence(id: number): Promise<void> {
    await manager.delete(STORE_EVIDENCES, id);
  },"""
        new = """  async deleteEvidence(id: number): Promise<void> {
    await manager.delete(STORE_EVIDENCES, id);
  },

  async deleteAllEvidencesByProject(projectId: number): Promise<number> {
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
        if old in st:
            storage_path.write_text(st.replace(old, new, 1), encoding="utf-8")
            print("storageService: deleteAllEvidencesByProject added")
        else:
            print("WARN: deleteEvidence block not found in storage", file=sys.stderr)
    else:
        print("storage already has deleteAllEvidencesByProject")
else:
    print("WARN: storageService.ts missing", file=sys.stderr)

print("DONE")
