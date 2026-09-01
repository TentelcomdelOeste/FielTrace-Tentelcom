/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
  Unlock
} from 'lucide-react';
import { AutoResizingTextarea } from './components/AutoResizingTextarea';
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

function getFormattedLocationText(loc: any, selectedProject: any): string {
  if (!loc) return "Buscando...";
  let text = "";
  const format = selectedProject?.locationFormat || 'completa';

  if (format === 'completa') {
    const parts = loc.completa.split(',');
    text = parts.slice(0, 3).join(',').trim();
  } else if (format === 'distrito-canton') {
    text = `${loc.suburb || ''}, ${loc.city || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'ciudad-provincia') {
    text = `${loc.city || ''}, ${loc.state || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'personalizado') {
    const p = selectedProject.customLocationFormat || { road: true, suburb: true, city: true, state: true };
    const parts = [];
    if (p.road && loc.road) parts.push(loc.road);
    if (p.suburb && loc.suburb) parts.push(loc.suburb);
    if (p.city && loc.city) parts.push(loc.city);
    if (p.state && loc.state) parts.push(loc.state);
    text = parts.join(', ');
  }

  return text || "Ubicación detectada";
}

const formatDateTime = (format: 'format1' | 'format2') => {
  const now = new Date();
  if (format === 'format2') {
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

const LiveLocationOverlay = memo(({ selectedProject }: { selectedProject: any }) => {
  const [locState, setLocState] = useState(locationService.getCurrentState());

  useEffect(() => {
    return locationService.subscribe(() => {
      setLocState(locationService.getCurrentState());
    });
  }, []);

  const { gps, locationData } = locState;
  const formattedLocation = getFormattedLocationText(locationData, selectedProject);

  return (
    <>
      {selectedProject.showGps && (
        <p className={`line-clamp-4 break-words whitespace-pre-wrap ${gps ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
          {gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` : 'SINCAL...'}
        </p>
      )}
      {selectedProject.showLocation && formattedLocation && formattedLocation !== "Buscando..." && (
        <p className="line-clamp-4 break-words whitespace-pre-wrap">{formattedLocation.toUpperCase()}</p>
      )}
    </>
  );
});

// Inside App.tsx
// I will replace the state variables later.
const EvidenceImage = memo(({ photoId, className }: { photoId: string, className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    let observer: IntersectionObserver | null = null;

    const load = async () => {
      const blobUrl = await storageService.getPhotoBlob(photoId);
      if (active && blobUrl) {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      }
    };

    if (imgRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          load();
          observer?.disconnect();
        }
      }, { rootMargin: '100px' });
      observer.observe(imgRef.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (url && url !== objectUrl) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  if (!url) return <div ref={imgRef} className={`${className} bg-gray-100 flex items-center justify-center`}><RefreshCcw className="w-5 h-5 text-gray-300 animate-spin" /></div>;
  return <img ref={imgRef as any} src={url} className={className} alt="Evidencia" />;
});
import Webcam from 'react-webcam';
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
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field', id?: number, index?: number } | null>(null);

  const reversedEvidences = useMemo(() => [...evidences].reverse(), [evidences]);

  // Filters for Summary View
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterTech, setFilterTech] = useState<string>("");
  const [filterField, setFilterField] = useState<string>("");

  const webcamRef = useRef<Webcam>(null);

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
    // Sort by createdAt descending (newest first)
    const sortedProjects = [...allProjects].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    setProjects(sortedProjects);
    
    if (sortedProjects.length === 0) {
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
    }

    // Restore from session storage if available
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

  // Keep sessionStorage in sync
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
    
    // Normalize data
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
    // After saving, go directly to camera
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
      let rawImage: string | null = null;
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        rawImage = await cameraService.takePhoto();
      } else {
        if (!webcamRef.current) {
          setIsProcessing(false);
          return;
        }
        rawImage = webcamRef.current.getScreenshot();
      }

      if (!rawImage) {
        console.error('No se pudo capturar la imagen');
        setIsProcessing(false);
        return;
      }

      // Feedback visual rápido INMEDIATO
      const pulse = document.getElementById('camera-pulse');
      if (pulse) {
        pulse.classList.add('bg-white/60');
        setTimeout(() => pulse.classList.remove('bg-white/60'), 150);
      }
      
      // Liberar cámara instantáneamente para siguiente ráfaga
      setIsProcessing(false);

      const { gps, locationData } = locationService.getCurrentState();
      const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
      const ubicacionText = currentFormattedLocation && currentFormattedLocation !== "Buscando..." 
        ? currentFormattedLocation 
        : "Pendiente de geocodificación";

      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'ev_' + Date.now() + Math.random().toString(36).substr(2, 9);
      const fileName = `FT_${uuid}.jpg`;
      const capturedAt = new Date();
      const timestamp = capturedAt.getTime();
      const fecha = capturedAt.toLocaleDateString('es-ES');
      const hora = capturedAt.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });

      const customFieldsSnapshot = selectedProject.customFields.map(f => ({ ...f }));

      // Objeto ÚNICO de metadatos/evidencia unificado (del cual se derivan overlay y IndexedDB)
      const evidenceObject: any = {
        uuid,
        projectId: selectedProject.id!,
        projectName: selectedProject.name,
        photoPath: fileName,
        photo: {
          fileName,
          createdAt: capturedAt
        },
        capturedAt,
        fecha,
        hora,
        timestamp,
        latitude: gps?.lat || 0,
        longitude: gps?.lon || 0,
        gpsAccuracy: gps?.accuracy,
        gpsCapturedAt: capturedAt,
        ubicacion: ubicacionText,
        baseFields: { 
          tecnico: selectedProject.techName || "TECNICO" 
        },
        customFields: customFieldsSnapshot,
        sharedWhatsApp: false,
        createdAt: capturedAt,
        locked: true,
        syncStatus: 'pending',
        retryCount: 0,
        // Propiedades auxiliares para el overlay
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

      // Procesamiento asíncrono atómico
      (async () => {
        try {
          // 1. Generar overlay utilizando el objeto unificado
          const finalImage = await cameraService.drawOverlay(rawImage, evidenceObject);
          if (!finalImage) {
             throw new Error("Error procesando overlay");
          }
          setLastImage(finalImage);
          
          // 2. Guardar fotografía en galería PRIMERO (Guardado atómico)
          const savedToGallerySuccess = await cameraService.saveToGallery(finalImage, fileName);
          if (!savedToGallerySuccess) {
            console.error("[AtomicCapture] Error: No se pudo guardar la fotografía en la galería. Abortando registro de evidencia.");
            return;
          }

          // 3. Guardar Evidence en IndexedDB solo tras confirmar éxito de fotografía
          await storageService.addEvidence(evidenceObject, finalImage);

          // 4. Actualizar estado de UI
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

  const shareNative = async () => {
    if (!lastImage || !selectedProject) return;
    const { gps, locationData } = locationService.getCurrentState();
    const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
    await shareService.sharePhoto(
      'Evidencia de Campo',
      `Proyecto: ${selectedProject.name}\nGPS: ${gps?.lat}, ${gps?.lon}\nUbicación: ${currentFormattedLocation}`,
      lastImage
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
          <AnimatePresence mode="wait">
            {/* HOME VIEW */}
            {currentStep === 'home' && (
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
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent flex-1 outline-none text-xs font-black uppercase tracking-tighter placeholder:text-gray-300 pr-8"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm("")}
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
                    <button onClick={handleCreateProject} className="text-blue-600 font-bold text-xs uppercase tracking-tighter hover:bg-blue-50 px-3 py-1 rounded-lg">+ Nuevo Proyecto</button>
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
                  ))}
                </div>
              </motion.div>
            )}

            {/* HISTORY VIEW */}
            {currentStep === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-7 pt-4"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrentStep('home')} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100 shrink-0"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">{selectedProject?.name}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest cursor-pointer hover:text-blue-600 flex items-center gap-1 shrink-0" onClick={() => handleEditProject(selectedProject!)}>
                        Configurar <Settings className="w-3 h-3" />
                      </p>
                      <span className="text-gray-200">|</span>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest cursor-pointer hover:text-blue-800 flex items-center gap-1 shrink-0" onClick={() => setCurrentStep('summary')}>
                        Resumen <BarChart3 className="w-3 h-3" />
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCurrentStep('camera')}
                    disabled={isProcessing}
                    className="w-12 h-12 bg-blue-600 text-white shadow-[0_8px_20px_-4px_rgba(37,99,235,0.5)] rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <CameraIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => exportService.generateExcel(selectedProject!.id!)}
                    className="py-4 bg-[#ECFDF5] border border-green-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm"
                   >
                     <FileSpreadsheet className="w-6 h-6 text-green-600"/>
                     <span className="text-[9px] font-black text-green-800 uppercase">Excel (.xlsx)</span>
                   </button>
                   <button 
                    onClick={() => exportService.generatePDF(selectedProject!.id!)}
                    className="py-4 bg-[#FEF2F2] border border-red-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm"
                   >
                     <FileText className="w-6 h-6 text-red-600"/>
                     <span className="text-[9px] font-black text-red-800 uppercase">PDF Report</span>
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-20">
                  {evidences.length === 0 ? (
                    <div className="col-span-2 py-20 text-center space-y-4">
                       <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><CameraIcon className="w-10 h-10 text-gray-200" /></div>
                       <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">No hay registros<br/>técnicos capturados</p>
                    </div>
                  ) : (
                    reversedEvidences.map((ev) => (
                      <motion.div 
                        layoutId={`ev-${ev.id}`}
                        key={ev.id} 
                        onClick={() => {
                          // Allow viewing old photo in modal
                          storageService.getPhotoBlob(ev.photoPath).then(url => {
                            if (url) {
                              setLastImage(url);
                              setShowLastImage(true);
                            }
                          });
                        }}
                        className="aspect-[4/5] rounded-[2rem] overflow-hidden border border-gray-100 relative group shadow-sm bg-white cursor-pointer"
                      >
                        <EvidenceImage photoId={ev.photoPath} className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3 flex gap-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-xl px-3 py-2 rounded-xl">
                           <p className="text-[8px] text-white font-black uppercase truncate tracking-tighter">{ev.baseFields.posteId}</p>
                           <p className="text-[6px] text-white/60 font-mono italic">{ev.fecha}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* CAMERA VIEW (OPERATIONAL FOCUS) */}
            {currentStep === 'camera' && selectedProject && (
              <motion.div 
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black z-50 flex flex-col"
              >
                {/* Real-time Camera Bridge */}
                <div className="relative flex-1 bg-gray-950 overflow-hidden">
                  {Capacitor.isNativePlatform() ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center space-y-4">
                      <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center border-2 border-blue-500/50 animate-pulse">
                        <CameraIcon className="w-10 h-10 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold">Cámara Nativa Android</h3>
                      <p className="text-sm text-gray-400 max-w-xs">
                        Presiona el botón inferior de captura para abrir la cámara nativa, tomar la foto y aplicar el overlay técnico.
                      </p>
                    </div>
                  ) : (
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ 
                        facingMode: "environment",
                        width: { ideal: 4096 },
                        height: { ideal: 2160 }
                      }}
                      className="w-full h-full object-cover"
                      mirrored={false}
                      forceScreenshotSourceSize={true}
                      imageSmoothing={true}
                      disablePictureInPicture={true}
                      screenshotQuality={0.92}
                      onUserMedia={() => console.log('Camera ready')}
                      onUserMediaError={(err) => console.error('Camera error', err)}
                    />
                  )}
                  
                  {/* Flash Feedback Layer */}
                  <div id="camera-pulse" className="absolute inset-0 pointer-events-none transition-colors duration-100"></div>

                  {/* Real-time Metadata Overlay (Mirrors Captured Overlay) */}
                  <div className={`absolute pointer-events-none flex flex-col ${
                    selectedProject.overlayPosition === 'top-left' ? 'top-0 left-0 items-start' :
                    selectedProject.overlayPosition === 'top-right' ? 'top-0 right-0 items-end text-right' :
                    selectedProject.overlayPosition === 'bottom-left' ? 'bottom-0 left-0 items-start' :
                    'bottom-0 right-0 items-end text-right'
                  }`} style={{ padding: '4%', maxWidth: '100%' }}>
                    {selectedProject.logoImage && ((selectedProject.logoPosition || 'top-left') === selectedProject.overlayPosition) && (
                      <img 
                         src={selectedProject.logoImage} 
                         alt="Logo" 
                         className="mb-2 object-contain shrink-0" 
                         style={{ 
                           width: `${selectedProject.logoSize || 20}vw`,
                           height: 'auto',
                           opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8
                         }}
                      />
                    )}

                    <div className="space-y-0.5 font-mono leading-tight" style={{ 
                      color: selectedProject.overlayColor || '#FFFFFF',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      fontSize: selectedProject.fontSizeValue 
                        ? `${selectedProject.fontSizeValue / 10}vw` 
                        : (selectedProject.fontSizeScale === 'small' ? '2vw' :
                           selectedProject.fontSizeScale === 'large' ? '4vw' :
                           '3vw'),
                      lineHeight: '1.4',
                       maxWidth: (selectedProject.logoImage && ((selectedProject.overlayPosition?.includes('top') && (selectedProject.logoPosition || 'top-left').includes('top') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')) || (selectedProject.overlayPosition?.includes('bottom') && (selectedProject.logoPosition || 'top-left').includes('bottom') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')))) ? `calc(100vw - 8vw - ${selectedProject.logoSize || 20}vw - 4vw)` : `calc(100vw - 8vw)`
                    }}>
                       <p className="line-clamp-4 break-words whitespace-pre-wrap">{selectedProject.name.toUpperCase()}</p>
                       {selectedProject.showDateTime && <p className="line-clamp-4 break-words whitespace-pre-wrap">{formatDateTime(selectedProject.dateTimeFormat)}</p>}
                       
                       <LiveLocationOverlay selectedProject={selectedProject} />
                       
                       {selectedProject.showTech && <p className="line-clamp-4 break-words whitespace-pre-wrap">{selectedProject.techName.toUpperCase()}</p>}
                       
                       {/* Dynamic Custom Fields */}
                       {selectedProject.customFields.filter(f => f.active !== false && f.showInPhoto && (f.name.trim() !== '' || f.value.trim() !== '')).map((f, i) => (
                         <p key={i} className="line-clamp-4 break-words whitespace-pre-wrap">{f.value && f.value.trim() !== '' ? `${f.name.toUpperCase()}: ${f.value.toUpperCase()}` : f.name.toUpperCase()}</p>
                       ))}
                    </div>

                    {/* Handle logo when it's NOT in the same corner as text, by placing it absolutely */}
                  </div>
                  {selectedProject.logoImage && (selectedProject.logoPosition || 'top-left') !== selectedProject.overlayPosition && (
                     <div className={`absolute pointer-events-none ${
                        (selectedProject.logoPosition || 'top-left') === 'top-left' ? 'top-0 left-0' :
                        (selectedProject.logoPosition || 'top-left') === 'top-right' ? 'top-0 right-0' :
                        (selectedProject.logoPosition || 'top-left') === 'bottom-left' ? 'bottom-0 left-0' :
                        'bottom-0 right-0'
                     }`} style={{ padding: '4%', maxWidth: '100%' }}>
                        <img 
                           src={selectedProject.logoImage} 
                           alt="Logo" 
                           className="object-contain" 
                           style={{ 
                             width: `${selectedProject.logoSize || 20}vw`,
                             height: 'auto',
                             opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8
                           }}
                        />
                     </div>
                  )}

                  {/* Quick Config Float (Draggable) */}
                  <motion.button 
                    drag
                    dragMomentum={false}
                    onClick={() => setShowQuickConfig(true)}
                    className="absolute top-6 left-6 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white z-50 transition-colors hover:bg-black/50 shadow-2xl touch-none"
                  >
                    <Settings className="w-5 h-5 pointer-events-none" />
                  </motion.button>
                </div>

                {/* Shutter Bar */}
                <div className="h-[120px] bg-black flex items-center justify-between px-8 shrink-0">
                  <button onClick={() => setCurrentStep('history')} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white">
                    <ArrowLeft className="w-6 h-6"/>
                  </button>
                  
                  <button 
                    onClick={captureBatchPhoto}
                    disabled={isProcessing}
                    className="w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform"
                  >
                    <div className="w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center">
                       {isProcessing ? <RefreshCcw className="w-6 h-6 text-blue-600 animate-spin"/> : <div className="w-10 h-10 border-4 border-gray-100 rounded-full"></div>}
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      if (lastImage) {
                         setShowLastImage(true);
                      }
                    }} 
                    className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white"
                  >
                    {lastImage ? (
                      <img src={lastImage} className="w-full h-full object-contain" />
                    ) : (
                      <History className="w-7 h-7 opacity-40"/>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

              {/* SUMMARY VIEW (PROJECT DASHBOARD) */}
            {currentStep === 'summary' && selectedProject && (
              <motion.div 
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 pt-4 pb-10"
              >
                <div className="flex items-center gap-5">
                  <button onClick={() => setCurrentStep('history')} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">Resumen de Datos</h2>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{selectedProject.name}</p>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Evidencias</p>
                    <h4 className="text-4xl font-black tracking-tighter text-blue-600">{evidences.length}</h4>
                    <BarChart3 className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-blue-600" />
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Último Registro</p>
                    <h4 className="text-lg font-black tracking-tighter text-gray-950">{evidences[evidences.length-1]?.fecha || 'N/A'}</h4>
                    <Calendar className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-gray-950" />
                  </div>
                </div>

                {/* Filters Section */}
                <div className="bg-[#F8FAFC] p-6 rounded-[2.5rem] border border-gray-100 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Filtros Activos</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Fecha</label>
                        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Técnico</label>
                        <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                          <option value="">TODOS</option>
                          {(Array.from(new Set(evidences.map(e => e.baseFields.tecnico).filter(Boolean))) as string[]).map(t => (
                            <option key={t} value={t}>{t.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Material / Campo</label>
                      <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                          <option value="">TODOS LOS CAMPOS</option>
                          {selectedProject.customFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name.toUpperCase()}</option>
                          ))}
                      </select>
                   </div>
                </div>

                {/* Materials Summary */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Resumen de Materiales</h3>
                    <div className="flex gap-2">
                       <button onClick={() => exportService.generateExcel(selectedProject.id!)} className="p-2 bg-green-50 text-green-600 rounded-lg"><FileSpreadsheet className="w-4 h-4" /></button>
                       <button onClick={() => exportService.generatePDF(selectedProject.id!)} className="p-2 bg-red-50 text-red-600 rounded-lg"><FileText className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {(() => {
                      const filteredEvidences = evidences.filter(e => {
                        if (filterDate && e.fecha !== new Date(filterDate).toLocaleDateString()) return false;
                        if (filterTech && e.baseFields.tecnico !== filterTech) return false;
                        return true;
                      });

                      const materialTotals: Record<string, number> = {};
                      filteredEvidences.forEach(e => {
                        e.customFields.forEach(f => {
                          if (filterField && f.name !== filterField) return;
                          const val = parseFloat(f.value.replace(/[^0-9.-]+/g, ""));
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
            )}

            {/* SETUP VIEW (PROJECT CONFIGURATION) */}
            {currentStep === 'setup' && editingProject && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 pt-4"
              >
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentStep('home')} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5"/></button>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Configuración</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre del Proyecto</label>
                    <input 
                      type="text" 
                      value={editingProject.name || ''}
                      onChange={(e) => setEditingProject({...editingProject, name: e.target.value.toUpperCase()})}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" 
                      placeholder="Ej: Mantenimiento Sector Sur"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cliente</label>
                    <input 
                      type="text" 
                      value={editingProject.client || ''}
                      onChange={(e) => setEditingProject({...editingProject, client: e.target.value.toUpperCase()})}
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
                        onChange={(e) => setEditingProject({...editingProject, techName: toTitleCase(e.target.value)})}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" 
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tipo</label>
                      <select 
                        value={editingProject.type || ''}
                        onChange={(e) => setEditingProject({...editingProject, type: e.target.value})}
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
                            onChange={(e) => setEditingProject({...editingProject, [field.key]: e.target.checked})}
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
                            onChange={(e) => setEditingProject({...editingProject, dateTimeFormat: e.target.value as any})}
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
                          onChange={(e) => setEditingProject({...editingProject, locationFormat: e.target.value as any})}
                          className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                        >
                          <option value="completa">Completa (Simplificada)</option>
                          <option value="distrito-canton">Distrito + Cantón</option>
                          <option value="ciudad-provincia">Ciudad + Provincia</option>
                          <option value="personalizado">Personalizado</option>
                        </select>
                      </div>

                      {editingProject.locationFormat === 'personalizado' && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-white/50 p-3 rounded-xl">
                          {[
                            { key: 'road', label: 'Calle' },
                            { key: 'suburb', label: 'Distrito' },
                            { key: 'city', label: 'Cantón' },
                            { key: 'state', label: 'Provincia' },
                          ].map((l) => (
                            <label key={l.key} className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={!!editingProject.customLocationFormat?.[l.key as keyof typeof editingProject.customLocationFormat]}
                                onChange={(e) => setEditingProject({
                                  ...editingProject, 
                                  customLocationFormat: {
                                    ...(editingProject.customLocationFormat || { road: true, suburb: true, city: true, state: true }),
                                    [l.key]: e.target.checked
                                  }
                                })}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-[10px] font-bold text-gray-600">{l.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-blue-100">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] font-black uppercase text-blue-400">Color de Texto Overlay</label>
                      </div>
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
                            onClick={() => setEditingProject({...editingProject, overlayColor: c.color})}
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
                            onChange={(e) => setEditingProject({...editingProject, overlayPosition: e.target.value as any})}
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
                            onChange={(e) => setEditingProject({...editingProject, fontSizeScale: e.target.value as any})}
                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                          >
                            <option value="small">Pequeño</option>
                            <option value="medium">Mediano</option>
                            <option value="large">Grande</option>
                          </select>
                        </div>
                        <div className="col-span-2 space-y-2 mt-1">
                           <div className="flex justify-between items-center">
                             <label className="text-[9px] font-black uppercase text-blue-400">Ajuste Manual Preciso</label>
                             <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => setUnlockedSettings(prev => ({...prev, fontSize: !prev.fontSize}))}
                                 className={`p-1 rounded transition-colors ${unlockedSettings.fontSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                               >
                                 {unlockedSettings.fontSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                               </button>
                               <span className="text-[10px] font-bold text-blue-600">{editingProject.fontSizeValue || 30}</span>
                             </div>
                           </div>
                           <input 
                             type="range"
                             disabled={!unlockedSettings.fontSize}
                             min="10"
                             max="100"
                             step="1"
                             value={editingProject.fontSizeValue || 30}
                             onChange={(e) => setEditingProject({...editingProject, fontSizeValue: parseInt(e.target.value)})}
                             className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.fontSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                           />
                        </div>

                        <div className="space-y-1 col-span-2 mt-4 pt-4 border-t border-blue-50">
                          <label className="text-[9px] font-black uppercase text-blue-400">Logo adicional en foto</label>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setEditingProject({...editingProject, logoImage: reader.result as string, logoPosition: editingProject.logoPosition || 'top-left', logoSize: editingProject.logoSize || 20, logoOpacity: editingProject.logoOpacity !== undefined ? editingProject.logoOpacity : 80});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full text-xs font-bold text-blue-800 border p-2 rounded bg-white"
                          />
                          {editingProject.logoImage && (
                            <div className="flex items-center gap-4 mt-3">
                              <img src={editingProject.logoImage} alt="Logo" className="h-10 object-contain rounded" />
                              <button onClick={() => setEditingProject({...editingProject, logoImage: null})} className="text-white bg-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest shadow-sm">
                                ELIMINAR LOGO
                              </button>
                            </div>
                          )}
                        </div>

                        {editingProject.logoImage && (
                          <>
                            <div className="space-y-1 col-span-2">
                              <label className="text-[9px] font-black uppercase text-blue-400">Posición Logo</label>
                              <select 
                                value={editingProject.logoPosition || 'top-left'}
                                onChange={(e) => setEditingProject({...editingProject, logoPosition: e.target.value as any})}
                                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                              >
                                <option value="top-left">Arriba Izq.</option>
                                <option value="top-right">Arriba Der.</option>
                                <option value="bottom-left">Abajo Izq.</option>
                                <option value="bottom-right">Abajo Der.</option>
                              </select>
                            </div>
                            
                            <div className="space-y-2 mt-1 col-span-2">
                               <div className="flex justify-between items-center">
                                 <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Logo</label>
                                 <div className="flex items-center gap-2">
                                   <button 
                                     onClick={() => setUnlockedSettings(prev => ({...prev, logoSize: !prev.logoSize}))}
                                     className={`p-1 rounded transition-colors ${unlockedSettings.logoSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                   >
                                     {unlockedSettings.logoSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                   </button>
                                   <span className="text-[10px] font-bold text-blue-600">{editingProject.logoSize || 20}%</span>
                                 </div>
                               </div>
                               <input 
                                 type="range"
                                 disabled={!unlockedSettings.logoSize}
                                 min="5"
                                 max="80"
                                 step="1"
                                 value={editingProject.logoSize || 20}
                                 onChange={(e) => setEditingProject({...editingProject, logoSize: parseInt(e.target.value)})}
                                 className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                               />
                            </div>

                            <div className="space-y-2 mt-1 col-span-2">
                               <div className="flex justify-between items-center">
                                 <label className="text-[9px] font-black uppercase text-blue-400">Opacidad Logo</label>
                                 <div className="flex items-center gap-2">
                                   <button 
                                     onClick={() => setUnlockedSettings(prev => ({...prev, logoOpacity: !prev.logoOpacity}))}
                                     className={`p-1 rounded transition-colors ${unlockedSettings.logoOpacity ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                   >
                                     {unlockedSettings.logoOpacity ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                   </button>
                                   <span className="text-[10px] font-bold text-blue-600">{editingProject.logoOpacity ?? 80}%</span>
                                 </div>
                               </div>
                               <input 
                                 type="range"
                                 disabled={!unlockedSettings.logoOpacity}
                                 min="0"
                                 max="100"
                                 step="1"
                                 value={editingProject.logoOpacity ?? 80}
                                 onChange={(e) => setEditingProject({...editingProject, logoOpacity: parseInt(e.target.value)})}
                                 className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoOpacity ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                               />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Campos Personalizados</p>
                      <button 
                        onClick={() => setEditingProject({
                          ...editingProject, 
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
                              setEditingProject({...editingProject, customFields: newFields});
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
                              setEditingProject({...editingProject, customFields: newFields});
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
                              setEditingProject({...editingProject, customFields: newFields});
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                            title="Campo Activo"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete({ type: 'field', index: idx })}
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
                  onClick={handleSaveProject}
                  className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
                >
                  Guardar y Abrir Cámara
                </button>
              </motion.div>
            )}

            {/* SUCCESS VIEW - REMOVED PER INSTRUCTION, BUT KEPT PLACEHOLDER IF NEEDED */}
          </AnimatePresence>
        </div>

        {/* Global Action Bar */}
        <div className="absolute bottom-10 left-6 right-6 z-40">
           {/* Global Action Bar content can go here if needed in the future */}
        </div>
      </div>

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
              drag="y"
              dragConstraints={{ top: 0, bottom: 200 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowLastImage(false);
              }}
              className="relative w-full max-w-4xl h-full flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl md:border-4 md:border-white/10 bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lastImage} className="w-full h-full object-contain" alt="Last Preview" />
              <button 
                onClick={() => setShowLastImage(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-black/40 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 active:scale-90 transition-transform z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-8 right-8 text-center pointer-events-none">
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-1 shadow-sm">Evidencia Capturada</p>
                 <p className="text-[12px] text-white font-black uppercase tracking-tighter shadow-sm">Vista Rápida Pre-Sincronización</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickConfig && selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              storageService.updateProject(selectedProject.id!, selectedProject);
              setShowQuickConfig(false);
            }}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-lg bg-white rounded-t-[3rem] p-8 shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
              
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tighter">Campos Operativos</h3>
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ajustes rápidos de captura</p>
                </div>
                <button 
                  onClick={() => {
                    const newFields = [...selectedProject.customFields, { name: '', value: '', showInPhoto: true, active: true }];
                    const updated = { ...selectedProject, customFields: newFields };
                    setSelectedProject(updated);
                  }}
                  className="p-3 bg-blue-50 text-blue-600 rounded-2xl active:scale-90 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-8">
                {selectedProject.customFields.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No hay campos dinámicos</p>
                  </div>
                )}
                {selectedProject.customFields.map((cf, idx) => (
                  <div key={idx} className={`p-2.5 rounded-2xl border transition-all ${cf.active !== false ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex gap-2">
                        <AutoResizingTextarea
                          value={cf.name || ''} 
                          onChange={(e: any) => {
                            const newFields = [...selectedProject.customFields];
                            newFields[idx].name = e.target.value;
                            setSelectedProject({...selectedProject, customFields: newFields});
                          }}
                          className="bg-transparent font-black text-[11px] uppercase tracking-tighter w-full outline-none border-b border-transparent focus:border-blue-400 resize-none overflow-hidden"
                          placeholder="NOMBRE CAMPO"
                        />
                        <input 
                          type="number"
                          value={cf.value || ''} 
                          onChange={(e) => {
                            const newFields = [...selectedProject.customFields];
                            newFields[idx].value = e.target.value;
                            setSelectedProject({...selectedProject, customFields: newFields});
                          }}
                          className="bg-white px-2 py-1.5 rounded-lg font-mono text-[11px] w-16 shrink-0 shadow-sm border border-gray-100 focus:border-blue-400 outline-none"
                          placeholder="CANT"
                        />
                      </div>
                      
                      <button 
                        onClick={() => {
                          const newFields = [...selectedProject.customFields];
                          newFields[idx].active = !newFields[idx].active;
                          setSelectedProject({...selectedProject, customFields: newFields});
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                      >
                         <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => setConfirmDelete({ type: 'field', index: idx })}
                        className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-90 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => {
                    storageService.updateProject(selectedProject.id!, selectedProject);
                    setShowQuickConfig(false);
                  }}
                  className="flex-1 py-5 bg-gray-950 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  Volver a Cámara
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
                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
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
                    }
                    setConfirmDelete(null);
                  }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-500/30"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
