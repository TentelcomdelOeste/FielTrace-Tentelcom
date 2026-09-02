/**
 * Native camera screen (preview + controls + live overlay)
 * Extracted from App.tsx — Phase 1
 * MUST be rendered OUTSIDE any parent with Tailwind `invisible`.
 */
import { useState, useEffect, useRef } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { motion } from 'framer-motion';
import { ArrowLeft, History, Settings, Zap, ZapOff, ZoomIn, RefreshCcw } from 'lucide-react';
import { LiveLocationOverlay } from './LiveLocationOverlay';

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
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'torch'>('off');
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);

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

  const onCameraTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = cameraZoom;
    }
  };

  const onCameraTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      void applyNativeZoom(
        Math.max(1, Math.min(8, pinchStartZoom.current * (Math.hypot(dx, dy) / pinchStartDist.current)))
      );
    }
  };

  const onCameraTouchEnd = () => {
    pinchStartDist.current = null;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await CameraPreview.start({
          position: 'rear',
          toBack: true,
          aspectMode: 'cover',
          width: window.innerWidth,
          height: window.innerHeight,
          storeToFile: false,
          disableAudio: true,
          initialZoomLevel: 1,
          rotateWhenOrientationChanged: true,
        });
        if (!active) return;
        await CameraPreview.setFlashMode({ flashMode });
        await CameraPreview.setZoom({ level: cameraZoom });
      } catch (error) {
        console.error('[Camera] start:', error);
      }
    })();
    return () => {
      active = false;
      void CameraPreview.stop({ force: true }).catch((error) =>
        console.warn('[Camera] stop:', error)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void CameraPreview.setFlashMode({ flashMode }).catch((error) =>
      console.warn('[Camera] flash:', error)
    );
  }, [flashMode]);

  useEffect(() => {
    document.documentElement.classList.add('native-camera-active');
    return () => document.documentElement.classList.remove('native-camera-active');
  }, []);

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
    >
      <div
        className="relative flex-1 bg-transparent overflow-hidden"
        onTouchStart={onCameraTouchStart}
        onTouchMove={onCameraTouchMove}
        onTouchEnd={onCameraTouchEnd}
      >
        <div className="absolute inset-0 bg-transparent pointer-events-none" aria-hidden="true" />

        <div
          id="camera-pulse"
          className="absolute inset-0 pointer-events-none transition-colors duration-100"
        />

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
                  opacity:
                    selectedProject.logoOpacity !== undefined
                      ? selectedProject.logoOpacity / 100
                      : 0.8,
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
            {selectedProject.name && (
              <p className="line-clamp-2 break-words font-bold uppercase">{selectedProject.name}</p>
            )}
            {selectedProject.showDateTime && (
              <p className="line-clamp-1">
                {new Date().toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
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
                <p key={i} className="line-clamp-1 uppercase">
                  {f.name}: {f.value}
                </p>
              ))}
          </div>
        </div>

        {selectedProject.logoImage &&
          (selectedProject.logoPosition || 'top-left') !== selectedProject.overlayPosition && (
            <div
              className={`absolute pointer-events-none ${
                (selectedProject.logoPosition || 'top-left').includes('top')
                  ? 'top-0'
                  : 'bottom-0'
              } ${(selectedProject.logoPosition || 'top-left').includes('right') ? 'right-0' : 'left-0'}`}
              style={{ padding: '4%' }}
            >
              <img
                src={selectedProject.logoImage}
                alt="Logo"
                className="object-contain"
                style={{
                  width: `${selectedProject.logoSize || 20}vw`,
                  height: 'auto',
                  opacity:
                    selectedProject.logoOpacity !== undefined
                      ? selectedProject.logoOpacity / 100
                      : 0.8,
                }}
              />
            </div>
          )}

        <motion.button
          drag
          dragMomentum={false}
          onClick={onOpenQuickConfig}
          className="absolute top-6 left-6 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white z-50 transition-colors hover:bg-black/50 shadow-2xl touch-none"
        >
          <Settings className="w-5 h-5 pointer-events-none" />
        </motion.button>

        <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 items-end">
          <button
            type="button"
            onClick={async () => {
              const next: 'off' | 'on' | 'torch' =
                flashMode === 'off' ? 'torch' : flashMode === 'torch' ? 'on' : 'off';
              setFlashMode(next);
              try {
                await CameraPreview.setFlashMode({ flashMode: next });
              } catch (error) {
                const fallback = next === 'torch' ? 'on' : next;
                setFlashMode(fallback);
                await CameraPreview.setFlashMode({ flashMode: fallback }).catch((e) =>
                  console.warn('[Camera] flash:', e)
                );
              }
            }}
            className="w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95"
            title="Flash / Linterna"
          >
            {flashMode === 'off' ? (
              <ZapOff className="w-5 h-5" />
            ) : (
              <Zap className={`w-5 h-5 ${flashMode === 'torch' ? 'text-yellow-300' : 'text-yellow-200'}`} />
            )}
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
      </div>

      <div className="h-[120px] bg-black flex items-center justify-between px-8 shrink-0">
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          onClick={onCapture}
          disabled={isProcessing}
          className="w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform"
        >
          <div className="w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center">
            {isProcessing ? (
              <RefreshCcw className="w-6 h-6 text-blue-600 animate-spin" />
            ) : (
              <div className="w-10 h-10 border-4 border-gray-100 rounded-full" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenGallery}
          className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95"
        >
          {lastImage ? (
            <img src={lastImage} className="w-full h-full object-cover" alt="Ultima foto" />
          ) : (
            <History className="w-7 h-7 opacity-40" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
