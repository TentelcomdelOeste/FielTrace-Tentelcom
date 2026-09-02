/**
 * History / evidence list for a project
 * Extracted from App.tsx — Phase 2
 */
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, BarChart3, Camera as CameraIcon, FileSpreadsheet, FileText, Eye, Pencil, Trash2 } from 'lucide-react';
import type { Project, Evidence } from '../types';

interface HistoryScreenProps {
  selectedProject: Project;
  evidences: Evidence[];
  reversedEvidences: Evidence[];
  isProcessing: boolean;
  onBack: () => void;
  onEditProject: () => void;
  onGoSummary: () => void;
  onOpenCamera: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onViewEvidence: (ev: any) => void;
  onEditEvidence: (ev: any) => void;
  onDeleteEvidence: (id: number) => void;
}

export function HistoryScreen({
  selectedProject,
  evidences,
  reversedEvidences,
  isProcessing,
  onBack,
  onEditProject,
  onGoSummary,
  onOpenCamera,
  onExportExcel,
  onExportPdf,
  onViewEvidence,
  onEditEvidence,
  onDeleteEvidence,
}: HistoryScreenProps) {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-7 pt-4"
    >
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100 shrink-0"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">{selectedProject?.name}</h2>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest cursor-pointer hover:text-blue-600 flex items-center gap-1 shrink-0" onClick={onEditProject}>
              Configurar <Settings className="w-3 h-3" />
            </p>
            <span className="text-gray-200">|</span>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest cursor-pointer hover:text-blue-800 flex items-center gap-1 shrink-0" onClick={onGoSummary}>
              Resumen <BarChart3 className="w-3 h-3" />
            </p>
          </div>
        </div>
        <button 
          onClick={onOpenCamera}
          disabled={isProcessing}
          className="w-12 h-12 bg-blue-600 text-white shadow-[0_8px_20px_-4px_rgba(37,99,235,0.5)] rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50"
        >
          <CameraIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <button onClick={onExportExcel} className="py-4 bg-[#ECFDF5] border border-green-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm">
           <FileSpreadsheet className="w-6 h-6 text-green-600"/>
           <span className="text-[9px] font-black text-green-800 uppercase">Excel (.xlsx)</span>
         </button>
         <button onClick={onExportPdf} className="py-4 bg-[#FEF2F2] border border-red-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm">
           <FileText className="w-6 h-6 text-red-600"/>
           <span className="text-[9px] font-black text-red-800 uppercase">PDF Report</span>
         </button>
      </div>

      <div className="space-y-2 pb-24">
        {evidences.length === 0 ? (
          <div className="py-16 text-center space-y-3">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><CameraIcon className="w-8 h-8 text-gray-200" /></div>
             <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">No hay registros<br/>tecnicos capturados</p>
          </div>
        ) : (
          reversedEvidences.map((ev) => {
            const tech = ev.baseFields?.tecnico || '-';
            const gpsShort = (ev as any).gpsLabel || (ev.latitude ? `${Number(ev.latitude).toFixed(5)}, ${Number(ev.longitude).toFixed(5)}` : 'SIN GPS');
            const mainField = (ev.customFields || []).find((f: any) => f.active !== false && f.showInPhoto && (f.value || f.name));
            const fieldText = mainField ? (mainField.value ? `${mainField.name}: ${mainField.value}` : mainField.name) : '';
            return (
            <div key={ev.id || (ev as any).uuid} className="bg-white border border-gray-100 rounded-2xl px-3.5 py-3 shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_6px_#22c55e]"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-black text-gray-950 tracking-tight">{(ev as any).fecha} {(ev as any).hora || ''}</p>
                  <span className="text-[10px] font-bold text-gray-500 uppercase truncate">{tech}</span>
                </div>
                <p className="text-[10px] font-mono text-green-700 truncate mt-0.5">{gpsShort}</p>
                {fieldText && <p className="text-[9px] text-gray-400 uppercase truncate">{fieldText}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => onViewEvidence(ev)} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 active:scale-95" title="Ver"><Eye className="w-4 h-4" /></button>
                <button type="button" onClick={() => onEditEvidence({ ...ev, customFields: (ev.customFields || []).map((f: any) => ({ ...f })) })} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 active:scale-95" title="Editar"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => onDeleteEvidence(ev.id!)} className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
