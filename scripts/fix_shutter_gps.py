from pathlib import Path
p = Path('src/App.tsx')
text = p.read_text()

old_gps = """  let gpsLabel = 'SIN GPS';
  let gpsColor = 'text-yellow-400 animate-pulse';

  if (gps) {
    if (isLive) {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
      gpsColor = 'text-green-400';
    } else {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (CACHÉ)`;
      gpsColor = 'text-amber-300';
    }
  } else if (diagnostic?.status === 'location_disabled') {
    gpsLabel = 'SIN GPS (GPS DESACTIVADO)';
    gpsColor = 'text-red-400';
  } else if (diagnostic?.status === 'permission_denied') {
    gpsLabel = 'SIN GPS (PERMISOS DENEGADOS)';
    gpsColor = 'text-red-400';
  } else if (diagnostic?.status === 'acquiring') {"""

new_gps = """  let gpsLabel = 'SIN GPS';
  let gpsColor = 'text-yellow-400 animate-pulse';

  // Prioridad: si el GPS del teléfono está apagado o sin permiso, NO mostrar caché
  if (diagnostic?.status === 'location_disabled' || diagnostic?.locationServicesEnabled === false) {
    gpsLabel = 'SIN GPS (GPS DESACTIVADO)';
    gpsColor = 'text-red-400';
  } else if (diagnostic?.status === 'permission_denied') {
    gpsLabel = 'SIN GPS (PERMISOS DENEGADOS)';
    gpsColor = 'text-red-400';
  } else if (gps) {
    if (isLive) {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
      gpsColor = 'text-green-400';
    } else {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (CACHÉ)`;
      gpsColor = 'text-amber-300';
    }
  } else if (diagnostic?.status === 'acquiring') {"""

if old_gps not in text:
    raise SystemExit('FAIL: GPS block not found')
text = text.replace(old_gps, new_gps, 1)
print('OK: GPS priority fixed')

old_flash = """    try {
      // Re-armar el flash nativo si está en 'on' antes de la captura
      if (flashMode === 'on') {
        await ensureFlashArmed('on');
      }

      // Captura optimizada a 1920x1440 max / calidad 80 para puente nativo ultra-rápido (<150ms)
      const captureResult = await CameraPreview.capture"""

new_flash = """    // Bloqueo SOLO durante la captura nativa del sensor (anti doble-tap).
    // NO se espera flash, GPS, overlay, geocode, gallery ni IndexedDB.
    setIsProcessing(true);

    try {
      // Captura física: único await en el camino crítico del obturador
      const captureResult = await CameraPreview.capture"""

if old_flash not in text:
    raise SystemExit('FAIL: flash block not found')
text = text.replace(old_flash, new_flash, 1)
print('OK: removed await ensureFlashArmed from critical path')

old_start = """  const captureBatchPhoto = async () => {
    if (!selectedProject || isProcessing) return;
    setIsProcessing(true);
    
    // Feedback visual rápido INMEDIATO al presionar
    const pulse = document.getElementById('camera-pulse');"""

new_start = """  const captureBatchPhoto = async () => {
    if (!selectedProject || isProcessing) return;

    // Feedback visual inmediato (no bloquea)
    const pulse = document.getElementById('camera-pulse');"""

if old_start in text:
    text = text.replace(old_start, new_start, 1)
    print('OK: moved setIsProcessing')
else:
    old_start2 = """  const captureBatchPhoto = async () => {
    if (!selectedProject || isProcessing) return;
    setIsProcessing(true);

    // Feedback visual rápido INMEDIATO al presionar
    const pulse = document.getElementById('camera-pulse');"""
    if old_start2 in text:
        text = text.replace(old_start2, new_start, 1)
        print('OK: moved setIsProcessing (v2)')
    else:
        print('WARN: start already adjusted')

old_gps_cap = """      // Liberar obturador instantáneamente
      setIsProcessing(false);

      // Obtener coordenada fresca o fallback en caché
      const freshGps = await locationService.getFreshGps();
      const { gps: stateGps, locationData, isLive } = locationService.getCurrentState();
      const activeGps = freshGps || stateGps;
      const hasGps = !!(activeGps && activeGps.lat != null && activeGps.lon != null);
      const isActualLive = activeGps?.source === 'live' || (isLive && activeGps === freshGps);
      const gpsLabel = hasGps
        ? (isActualLive ? `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)}` : `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)} (CACHÉ)`)
        : 'SIN GPS';"""

new_gps_cap = """      // Liberar obturador INMEDIATAMENTE tras obtener la foto del sensor
      setIsProcessing(false);

      // Re-armar flash en background (no bloquea siguiente disparo)
      if (flashMode === 'on') {
        void ensureFlashArmed('on');
      }

      // GPS 100% síncrono en memoria (0ms). Si GPS del teléfono está apagado → SIN GPS (no caché)
      const { gps: stateGps, locationData, isLive, diagnostic } = locationService.getCurrentState();
      const locationOff = diagnostic?.status === 'location_disabled' || diagnostic?.locationServicesEnabled === false;
      const activeGps = locationOff ? null : stateGps;
      const hasGps = !!(activeGps && activeGps.lat != null && activeGps.lon != null);
      const isActualLive = !!(hasGps && (activeGps!.source === 'live' || isLive));
      const gpsLabel = locationOff
        ? 'SIN GPS (GPS DESACTIVADO)'
        : hasGps
          ? (isActualLive ? `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)}` : `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)} (CACHÉ)`)
          : 'SIN GPS';"""

if old_gps_cap not in text:
    raise SystemExit('FAIL: GPS capture block not found')
text = text.replace(old_gps_cap, new_gps_cap, 1)
print('OK: GPS capture + immediate unlock')

p.write_text(text)
assert 'Liberar obturador INMEDIATAMENTE' in text
assert 'SIN GPS (GPS DESACTIVADO)' in text
start = text.find('const captureBatchPhoto')
snippet = text[start:start+1200]
if 'await ensureFlashArmed' in snippet:
    raise SystemExit('FAIL: await ensureFlashArmed still in critical path')
print('OK: all verifications passed')
print('Final size:', len(text))
