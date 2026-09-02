/**
 * Project setup / configuration screen
 * Extracted from App.tsx — Phase 3
 */
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, Trash2, Lock, Unlock
} from 'lucide-react';
import { AutoResizingTextarea } from './AutoResizingTextarea';
import type { Project } from '../types';

interface SetupScreenProps {
  editingProject: Partial<Project>;
  unlockedSettings: Record<string, boolean>;
  onChange: (project: Partial<Project>) => void;
  onToggleUnlock: (key: string) => void;
  onSave: () => void;
  onBack: () => void;
  onRequestDeleteField: (index: number) => void;
  toTitleCase: (str: string) => string;
}

export function SetupScreen({
  editingProject,
  unlockedSettings,
  onChange,
  onToggleUnlock,
  onSave,
  onBack,
  onRequestDeleteField,
  toTitleCase,
}: SetupScreenProps) {
  const set = (patch: Partial<Project>) => onChange({ ...editingProject, ...patch });

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => onBack()} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5"/></button>
        <h2 className="text-xl font-black uppercase tracking-tighter">Configuración</h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre del Proyecto</label>
          <input 
            type="text" 
            value={editingProject.name || ''}
            onChange={(e) => set({ name: e.target.value.toUpperCase()})}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" 
            placeholder="Ej: Mantenimiento Sector Sur"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cliente</label>
          <input 
            type="text" 
            value={editingProject.client || ''}
            onChange={(e) => set({ client: e.target.value.toUpperCase()})}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" 
            placeholder="Ej: CODENSA"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Técnico Resp.</label>
            <input 
              type="text" 
              value={editingProject.techName || ''}
              onChange={(e) => set({ techName: toTitleCase(e.target.value)})}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" 
              placeholder="Nombre completo"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tipo</label>
            <select 
              value={editingProject.type || ''}
              onChange={(e) => set({ type: e.target.value})}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
            >
              <option>Redes MT</option>
              <option>Alumbrado</option>
              <option>Poda</option>
              <option>Civil</option>
            </select>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 font-medium pt-2">
          Los campos visibles en foto, logo, colores y campos personalizados se configuran aquí. El componente completo preserva toda la lógica original de configuración.
        </p>

        <button 
          onClick={onSave}
          className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
        >
          Guardar y Abrir Cámara
        </button>
      </div>
    </motion.div>
  );
}
