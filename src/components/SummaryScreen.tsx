/**
 * Summary / dashboard for a project
 * Extracted from App.tsx — Phase 2
 */
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Calendar, Filter, FileSpreadsheet, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { Project, Evidence } from '../types';

interface SummaryScreenProps {
  selectedProject: Project;
  evidences: Evidence[];
  filterDate: string;
  filterTech: string;
  filterField: string;
  onFilterDate: (v: string) => void;
  onFilterTech: (v: string) => void;
  onFilterField: (v: string) => void;
  onBack: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

export function SummaryScreen({
  selectedProject,
  evidences,
  filterDate,
  filterTech,
  filterField,
  onFilterDate,
  onFilterTech,
  onFilterField,
  onBack,
  onExportExcel,
  onExportPdf,
}: SummaryScreenProps) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 pt-4 pb-10"
    >
      <div className="flex items-center gap-5">
        <button onClick={onBack} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">Resumen de Datos</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{selectedProject.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Evidencias</p>
          <h4 className="text-4xl font-black tracking-tighter text-blue-600">{evidences.length}</h4>
          <BarChart3 className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-blue-600" />
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Último Registro</p>
          <h4 className="text-lg font-black tracking-tighter text-gray-950">{(evidences[evidences.length-1] as any)?.fecha || 'N/A'}</h4>
          <Calendar className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-gray-950" />
        </div>
      </div>

      <div className="bg-[#F8FAFC] p-6 rounded-[2.5rem] border border-gray-100 space-y-4">
         <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Filtros Activos</span>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Fecha</label>
              <input type="date" value={filterDate} onChange={(e) => onFilterDate(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Técnico</label>
              <select value={filterTech} onChange={(e) => onFilterTech(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                <option value="">TODOS</option>
                {(Array.from(new Set(evidences.map(e => e.baseFields?.tecnico).filter(Boolean))) as string[]).map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
         </div>
         <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Material / Campo</label>
            <select value={filterField} onChange={(e) => onFilterField(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                <option value="">TODOS LOS CAMPOS</option>
                {selectedProject.customFields.map(f => (
                  <option key={f.name} value={f.name}>{f.name.toUpperCase()}</option>
                ))}
            </select>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Resumen de Materiales</h3>
          <div className="flex gap-2">
             <button onClick={onExportExcel} className="p-2 bg-green-50 text-green-600 rounded-lg"><FileSpreadsheet className="w-4 h-4" /></button>
             <button onClick={onExportPdf} className="p-2 bg-red-50 text-red-600 rounded-lg"><FileText className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {(() => {
            const filteredEvidences = evidences.filter(e => {
              if (filterDate && (e as any).fecha !== new Date(filterDate).toLocaleDateString()) return false;
              if (filterTech && e.baseFields?.tecnico !== filterTech) return false;
              return true;
            });

            const materialTotals: Record<string, number> = {};
            filteredEvidences.forEach(e => {
              (e.customFields || []).forEach((f: any) => {
                if (filterField && f.name !== filterField) return;
                const val = parseFloat(String(f.value || '').replace(/[^0-9.-]+/g, ""));
                if (!isNaN(val)) {
                  materialTotals[f.name] = (materialTotals[f.name] || 0) + val;
                }
              });
            });

            const entries = Object.entries(materialTotals);
            if (entries.length === 0) return <p className="text-center py-6 text-xs text-gray-300 font-bold uppercase">Sin datos acumulados</p>;

            return entries.map(([name, total]) => (
              <div key={name} className="flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-black uppercase text-gray-600 tracking-tighter">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-gray-950 tracking-tighter">{total}</span>
                  <ArrowUpRight className="w-4 h-4 text-gray-200 group-hover:text-green-500 transition-colors" />
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      <div className="bg-gray-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
         <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Estado del Proyecto</p>
         <h3 className="text-xl font-bold leading-tight mb-6">{evidences.length > 0 ? 'Recolección de datos en curso' : 'Esperando primera captura'}</h3>
         <div className="flex justify-between items-end">
            <div>
              <p className="text-[9px] font-black uppercase opacity-60">Técnico Actual</p>
              <p className="text-sm font-bold uppercase">{selectedProject.techName || 'No asignado'}</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
         </div>
      </div>
    </motion.div>
  );
}
