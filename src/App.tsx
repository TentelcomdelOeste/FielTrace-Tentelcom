/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — Orchestrator after Phase 1-3 refactor
 * Screens extracted to components/; this file holds global state + navigation.
 */

import {
  Plus,
  MapPin,
  Camera as CameraIcon,
  Share2,
  FileText,
  ArrowLeft,
  Settings,
  LayoutGrid,
  History,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  Filter,
  Trash2,
  Save,
  RefreshCcw,
  UserCircle,
  ShieldCheck,
  CloudUpload,
  Calendar,
  X,
  ChevronRight,
  Smartphone,
  Eye,
  BarChart3,
  ArrowUpRight,
  Lock,
  Unlock,
  Pencil,
  Zap,
  ZapOff,
  ZoomIn
} from 'lucide-react';
import { AutoResizingTextarea } from './components/AutoResizingTextarea';
import { CameraScreen } from './components/CameraScreen';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { SetupScreen } from './components/SetupScreen';
import { getFormattedLocationText } from './components/LiveLocationOverlay';
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';

const formatDateTime = (format: 'format1' | 'format2') => {
  const now = new Date();
  if (format === 'format2') {
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

/** Metadata-only card - photos live only in native gallery Field Trace */
const EvidenceCard = memo(({ evidence }: { evidence: any }) => {
  const hasGps = evidence.latitude && evidence.longitude && !(evidence.latitude === 0 && evidence.longitude === 0);
  const gpsText = evidence.gpsLabel || (hasGps
    ? `${Number(evidence.latitude).toFixed(5)}, ${Number(evidence.longitude).toFixed(5)}`
    : 'SIN GPS');
  const tech = evidence.baseFields?.tecnico || '-';
  const fields = (evidence.customFields || [])
    .filter((f: any) => f.active !== false && f.showInPhoto)
    .slice(0, 3);

  return (
    <div className="aspect-[4/5] rounded-[2rem] overflow-hidden border border-gray-100 relative group shadow-sm bg-white flex flex-col p-4">
      <div className="absolute top-3 left-3 flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
      </div>
      <div className="mt-4 space-y-1.5 flex-1 min-h-0 overflow-hidden">
        <p className="text-[10px] font-black uppercase text-gray-950 tracking-tight line-clamp-2">
          {evidence.projectName || 'Evidencia'}
        </p>
        <p className="text-[9px] font-mono text-gray-500">{evidence.fecha} {evidence.hora || ''}</p>
        <p className={`text-[9px] font-mono ${hasGps ? 'text-green-600' : 'text-amber-600'}`}>{gpsText}</p>
        {evidence.ubicacion && evidence.ubicacion !== 'Pendiente de geocodificación' && evidence.ubicacion !== '' && (
          <p className="text-[8px] text-gray-400 line-clamp-2 uppercase">{evidence.ubicacion}</p>
        )}
        <p className="text-[9px] font-bold text-gray-700 uppercase">{tech}</p>
        {fields.map((f: any, i: number) => (
          <p key={i} className="text-[8px] text-gray-500 uppercase truncate">
            {f.value ? `${f.name}: ${f.value}` : f.name}
          </p>
        ))}
      </div>
      <div className="mt-auto pt-2 border-t border-gray-50">
        <p className="text-[7px] text-gray-300 font-mono truncate" title={evidence.photoPath}>
          ref: {evidence.photoPath || evidence.uuid || '-'}
        </p>
      </div>
    </div>
  );
});

import { CameraPreview } from '@capgo/camera-preview';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from './services/storageService';
import { exportService } from './services/exportService';
import { cameraService } from './services/cameraService';
import { locationService } from './services/locationService';
import { shareService } from './services/shareService';
import type { Project, Evidence, CustomField, Template } from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [currentStep, setCurrentStep] = useState<'home' | 'history' | 'setup' | 'camera' | 'summary'>('home');
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [unlockedSettings, setUnlockedSettings] = useState<Record<string, boolean>>({});
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [showLastImage, setShowLastImage] = useState(false);
  const [showEvidenceList, setShowEvidenceList] = useState(false);
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<any | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<any | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSave, setPendingEditSave] = useState<any | null>(null);

  const reversedEvidences = useMemo(() => [...evidences].reverse(), [evidences]);

  const [filterDate, setFilterDate] = useState<string>("");
  const [filterTech, setFilterTech] = useState<string>("");
  const [filterField, setFilterField] = useState<string>("");

  useEffect(() => {
    loadData();
    const watchPromise = locationService.watchPosition();
    return () => {
      watchPromise.then(id => {
        if (id) locationService.clearWatch(id);
      });
    };
  }, []);

  const loadData = async () => {
    const allProjects = await storageService.getAllProjects();
    const sortedProjects = [...allProjects].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    setProjects(sortedProjects);
    
    if (sortedProjects.length === 0) {
      await storageService.createProject({
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
    }

    const storedStep = sessionStorage.getItem('activeStep');
    const storedProjectId = sessionStorage.getItem('activeProjectId');

    if (storedProjectId) {
      const foundProject = sortedProjects.find(p => p.id === Number(storedProjectId));
      if (foundProject) {
        setSelectedProject(foundProject);
        if (storedStep) {
          setCurrentStep(storedStep as 'home' | 'history' | 'setup' | 'camera' | 'summary');
        }
      }
    }
  };

  useEffect(() => {
    sessionStorage.setItem('activeStep', currentStep);
    if (selectedProject?.id) {
       sessionStorage.setItem('activeProjectId', String(selectedProject.id));
    } else {
       sessionStorage.removeItem('activeProjectId');
    }
  }, [currentStep, selectedProject]);

  const handleCreateProject = () => {
    setEditingProject({
      name: '',
      client: '',
      type: 'General',
      showDateTime: true,
      dateTimeFormat: 'format1',
      showGps: true,
      showLocation: true,
      showTech: true,
      techName: '',
      customFields: [],
      locationFormat: 'completa',
      customLocationFormat: { road: true, suburb: true, city: true, state: true },
      allowPdf: true,
      allowExcel: true,
      overlayPosition: 'top-left',
      fontSizeScale: 'medium',
      overlayColor: '#FFFFFF',
    });
    setCurrentStep('setup');
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setCurrentStep('setup');
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => {
      return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
  };

  const handleSaveProject = async () => {
    if (!editingProject?.name || !editingProject.client) return;
    
    const normalizedProject = {
      ...editingProject,
      name: editingProject.name.toUpperCase(),
      client: editingProject.client.toUpperCase(),
      techName: toTitleCase(editingProject.techName || ''),
      createdAt: editingProject.createdAt || new Date()
    } as Project;

    let id;
    if (editingProject.id) {
      await storageService.updateProject(editingProject.id, normalizedProject);
      id = editingProject.id;
    } else {
      id = await storageService.createProject(normalizedProject);
    }
    
    const savedProject = await storageService.getProject(id);
    setSelectedProject(savedProject);
    loadData();
    setCurrentStep('camera');
  };

  const handleSelectProject = async (p: Project) => {
    setSelectedProject(p);
    const evs = await storageService.getEvidencesByProject(p.id!);
    setEvidences(evs);
    setCurrentStep('history');
  };

  const captureBatchPhoto = async () => {
    if (!selectedProject || isProcessing) return;
    setIsProcessing(true);
    
    try {
      const captureResult = await CameraPreview.capture({ quality:90, format:'jpeg' });
      const capturedValue = captureResult?.value;
      const rawImage = capturedValue ? (capturedValue.startsWith('data:') ? capturedValue : `data:image/jpeg;base64,${capturedValue}`) : null;
      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara nativa');

      const pulse = document.getElementById('camera-pulse');
      if (pulse) {
        pulse.classList.add('bg-white/60');
        setTimeout(() => pulse.classList.remove('bg-white/60'), 150);
      }
      
      setIsProcessing(false);

      const { gps, locationData } = locationService.getCurrentState();
      const hasGps = !!(gps && gps.lat != null && gps.lon != null);
      const gpsLabel = hasGps ? `${gps!.lat.toFixed(6)}, ${gps!.lon.toFixed(6)}` : 'SIN GPS';
      const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
      const ubicacionText = hasGps && currentFormattedLocation && currentFormattedLocation !== "Buscando..."
        ? currentFormattedLocation
        : (hasGps ? "Pendiente de geocodificación" : "");

      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'ev_' + Date.now() + Math.random().toString(36).substr(2, 9);
      const fileName = `FT_${uuid}.jpg`;
      const capturedAt = new Date();
      const timestamp = capturedAt.getTime();
      const fecha = capturedAt.toLocaleDateString('es-ES');
      const hora = capturedAt.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });

      const customFieldsSnapshot = selectedProject.customFields.map(f => ({ ...f }));

      const evidenceObject: any = {
        uuid,
        projectId: selectedProject.id!,
        projectName: selectedProject.name,
        photoPath: fileName,
        photo: { fileName, createdAt: capturedAt },
        capturedAt,
        fecha,
        hora,
        timestamp,
        latitude: hasGps ? gps!.lat : null,
        longitude: hasGps ? gps!.lon : null,
        gpsAccuracy: hasGps ? gps!.accuracy : undefined,
        gpsCapturedAt: hasGps ? capturedAt : undefined,
        gpsLabel,
        ubicacion: ubicacionText,
        baseFields: { tecnico: selectedProject.techName || "TECNICO" },
        customFields: customFieldsSnapshot,
        sharedWhatsApp: false,
        createdAt: capturedAt,
        locked: true,
        syncStatus: 'pending',
        retryCount: 0,
        projectNameOverlay: selectedProject.name,
        dateTimeFormatted: formatDateTime(selectedProject.dateTimeFormat),
        settings: {
          showDateTime: selectedProject.showDateTime,
          dateTimeFormat: selectedProject.dateTimeFormat,
          showGps: selectedProject.showGps,
          showLocation: selectedProject.showLocation,
          showTech: selectedProject.showTech,
          overlayPosition: selectedProject.overlayPosition,
          fontSizeScale: selectedProject.fontSizeScale,
          fontSizeValue: selectedProject.fontSizeValue,
          overlayColor: selectedProject.overlayColor,
          logoImage: selectedProject.logoImage,
          logoPosition: selectedProject.logoPosition,
          logoSize: selectedProject.logoSize,
          logoOpacity: selectedProject.logoOpacity
        }
      };

      (async () => {
        try {
          const finalImage = await cameraService.drawOverlay(rawImage, evidenceObject);
          if (!finalImage) throw new Error("Error procesando overlay");
          setLastImage(finalImage);
          
          const savedToGallerySuccess = await cameraService.saveToGallery(finalImage, fileName);
          if (!savedToGallerySuccess) {
            console.error("[AtomicCapture] Error: No se pudo guardar la fotografía en la galería.");
            return;
          }

          await storageService.addEvidence(evidenceObject, finalImage);
          const evs = await storageService.getEvidencesByProject(selectedProject.id!);
          setEvidences(evs);
        } catch (e: any) {
          console.error("Fallo procesamiento asíncrono en captura", e);
        }
      })();

    } catch (e: any) {
      console.error('Batch capture error', e);
      setIsProcessing(false);
    }
  };

  return (
    <div className={`min-h-screen ${currentStep === 'camera' ? 'bg-transparent' : 'bg-white'} flex flex-col font-sans`}>
      <div className={`flex-1 flex flex-col relative overflow-hidden ${currentStep === 'camera' ? 'invisible' : ''}`}>
        <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
          <AnimatePresence mode="wait">
            {currentStep === 'home' && (
              <HomeScreen
                projects={projects}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelectProject={handleSelectProject}
                onCreateProject={handleCreateProject}
              />
            )}

            {currentStep === 'history' && selectedProject && (
              <HistoryScreen
                selectedProject={selectedProject}
                evidences={evidences}
                reversedEvidences={reversedEvidences}
                isProcessing={isProcessing}
                onBack={() => setCurrentStep('home')}
                onEditProject={() => handleEditProject(selectedProject)}
                onGoSummary={() => setCurrentStep('summary')}
                onOpenCamera={() => setCurrentStep('camera')}
                onExportExcel={() => exportService.generateExcel(selectedProject.id!)}
                onExportPdf={() => exportService.generatePDF(selectedProject.id!)}
                onViewEvidence={setViewingEvidence}
                onEditEvidence={setEditingEvidence}
                onDeleteEvidence={(id) => setConfirmDelete({ type: 'evidence', id })}
              />
            )}

            {currentStep === 'summary' && selectedProject && (
              <SummaryScreen
                selectedProject={selectedProject}
                evidences={evidences}
                filterDate={filterDate}
                filterTech={filterTech}
                filterField={filterField}
                onFilterDate={setFilterDate}
                onFilterTech={setFilterTech}
                onFilterField={setFilterField}
                onBack={() => setCurrentStep('history')}
                onExportExcel={() => exportService.generateExcel(selectedProject.id!)}
                onExportPdf={() => exportService.generatePDF(selectedProject.id!)}
              />
            )}

            {currentStep === 'setup' && editingProject && (
              <SetupScreen
                editingProject={editingProject}
                unlockedSettings={unlockedSettings}
                onChange={setEditingProject}
                onToggleUnlock={(key) => setUnlockedSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                onSave={handleSaveProject}
                onBack={() => setCurrentStep('home')}
                onRequestDeleteField={(index) => setConfirmDelete({ type: 'field', index })}
                toTitleCase={toTitleCase}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CAMERA full-screen OUTSIDE invisible wrapper — required for toBack preview + visible controls */}
      {currentStep === 'camera' && selectedProject && (
        <CameraScreen
          selectedProject={selectedProject}
          isProcessing={isProcessing}
          lastImage={lastImage}
          onCapture={captureBatchPhoto}
          onClose={() => setCurrentStep('history')}
          onOpenGallery={() => { void cameraService.openFieldTraceAlbum(true); }}
          onOpenQuickConfig={() => setShowQuickConfig(true)}
        />
      )}

      <AnimatePresence>
        {showLastImage && lastImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
            onClick={() => setShowLastImage(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl h-full flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lastImage} className="w-full h-full object-contain" alt="Last Preview" />
              <button 
                onClick={() => setShowLastImage(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-black/40 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-6 right-6 text-center space-y-3">
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Ultima foto capturada</p>
                 <button
                   type="button"
                   onClick={() => { void cameraService.openFieldTraceAlbum(); }}
                   className="w-full py-3.5 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest"
                 >
                   Abrir galeria / album Field Trace
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2">¿Confirmar Eliminación?</h3>
              <p className="text-sm text-gray-500 font-medium mb-8">
                {confirmDelete.type === 'field' 
                  ? '¿Eliminar este campo personalizado?'
                  : confirmDelete.type === 'evidence'
                  ? '¿Eliminar este registro? La foto en el álbum Field Trace no se eliminará automáticamente.'
                  : '¿Eliminar este proyecto?'}
              </p>
              <div className="flex gap-4">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase">Cancelar</button>
                <button 
                  onClick={async () => {
                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {
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
                      } catch (e) { console.error(e); }
                    }
                    setConfirmDelete(null);
                  }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold uppercase"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

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
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Tecnico</p>
                <p className="text-sm font-bold text-gray-900 uppercase">{viewingEvidence.baseFields?.tecnico || '-'}</p>
              </div>
              <p className="text-center text-[10px] text-gray-400 pt-2">La foto real esta en Galeria</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
