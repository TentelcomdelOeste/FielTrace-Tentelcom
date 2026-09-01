#!/usr/bin/env python3
"""Idempotent patches for FielTrace App.tsx - safe to re-run."""
from pathlib import Path
import re
import sys

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# 1) SIN GPS
s = s.replace("'SINCAL...'", "'SIN GPS'")
s = s.replace('"SINCAL..."', "'SIN GPS'")

# 2) facingMode + resolution
s = s.replace(
    'facingMode: { exact: "environment" }',
    'facingMode: { ideal: "environment" }',
)
s = s.replace("width: { ideal: 4096 }", "width: { ideal: 1920 }")
s = s.replace("height: { ideal: 2160 }", "height: { ideal: 1080 }")

# 3) forcePlay onUserMedia
old_oum = """onUserMedia={() => {
                      console.log('Camera ready');
                      requestAnimationFrame(() => {
                        const video = webcamRef.current?.video;
                        if (video) {
                          video.muted = true;
                          video.setAttribute('playsinline', 'true');
                          void video.play().catch((err) => console.warn('Camera autoplay:', err));
                        }
                      });
                    }}"""
new_oum = """onUserMedia={() => {
                      console.log('Camera ready');
                      const forcePlay = () => {
                        const video = webcamRef.current?.video;
                        if (!video) return;
                        video.muted = true;
                        video.playsInline = true;
                        video.setAttribute('playsinline', 'true');
                        video.setAttribute('webkit-playsinline', 'true');
                        video.removeAttribute('controls');
                        void video.play().catch(() => {});
                      };
                      forcePlay();
                      requestAnimationFrame(forcePlay);
                      setTimeout(forcePlay, 100);
                      setTimeout(forcePlay, 400);
                    }}"""
if old_oum in s:
    s = s.replace(old_oum, new_oum)

# 4) useEffect forcePlay on camera step
if "if (currentStep !== 'camera') return" not in s:
    needle = "  const webcamRef = useRef<Webcam>(null);\n"
    insert = (
        "  const webcamRef = useRef<Webcam>(null);\n\n"
        "  // Force play when entering camera (Android WebView)\n"
        "  useEffect(() => {\n"
        "    if (currentStep !== 'camera') return;\n"
        "    const forcePlay = () => {\n"
        "      const video = webcamRef.current?.video;\n"
        "      if (!video) return;\n"
        "      video.muted = true;\n"
        "      video.playsInline = true;\n"
        "      video.setAttribute('playsinline', 'true');\n"
        "      video.setAttribute('webkit-playsinline', 'true');\n"
        "      video.removeAttribute('controls');\n"
        "      void video.play().catch(() => {});\n"
        "    };\n"
        "    forcePlay();\n"
        "    const t1 = setTimeout(forcePlay, 80);\n"
        "    const t2 = setTimeout(forcePlay, 300);\n"
        "    const t3 = setTimeout(forcePlay, 800);\n"
        "    const iv = setInterval(forcePlay, 600);\n"
        "    const onPointer = () => forcePlay();\n"
        "    window.addEventListener('pointerdown', onPointer, { once: true });\n"
        "    return () => {\n"
        "      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(iv);\n"
        "      window.removeEventListener('pointerdown', onPointer);\n"
        "    };\n"
        "  }, [currentStep]);\n\n"
    )
    if needle in s:
        s = s.replace(needle, insert, 1)
else:
    # Ensure continuous interval exists
    if 'setInterval(forcePlay' not in s and "if (currentStep !== 'camera') return" in s:
        s = s.replace(
            "    forcePlay();\n    const t1 = setTimeout(forcePlay, 80);\n    const t2 = setTimeout(forcePlay, 300);\n    const t3 = setTimeout(forcePlay, 800);",
            "    forcePlay();\n    const t1 = setTimeout(forcePlay, 80);\n    const t2 = setTimeout(forcePlay, 300);\n    const t3 = setTimeout(forcePlay, 800);\n    const iv = setInterval(forcePlay, 600);",
        )
        s = s.replace(
            "      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);",
            "      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(iv);",
        )

# 5) hasGps + gpsLabel on capture
old_gps = (
    "      const { gps, locationData } = locationService.getCurrentState();\n"
    "      const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);\n"
    "      const ubicacionText = currentFormattedLocation && currentFormattedLocation !== \"Buscando...\" \n"
    "        ? currentFormattedLocation \n"
    "        : \"Pendiente de geocodificación\";"
)
new_gps = (
    "      const { gps, locationData } = locationService.getCurrentState();\n"
    "      const hasGps = !!(gps && gps.lat != null && gps.lon != null);\n"
    "      const gpsLabel = hasGps ? `${gps!.lat.toFixed(6)}, ${gps!.lon.toFixed(6)}` : 'SIN GPS';\n"
    "      const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);\n"
    "      const ubicacionText = hasGps && currentFormattedLocation && currentFormattedLocation !== \"Buscando...\"\n"
    "        ? currentFormattedLocation\n"
    "        : (hasGps ? \"Pendiente de geocodificación\" : \"\");"
)
if old_gps in s:
    s = s.replace(old_gps, new_gps)

old_lat = (
    "        latitude: gps?.lat || 0,\n"
    "        longitude: gps?.lon || 0,\n"
    "        gpsAccuracy: gps?.accuracy,\n"
    "        gpsCapturedAt: capturedAt,\n"
    "        ubicacion: ubicacionText,"
)
new_lat = (
    "        latitude: hasGps ? gps!.lat : null,\n"
    "        longitude: hasGps ? gps!.lon : null,\n"
    "        gpsAccuracy: hasGps ? gps!.accuracy : undefined,\n"
    "        gpsCapturedAt: hasGps ? capturedAt : undefined,\n"
    "        gpsLabel,\n"
    "        ubicacion: ubicacionText,"
)
if old_lat in s:
    s = s.replace(old_lat, new_lat)

# 6) EvidenceCard
EVIDENCE_CARD = """
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

"""

if "const EvidenceCard" not in s:
    if "const EvidenceImage" in s:
        s = s.replace("const EvidenceImage", EVIDENCE_CARD + "const EvidenceImage", 1)
    else:
        s = s.replace("export default function App", EVIDENCE_CARD + "\nexport default function App", 1)

if '<EvidenceImage photoId={ev.photoPath}' in s:
    s = s.replace(
        '<EvidenceImage photoId={ev.photoPath} className="w-full h-full object-cover" />',
        "<EvidenceCard evidence={ev} />",
    )

# 7) showEvidenceList
if "showEvidenceList" not in s:
    s = s.replace(
        "const [showLastImage, setShowLastImage] = useState(false);",
        "const [showLastImage, setShowLastImage] = useState(false);\n  const [showEvidenceList, setShowEvidenceList] = useState(false);",
        1,
    )

if "setShowEvidenceList(true)" not in s and "showEvidenceList" in s:
    s = s.replace("onClick={() => setShowLastImage(true)}", "onClick={() => setShowEvidenceList(true)}", 1)

# Gallery shutter button → evidence list
_old_gallery_btn = """onClick={() => {
                      if (lastImage) {
                         setShowLastImage(true);
                      }
                    }}"""
if _old_gallery_btn in s:
    s = s.replace(_old_gallery_btn, "onClick={() => setShowEvidenceList(true)}")

if "showEvidenceList &&" not in s and "showEvidenceList" in s:
    modal = """
        {showEvidenceList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Evidencias del proyecto</h2>
              <button type="button" onClick={() => setShowEvidenceList(false)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 bg-gray-50">
              {evidences.length === 0 ? (
                <p className="col-span-2 text-center text-sm text-gray-400 py-12">Sin evidencias aun</p>
              ) : (
                evidences.map((ev: any) => (
                  <EvidenceCard key={ev.id || ev.uuid} evidence={ev} />
                ))
              )}
            </div>
            <p className="text-center text-[10px] text-white/70 py-3 bg-black">Las fotos estan en Galeria &gt; album Field Trace</p>
          </motion.div>
        )}
"""
    if "</AnimatePresence>" in s:
        s = s.replace("</AnimatePresence>", modal + "\n      </AnimatePresence>", 1)

# Webcam CSS class
if 'camera-preview-video' not in s and 'className="w-full h-full object-cover"' in s:
    s = s.replace(
        'className="w-full h-full object-cover"',
        'className="w-full h-full object-cover camera-preview-video"',
        1,
    )

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("Patched App.tsx successfully")
else:
    print("No textual changes (may already be patched)")

text = p.read_text(encoding="utf-8")
checks = [
    ("export default function App", "export default"),
    ('ideal: "environment"', "facingMode ideal"),
    ("SIN GPS", "SIN GPS"),
]
failed = False
for needle, label in checks:
    ok = needle in text
    print(f"  [{'OK' if ok else 'FAIL'}] {label}")
    if not ok:
        failed = True
if failed:
    sys.exit(1)
print(f"Final lines: {text.count(chr(10))+1}")
print(f"forcePlay count: {text.count('forcePlay')}")
print(f"EvidenceCard: {'EvidenceCard' in text}")
print(f"showEvidenceList: {'showEvidenceList' in text}")
print(f"gpsLabel: {'gpsLabel' in text}")
print(f"setInterval: {'setInterval(forcePlay' in text}")
print(f"camera-preview-video: {'camera-preview-video' in text}")
