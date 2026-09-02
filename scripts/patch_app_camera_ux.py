#!/usr/bin/env python3
from pathlib import Path

def main():
    app_path = Path("src/App.tsx")
    app = app_path.read_text()
    if not app.strip() or "forcePlay" not in app:
        raise SystemExit("App.tsx invalid")

    if "Zap" not in app.split("from 'lucide-react'")[0]:
        app = app.replace(
            "  Pencil\n} from 'lucide-react';",
            "  Pencil,\n  Zap,\n  ZapOff,\n  ZoomIn\n} from 'lucide-react';",
        )
        print("icons")

    if "cameraZoom" not in app:
        old = "  const [pendingEditSave, setPendingEditSave] = useState<any | null>(null);"
        new = old + "\n  const [cameraZoom, setCameraZoom] = useState(1);\n  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');\n  const pinchStartDist = useRef<number | null>(null);\n  const pinchStartZoom = useRef(1);"
        if old not in app:
            raise SystemExit("state marker")
        app = app.replace(old, new)
        print("state")

    if "applyTorch" not in app:
        marker = "  const webcamRef = useRef<Webcam>(null);"
        helpers = """  const webcamRef = useRef<Webcam>(null);

  const applyTorch = async (on: boolean) => {
    try {
      const video = webcamRef.current?.video as HTMLVideoElement | undefined;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = track.getCapabilities?.() as any;
      if (caps && 'torch' in caps) {
        await track.applyConstraints({ advanced: [{ torch: on } as any] });
      }
    } catch (e) {
      console.warn('Torch not supported', e);
    }
  };

  const cycleZoom = () => {
    setCameraZoom((z) => (z >= 3 ? 1 : z >= 2 ? 3 : 2));
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
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDist.current;
      let next = pinchStartZoom.current * scale;
      next = Math.max(1, Math.min(4, next));
      setCameraZoom(Math.round(next * 10) / 10);
    }
  };

  const onCameraTouchEnd = () => {
    pinchStartDist.current = null;
  };"""
        if marker not in app:
            raise SystemExit("webcamRef")
        app = app.replace(marker, helpers)
        print("helpers")

    old_btn = """                  <button 
                    onClick={() => { void cameraService.openFieldTraceAlbum(); }} 
                    className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white"
                  >
                    {lastImage ? (
                      <img src={lastImage} className="w-full h-full object-contain" />
                    ) : (
                      <History className="w-7 h-7 opacity-40"/>
                    )}
                  </button>"""
    new_btn = """                  <button 
                    type="button"
                    onClick={() => {
                      if (lastImage) setShowLastImage(true);
                      void cameraService.openFieldTraceAlbum();
                    }} 
                    className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95"
                  >
                    {lastImage ? (
                      <img src={lastImage} className="w-full h-full object-cover" alt="Ultima foto" />
                    ) : (
                      <History className="w-7 h-7 opacity-40"/>
                    )}
                  </button>"""
    if old_btn in app:
        app = app.replace(old_btn, new_btn)
        print("gallery btn")
    elif "setShowLastImage(true)" not in app or "openFieldTraceAlbum" not in app:
        if "void cameraService.openFieldTraceAlbum()" in app and "setShowLastImage(true)" not in app:
            app = app.replace(
                "onClick={() => { void cameraService.openFieldTraceAlbum(); }}",
                "onClick={() => { if (lastImage) setShowLastImage(true); void cameraService.openFieldTraceAlbum(); }}",
                1,
            )
            print("gallery btn alt")
        else:
            print("gallery btn already ok or skipped")

    old_w = """                    className="w-full h-full object-cover camera-preview-video"
                    mirrored={false}"""
    new_w = """                    className="w-full h-full object-cover camera-preview-video"
                    style={{ transform: `scale(${cameraZoom})`, transformOrigin: 'center center' }}
                    mirrored={false}"""
    if old_w in app:
        app = app.replace(old_w, new_w)
        print("zoom style")

    lines = app.splitlines()
    for i, line in enumerate(lines):
        if "<Webcam" in line:
            for j in range(i, max(0, i - 15), -1):
                if "relative" in lines[j] and "overflow" in lines[j] and "onTouchStart" not in lines[j]:
                    lines[j] = lines[j].replace(
                        'className="',
                        "onTouchStart={onCameraTouchStart} onTouchMove={onCameraTouchMove} onTouchEnd={onCameraTouchEnd} className=\"",
                    )
                    print("touch")
                    break
            break
    app = "\n".join(lines)

    if "Flash + Zoom controls" not in app:
        old_s = """                  {/* Quick Config Float (Draggable) */}
                  <motion.button 
                    drag
                    dragMomentum={false}
                    onClick={() => setShowQuickConfig(true)}
                    className="absolute top-6 left-6 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white z-50 transition-colors hover:bg-black/50 shadow-2xl touch-none"
                  >
                    <Settings className="w-5 h-5 pointer-events-none" />
                  </motion.button>"""
        new_s = old_s + """

                  {/* Flash + Zoom controls */}
                  <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const next = flashMode === 'off' ? 'on' : 'off';
                        setFlashMode(next);
                        await applyTorch(next === 'on');
                      }}
                      className="w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95"
                      title="Flash"
                    >
                      {flashMode === 'on' ? <Zap className="w-5 h-5 text-yellow-300" /> : <ZapOff className="w-5 h-5" />}
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
                  </div>"""
        if old_s not in app:
            raise SystemExit("settings btn")
        app = app.replace(old_s, new_s)
        print("controls")

    old_m = """              <div className="absolute bottom-6 left-8 right-8 text-center pointer-events-none">
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-1 shadow-sm">Evidencia Capturada</p>
                 <p className="text-[12px] text-white font-black uppercase tracking-tighter shadow-sm">Vista Rápida Pre-Sincronización</p>
              </div>"""
    new_m = """              <div className="absolute bottom-6 left-6 right-6 text-center pointer-events-auto space-y-3">
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest shadow-sm">Ultima foto capturada</p>
                 <button
                   type="button"
                   onClick={() => { void cameraService.openFieldTraceAlbum(); }}
                   className="w-full py-3.5 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95"
                 >
                   Abrir galeria / album Field Trace
                 </button>
              </div>"""
    if old_m in app:
        app = app.replace(old_m, new_m)
        print("modal")

    old_back = """                  <button onClick={() => setCurrentStep('history')} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white">
                    <ArrowLeft className="w-6 h-6"/>
                  </button>"""
    new_back = """                  <button onClick={() => { setCameraZoom(1); setFlashMode('off'); void applyTorch(false); setCurrentStep('history'); }} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white">
                    <ArrowLeft className="w-6 h-6"/>
                  </button>"""
    if old_back in app:
        app = app.replace(old_back, new_back)
        print("back")

    app_path.write_text(app)
    for s in ["cameraZoom", "applyTorch", "Zap", "setShowLastImage(true)"]:
        if s not in app:
            raise SystemExit("missing " + s)
    print("OK lines", len(app.splitlines()))

if __name__ == "__main__":
    main()
