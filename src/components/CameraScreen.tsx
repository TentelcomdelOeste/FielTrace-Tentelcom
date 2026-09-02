import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { motion } from 'framer-motion';
import { ArrowLeft, History, Settings, Zap, ZapOff, ZoomIn, RefreshCcw, AlertTriangle } from 'lucide-react';
import { LiveLocationOverlay } from './LiveLocationOverlay';
import { locationService } from '../services/locationService';

interface CameraScreenProps {
  selectedProject: any;
  isProcessing: boolean;
  lastImage: string | null;
  onCapture: () => void;
  onClose: () => void;
  onOpenGallery: () => void;
  onOpenQuickConfig: () => void;
}

export function CameraScreen({
  selectedProject,
  isProcessing,
  lastImage,
  onCapture,
  onClose,
  onOpenGallery,
  onOpenQuickConfig,
}: CameraScreenProps) {
  const [cameraZoom, setCameraZoom] = useState(1);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [starting, setStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [gearPosition, setGearPosition] = useState({ x: 24, y: 24 });
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  const gearDragging = useRef(false);
  const gearMoved = useRef(false);
  const gearPointerOffset = useRef({ x: 0, y: 0 });

  const applyNativeZoom = async (level: number) => {
    const next = Math.max(1, Math.min(8, Math.round(level * 10) / 10));
    setCameraZoom(next);
    try {
      await CameraPreview.setZoom({ level: next });
    } catch (error) {
      console.warn('[Camera] zoom:', error);
    }
  };

  const cycleZoom = () => {
    const next = cameraZoom >= 3 ? 1 : cameraZoom >= 2 ? 3 : 2;
    void applyNativeZoom(next);
  };

  const startLocationFlow = async () => {
    try {
      const granted = await locationService.checkAndRequestPermissions();
      if (granted) {
        void locationService.getCurrentPosition();
      }
    } catch (error) {
      console.warn('[GPS] camera permission flow:', error);
    }
  };

  const startCamera = async () => {
    setStarting(true);
    setCameraError(null);

    try {
      // Location permission is requested first so Android shows the GPS
      // permission when the camera is entered, without waiting for a GPS fix.
      await startLocationFlow();
      await CameraPreview.stop({ force: true }).catch(() => undefined);

      const permission = await CameraPreview.requestPermissions({
        disableAudio: true,
        showSettingsAlert: true,
        title: 'Permiso de cámara',
        message: 'Field Trace necesita acceso a la cámara para capturar evidencias.',
        openSettingsButtonTitle: 'Abrir ajustes',
        cancelButtonTitle: 'Cancelar',
      });

      if (permission.camera !== 'granted') {
        throw new Error('El permiso de cámara no está concedido.');
      }

      await CameraPreview.start({
        position: 'rear',
        toBack: true,
        aspectRatio: 'fill',
        aspectMode: 'cover',
        x: 0,
        y: 0,
        storeToFile: true,
        disableAudio: true,
        initialZoomLevel: 1,
        rotateWhenOrientationChanged: true,
      });

      await CameraPreview.setAspectRatio({ aspectRatio: 'fill', x: 0, y: 0 });
      await CameraPreview.setFlashMode({ flashMode: 'off' });
      await CameraPreview.setZoom({ level: 1 });

      setFlashMode('off');
      setCameraZoom(1);
      setStarting(false);
    } catch (error: any) {
      console.error('[Camera] start:', error);
      setStarting(false);
      setCameraError(error?.message || 'No se pudo iniciar la cámara.');
    }
  };

  useEffect(() => {
    document.documentElement.classList.add('native-camera-active');
    void startCamera();

    return () => {
      document.documentElement.classList.remove('native-camera-active');
      void CameraPreview.stop({ force: true }).catch((error) =>
        console.warn('[Camera] stop:', error)
      );
    };
    // Camera is intentionally started only once per screen mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (starting || cameraError) return;
    void CameraPreview.setFlashMode({ flashMode }).catch((error) =>
      console.warn('[Camera] flash:', error)
    );
  }, [flashMode, starting, cameraError]);

  const handleGearPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    gearDragging.current = true;
    gearMoved.current = false;
    gearPointerOffset.current = {
      x: event.clientX - gearPosition.x,
      y: event.clientY - gearPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleGearPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!gearDragging.current) return;
    event.preventDefault();
    const nextX = Math.max(8, Math.min(window.innerWidth - 48, event.clientX - gearPointerOffset.current.x));
    const nextY = Math.max(8, Math.min(window.innerHeight - 48, event.clientY - gearPointerOffset.current.y));
    if (Math.abs(nextX - gearPosition.x) > 3 || Math.abs(nextY - gearPosition.y) > 3) {
      gearMoved.current = true;
    }
    setGearPosition({ x: nextX, y: nextY });
  };

  const handleGearPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    gearDragging.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_) {}
  };

  const handleGearClick = () => {
    if (gearMoved.current) {
      gearMoved.current = false;
      return;
    }
    onOpenQuickConfig();
  };

  const overlayPositionClass =
    selectedProject.overlayPosition === 'top-left'
      ? 'top-0 left-0 items-start'
      : selectedProject.overlayPosition === 'top-right'
      ? 'top-0 right-0 items-end text-right'
      : selectedProject.overlayPosition === 'bottom-left'
      ? 'bottom-0 left-0 items-start'
      : 'bottom-0 right-0 items-end text-right';

  const fontSizeStyle = selectedProject.fontSizeValue
    ? `${selectedProject.fontSizeValue / 10}vw`
    : selectedProject.fontSizeScale === 'small'
    ? '2vw'
    : selectedProject.fontSizeScale === 'large'
    ? '4vw'
    : '3vw';

  return (
    <motion.div
      key="camera"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-transparent z-50 flex flex-col"
      style={{ touchAction: 'none' }}
    >
      <div
        className="relative flex-1 min-h-0 bg-transparent overflow-hidden"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDist.current = Math.hypot(dx, dy);
            pinchStartZoom.current = cameraZoom;
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchStartDist.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            void applyNativeZoom(
              Math.max(1, Math.min(8, pinchStartZoom.current * (distance / pinchStartDist.current)))
            );
          }
        }}
        onTouchEnd={() => {
          pinchStartDist.current = null;
        }}
      >
        <div className="absolute inset-0 bg-transparent pointer-events-none" aria-hidden="true" />
        <div id="camera-pulse" className="absolute inset-0 pointer-events-none transition-colors duration-100" />

        <div
          className={`absolute pointer-events-none flex flex-col ${overlayPositionClass}`}
          style={{ padding: '4%', maxWidth: '100%' }}
        >
          {selectedProject.logoImage &&
            (selectedProject.logoPosition || 'top-left') === selectedProject.overlayPosition && (
              <img
                src={selectedProject.logoImage}
                alt="Logo"
                className="mb-2 object-contain shrink-0"
                style={{
                  width: `${selectedProject.logoSize || 20}vw`,
                  height: 'auto',
                  opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8,
                }}
              />
            )}

          <div
            className="space-y-0.5 font-mono leading-tight"
            style={{
              color: selectedProject.overlayColor || '#FFFFFF',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              fontSize: fontSizeStyle,
              lineHeight: '1.4',
              maxWidth: 'calc(100vw - 8vw)',
            }}
          >
            {selectedProject.name && <p className="line-clamp-2 break-words font-bold uppercase">{selectedProject.name}</p>}
            {selectedProject.showDateTime && (
              <p className="line-clamp-1">
                {new Date().toLocaleString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                })}
              </p>
            )}
            <LiveLocationOverlay selectedProject={selectedProject} />
            {selectedProject.showTech && selectedProject.techName && (
              <p className="line-clamp-1 uppercase">{selectedProject.techName}</p>
            )}
            {(selectedProject.customFields || [])
              .filter((f: any) => f.active !== false && f.showInPhoto)
              .map((f: any, i: number) => (
                <p key={i} className="line-clamp-1 uppercase">{f.name}: {f.value}</p>
              ))}
          </div>
        </div>

        {selectedProject.logoImage &&
          (selectedProject.logoPosition || 'top-left') !== selectedProject.overlayPosition && (
            <div
              className={`absolute pointer-events-none ${(selectedProject.logoPosition || 'top-left').includes('top') ? 'top-0' : 'bottom-0'} ${(selectedProject.logoPosition || 'top-left').includes('right') ? 'right-0' : 'left-0'}`}
              style={{ padding: '4%' }}
            >
              <img
                src={selectedProject.logoImage}
                alt="Logo"
                className="object-contain"
                style={{
                  width: `${selectedProject.logoSize || 20}vw`,
                  height: 'auto',
                  opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8,
                }}
              />
            </div>
          )}

        <button
          type="button"
          onPointerDown={handleGearPointerDown}
          onPointerMove={handleGearPointerMove}
          onPointerUp={handleGearPointerUp}
          onPointerCancel={handleGearPointerUp}
          onClick={handleGearClick}
          className="absolute w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white z-50 active:scale-95 shadow-2xl"
          style={{ left: gearPosition.x, top: gearPosition.y, touchAction: 'none' }}
          aria-label="Campos operativos"
          title="Arrastrar o tocar para abrir"
        >
          <Settings className="w-5 h-5 pointer-events-none" />
        </button>

        <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 items-end">
          <button
            type="button"
            onClick={async () => {
              const next: 'off' | 'on' | 'auto' = flashMode === 'off' ? 'auto' : flashMode === 'auto' ? 'on' : 'off';
              try {
                await CameraPreview.setFlashMode({ flashMode: next });
                setFlashMode(next);
              } catch (error) {
                console.warn('[Camera] flash:', error);
                try {
                  await CameraPreview.setFlashMode({ flashMode: 'off' });
                  setFlashMode('off');
                } catch (fallbackError) {
                  console.warn('[Camera] flash fallback:', fallbackError);
                }
              }
            }}
            className="w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95"
            title="Flash: apagado / automático / al tomar foto"
          >
            {flashMode === 'off' ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5 text-yellow-200" />}
          </button>

          <button
            type="button"
            onClick={cycleZoom}
            className="min-w-10 h-10 px-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white text-[11px] font-black active:scale-95 gap-1"
            title="Zoom"
          >
            <ZoomIn className="w-4 h-4" />
            {cameraZoom % 1 === 0 ? `${cameraZoom}x` : `${cameraZoom.toFixed(1)}x`}
          </button>
        </div>

        {cameraError && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center p-8 bg-black/80">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-red-500" />
              <h3 className="text-base font-black uppercase">No se pudo abrir la cámara</h3>
              <p className="mt-2 text-xs text-gray-500">{cameraError}</p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mt-5 w-full py-3 rounded-2xl bg-gray-950 text-white text-xs font-black uppercase"
              >
                Reintentar cámara
              </button>
            </div>
          </div>
        )}

        {starting && !cameraError && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 pointer-events-none">
            <RefreshCcw className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="h-[120px] shrink-0 bg-black flex items-center justify-between px-8 z-[80]">
        <button
          type="button"
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={onCapture}
          disabled={isProcessing || starting || !!cameraError}
          className="w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform disabled:opacity-50"
          aria-label="Capturar foto"
        >
          <div className="w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center">
            {isProcessing ? <RefreshCcw className="w-6 h-6 text-blue-600 animate-spin" /> : <div className="w-10 h-10 border-4 border-gray-100 rounded-full" />}
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenGallery}
          disabled={!lastImage}
          className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95 disabled:opacity-35 disabled:active:scale-100"
          aria-label={lastImage ? 'Abrir álbum Field Trace' : 'No hay fotos todavía'}
          title={lastImage ? 'Abrir álbum Field Trace' : 'Todavía no hay fotos'}
        >
          {lastImage ? <img src={lastImage} className="w-full h-full object-cover" alt="Ultima foto" /> : <History className="w-7 h-7 opacity-40" />}
        </button>
      </div>
    </motion.div>
  );
}
