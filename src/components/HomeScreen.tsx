/**
 * Home screen — list of projects
 * Extracted from App.tsx — Phase 2
 */
import { motion } from 'framer-motion';
import { UserCircle, CloudUpload, History, LayoutGrid, Search, X, MapPin, ChevronRight } from 'lucide-react';
import type { Project } from '../types';

interface HomeScreenProps {
  projects: Project[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectProject: (p: Project) => void;
  onCreateProject: () => void;
}

export function HomeScreen({
  projects,
  searchTerm,
  onSearchChange,
  onSelectProject,
  onCreateProject,
}: HomeScreenProps) {
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-7 pt-4"
    >
      <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-black tracking-tighter uppercase text-gray-950">Field Trace</h1>
         </div>
         <div className="w-12 h-12 bg-white shadow-xl rounded-2xl flex items-center justify-center border border-gray-100"><UserCircle className="w-6 h-6 text-gray-400"/></div>
      </div>

      <div className="bg-gray-900 rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden">
         <div className="relative z-10">
           <p className="text-[10px] font-black uppercase opacity-40 mb-2 tracking-widest">Estado de Sincronización</p>
           <h3 className="text-xl font-bold leading-tight mb-6">Operando Offline / Local Ready</h3>
           <div className="flex gap-4">
              <div className="flex items-center gap-1.5 bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter">
                <CloudUpload className="w-3.5 h-3.5" /> En Espera
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border border-white/10">
                <History className="w-3.5 h-3.5" /> Log
              </div>
           </div>
         </div>
         <LayoutGrid className="absolute -right-8 -bottom-8 w-40 h-40 opacity-5" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 px-5 py-4 rounded-3xl shadow-sm focus-within:border-blue-300 transition-all relative">
          <Search className="w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="BUSCAR PROYECTO, CLIENTE O TECNICO..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent flex-1 outline-none text-xs font-black uppercase tracking-tighter placeholder:text-gray-300 pr-8"
          />
          {searchTerm && (
            <button 
              onClick={() => onSearchChange("")}
              className="absolute right-4 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Proyectos Recientes</span>
          <button onClick={onCreateProject} className="text-blue-600 font-bold text-xs uppercase tracking-tighter hover:bg-blue-50 px-3 py-1 rounded-lg">+ Nuevo Proyecto</button>
        </div>
        {projects
          .filter(p => {
            const term = searchTerm.toLowerCase();
            return (
              p.name.toLowerCase().includes(term) ||
              p.client.toLowerCase().includes(term) ||
              p.techName.toLowerCase().includes(term)
            );
          })
          .map((p) => (
          <motion.div 
            whileTap={{ scale: 0.98 }}
            key={p.id} 
            onClick={() => onSelectProject(p)}
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
        ))}
      </div>
    </motion.div>
  );
}
