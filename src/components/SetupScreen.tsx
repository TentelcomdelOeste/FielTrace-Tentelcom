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
  const fontValue = editingProject.fontSizeValue ?? (
    editingProject.fontSizeScale === 'small' ? 20 :
    editingProject.fontSizeScale === 'large' ? 40 : 30
  );

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5"/></button>
        <h2 className="text-xl font-black uppercase tracking-tighter">Configuración</h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre del Proyecto</label>
          <input type="text" value={editingProject.name || ''} onChange={(e) => set({ name: e.target.value.toUpperCase() })}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" placeholder="Ej: Mantenimiento Sector Sur" />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cliente</label>
          <input type="text" value={editingProject.client || ''} onChange={(e) => set({ client: e.target.value.toUpperCase() })}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" placeholder="Ej: CODENSA" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Técnico Resp.</label>
            <input type="text" value={editingProject.techName || ''} onChange={(e) => set({ techName: toTitleCase(e.target.value) })}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" placeholder="Nombre completo" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tipo</label>
            <select value={editingProject.type || ''} onChange={(e) => set({ type: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold">
              <option>Redes MT</option><option>Alumbrado</option><option>Poda</option><option>Civil</option>
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
                <input type="checkbox" checked={!!(editingProject as any)[field.key]}
                  onChange={(e) => set({ [field.key]: e.target.checked } as any)} className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{field.label}</span>
              </label>
            ))}
          </div>

          {editingProject.showDateTime && (
            <div className="space-y-1 mt-2">
              <label className="text-[9px] font-black uppercase text-blue-400">Formato Fecha/Hora</label>
              <select value={editingProject.dateTimeFormat || 'format1'} onChange={(e) => set({ dateTimeFormat: e.target.value as any })}
                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold">
                <option value="format1">26 abr 2026 10:47:19 p.m.</option>
                <option value="format2">26/4/2026 10:47 p.m.</option>
              </select>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-blue-100">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-blue-400">Formato de Ubicación</label>
              <select value={editingProject.locationFormat || 'completa'} onChange={(e) => set({ locationFormat: e.target.value as any })}
                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold">
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
                { name: 'Blanco', color: '#FFFFFF' }, { name: 'Amarillo', color: '#FFFF00' },
                { name: 'Verde', color: '#00FF00' }, { name: 'Azul', color: '#3B82F6' }, { name: 'Rojo', color: '#EF4444' },
              ].map((c) => (
                <button key={c.color} onClick={() => set({ overlayColor: c.color })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editingProject.overlayColor === c.color ? 'border-blue-600 scale-110 shadow-lg' : 'border-white'}`}
                  style={{ backgroundColor: c.color }} title={c.name} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-400">Posición Overlay</label>
                <select value={editingProject.overlayPosition || 'top-left'} onChange={(e) => set({ overlayPosition: e.target.value as any })}
                  className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold">
                  <option value="top-left">Arriba Izq.</option><option value="top-right">Arriba Der.</option>
                  <option value="bottom-left">Abajo Izq.</option><option value="bottom-right">Abajo Der.</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Letra</label>
                <select value={editingProject.fontSizeScale || 'medium'} onChange={(e) => {
                  const scale = e.target.value as any;
                  const value = scale === 'small' ? 20 : scale === 'large' ? 40 : 30;
                  set({ fontSizeScale: scale, fontSizeValue: value });
                }} className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold">
                  <option value="small">Pequeño</option><option value="medium">Mediano</option><option value="large">Grande</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black uppercase text-blue-400">Ajuste fino tamaño de letra</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onToggleUnlock('fontSize')}
                    className={`p-1 rounded transition-colors ${unlockedSettings.fontSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                    title={unlockedSettings.fontSize ? 'Bloquear ajuste' : 'Desbloquear ajuste'}>
                    {unlockedSettings.fontSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </button>
                  <span className="text-[10px] font-bold text-blue-600">{fontValue}%</span>
                </div>
              </div>
              <input type="range" disabled={!unlockedSettings.fontSize} min="10" max="100" step="1" value={fontValue}
                onChange={(e) => set({ fontSizeValue: parseInt(e.target.value, 10) })}
                className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.fontSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`} />
              <div className="flex justify-between text-[8px] font-bold text-gray-400"><span>Más pequeña</span><span>Más grande</span></div>
            </div>

            <div className="space-y-3 mt-4 pt-4 border-t border-blue-100">
              <label className="text-[9px] font-black uppercase text-blue-400">Logo adicional en foto</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => set({
                  logoImage: reader.result as string,
                  logoPosition: editingProject.logoPosition || 'top-left',
                  logoSize: editingProject.logoSize ?? 20,
                  logoOpacity: editingProject.logoOpacity ?? 80,
                });
                reader.readAsDataURL(file);
              }} className="w-full text-xs font-bold text-blue-800 border p-2 rounded bg-white" />

              {editingProject.logoImage && (
                <>
                  <div className="flex items-center gap-4">
                    <img src={editingProject.logoImage} alt="Logo" className="h-12 max-w-[45%] object-contain rounded bg-white p-1 border border-blue-100" />
                    <button type="button" onClick={() => set({ logoImage: null })}
                      className="text-white bg-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest shadow-sm">ELIMINAR LOGO</button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-blue-400">Posición Logo</label>
                    <select value={editingProject.logoPosition || 'top-left'} onChange={(e) => set({ logoPosition: e.target.value as any })}
                      className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold">
                      <option value="top-left">Arriba Izq.</option><option value="top-right">Arriba Der.</option>
                      <option value="bottom-left">Abajo Izq.</option><option value="bottom-right">Abajo Der.</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Logo</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onToggleUnlock('logoSize')}
                          className={`p-1 rounded transition-colors ${unlockedSettings.logoSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                          {unlockedSettings.logoSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        </button>
                        <span className="text-[10px] font-bold text-blue-600">{editingProject.logoSize ?? 20}%</span>
                      </div>
                    </div>
                    <input type="range" disabled={!unlockedSettings.logoSize} min="5" max="80" step="1" value={editingProject.logoSize ?? 20}
                      onChange={(e) => set({ logoSize: parseInt(e.target.value, 10) })}
                      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`} />
                    <div className="flex justify-between text-[8px] font-bold text-gray-400"><span>Pequeño</span><span>Grande</span></div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black uppercase text-blue-400">Opacidad Logo</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onToggleUnlock('logoOpacity')}
                          className={`p-1 rounded transition-colors ${unlockedSettings.logoOpacity ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                          {unlockedSettings.logoOpacity ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        </button>
                        <span className="text-[10px] font-bold text-blue-600">{editingProject.logoOpacity ?? 80}%</span>
                      </div>
                    </div>
                    <input type="range" disabled={!unlockedSettings.logoOpacity} min="0" max="100" step="1" value={editingProject.logoOpacity ?? 80}
                      onChange={(e) => set({ logoOpacity: parseInt(e.target.value, 10) })}
                      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoOpacity ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`} />
                    <div className="flex justify-between text-[8px] font-bold text-gray-400"><span>Transparente</span><span>Opaco</span></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Campos Personalizados</p>
            <button onClick={() => set({ customFields: [...(editingProject.customFields || []), { name: '', value: '', showInPhoto: true, active: true }] })}
              className="text-[10px] font-black text-blue-600 uppercase">+ Agregar</button>
          </div>
          {editingProject.customFields?.map((cf, idx) => (
            <div key={idx} className={`flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100 ${cf.active === false ? 'opacity-50' : ''}`}>
              <div className="flex-1 flex gap-2">
                <AutoResizingTextarea value={cf.name || ''} onChange={(e: any) => {
                  const newFields = [...(editingProject.customFields || [])];
                  newFields[idx].name = e.target.value;
                  set({ customFields: newFields });
                }} placeholder="Propiedad" className="bg-transparent text-[10px] font-bold outline-none w-full resize-none overflow-hidden" />
                <input type="number" value={cf.value || ''} onChange={(e) => {
                  const newFields = [...(editingProject.customFields || [])];
                  newFields[idx].value = e.target.value;
                  set({ customFields: newFields });
                }} placeholder="Valor" className="bg-transparent text-[10px] font-bold outline-none border-l pl-2 w-16 shrink-0" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => {
                  const newFields = [...(editingProject.customFields || [])];
                  newFields[idx].active = !newFields[idx].active;
                  set({ customFields: newFields });
                }} className={`p-1.5 rounded-lg transition-colors ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`} title="Campo Activo">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onRequestDeleteField(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onSave} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">
        Guardar y Abrir Cámara
      </button>
    </motion.div>
  );
}
