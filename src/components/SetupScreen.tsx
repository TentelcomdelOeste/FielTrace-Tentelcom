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

        <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-4">Campos Visibles en Foto</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { key: 'showDateTime', label: 'Fecha y Hora' },
              { key: 'showGps', label: 'GPS' },
              { key: 'showLocation', label: 'Ubicación' },
              { key: 'showTech', label: 'Técnico' },
            ].map((field) => (
              <label key={field.key} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={!!(editingProject as any)[field.key]} 
                  onChange={(e) => set({ [field.key]: e.target.checked } as any)}
                  className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{field.label}</span>
              </label>
            ))}
          </div>

          {editingProject.showDateTime && (
            <div className="space-y-1 mt-2">
              <label className="text-[9px] font-black uppercase text-blue-400">Formato Fecha/Hora</label>
              <select 
                value={editingProject.dateTimeFormat || 'format1'}
                onChange={(e) => set({ dateTimeFormat: e.target.value as any})}
                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
              >
                <option value="format1">26 abr 2026 10:47:19 p.m.</option>
                <option value="format2">26/4/2026 10:47 p.m.</option>
              </select>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-blue-100">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-blue-400">Formato de Ubicación</label>
              <select 
                value={editingProject.locationFormat || ''}
                onChange={(e) => set({ locationFormat: e.target.value as any})}
                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
              >
                <option value="completa">Completa (Simplificada)</option>
                <option value="distrito-canton">Distrito + Cantón</option>
                <option value="ciudad-provincia">Ciudad + Provincia</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-blue-100">
            <label className="text-[9px] font-black uppercase text-blue-400">Color de Texto Overlay</label>
            <div className="flex gap-2">
              {[
                { name: 'Blanco', color: '#FFFFFF' },
                { name: 'Amarillo', color: '#FFFF00' },
                { name: 'Verde', color: '#00FF00' },
                { name: 'Azul', color: '#3B82F6' },
                { name: 'Rojo', color: '#EF4444' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => set({ overlayColor: c.color})}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editingProject.overlayColor === c.color ? 'border-blue-600 scale-110 shadow-lg' : 'border-white'}`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-400">Posición Overlay</label>
                <select 
                  value={editingProject.overlayPosition || ''}
                  onChange={(e) => set({ overlayPosition: e.target.value as any})}
                  className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                >
                  <option value="top-left">Arriba Izq.</option>
                  <option value="top-right">Arriba Der.</option>
                  <option value="bottom-left">Abajo Izq.</option>
                  <option value="bottom-right">Abajo Der.</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Letra</label>
                <select 
                  value={editingProject.fontSizeScale || ''}
                  onChange={(e) => set({ fontSizeScale: e.target.value as any})}
                  className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                >
                  <option value="small">Pequeño</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Campos Personalizados</p>
            <button 
              onClick={() => set({
                customFields: [...(editingProject.customFields || []), { name: '', value: '', showInPhoto: true, active: true }]
              })}
              className="text-[10px] font-black text-blue-600 uppercase"
            >
              + Agregar
            </button>
          </div>
          {editingProject.customFields?.map((cf, idx) => (
            <div key={idx} className={`flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100 ${cf.active === false ? 'opacity-50' : ''}`}>
              <div className="flex-1 flex gap-2">
                <AutoResizingTextarea 
                  value={cf.name || ''} 
                  onChange={(e: any) => {
                    const newFields = [...(editingProject.customFields || [])];
                    newFields[idx].name = e.target.value;
                    set({ customFields: newFields});
                  }}
                  placeholder="Propiedad" 
                  className="bg-transparent text-[10px] font-bold outline-none w-full resize-none overflow-hidden"
                />
                <input 
                  type="number"
                  value={cf.value || ''} 
                  onChange={(e) => {
                    const newFields = [...(editingProject.customFields || [])];
                    newFields[idx].value = e.target.value;
                    set({ customFields: newFields});
                  }}
                  placeholder="Valor" 
                  className="bg-transparent text-[10px] font-bold outline-none border-l pl-2 w-16 shrink-0"
                />
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    const newFields = [...(editingProject.customFields || [])];
                    newFields[idx].active = !newFields[idx].active;
                    set({ customFields: newFields});
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                  title="Campo Activo"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => onRequestDeleteField(idx)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={onSave}
        className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
      >
        Guardar y Abrir Cámara
      </button>
    </motion.div>
  );
}
