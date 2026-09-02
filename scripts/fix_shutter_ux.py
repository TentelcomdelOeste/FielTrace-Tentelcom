from pathlib import Path
import re

p = Path('src/App.tsx')
text = p.read_text()

# 1) Add capturingRef
old_state = "  const [isProcessing, setIsProcessing] = useState(false);"
new_state = (
    "  const [isProcessing, setIsProcessing] = useState(false);\n"
    "  // Anti doble-tap sin bloquear UI: ref no re-renderiza ni muestra spinner\n"
    "  const capturingRef = useRef(false);"
)
if 'capturingRef' not in text:
    if old_state not in text:
        raise SystemExit('FAIL: isProcessing state not found')
    text = text.replace(old_state, new_state, 1)
    print('OK: added capturingRef')
else:
    print('OK: capturingRef already present')

# 2) Replace capture start
old_start = """  const captureBatchPhoto = async () => {
    if (!selectedProject || isProcessing) return;

    // Feedback visual inmediato (no bloquea)
    const pulse = document.getElementById('camera-pulse');
    if (pulse) {
      pulse.classList.add('bg-white/60');
      setTimeout(() => pulse.classList.remove('bg-white/60'), 120);
    }

    // Bloqueo SOLO durante la captura nativa del sensor (anti doble-tap).
    // NO se espera flash, GPS, overlay, geocode, gallery ni IndexedDB.
    setIsProcessing(true);

    try {
      // Captura física: único await en el camino crítico del obturador
      const captureResult = await CameraPreview.capture({ width: 1920, quality: 80, format: 'jpeg' });
      const capturedValue = captureResult?.value;
      const rawImage = capturedValue ? (capturedValue.startsWith('data:') ? capturedValue : `data:image/jpeg;base64,${capturedValue}`) : null;
      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara nativa');

      // Liberar obturador INMEDIATAMENTE tras obtener la foto del sensor
      setIsProcessing(false);"""

new_start = """  const captureBatchPhoto = async () => {
    // Anti doble-tap con ref (sin spinner ni disabled en el botón)
    if (!selectedProject || capturingRef.current) return;
    capturingRef.current = true;

    try {
      // Captura física: único await. El botón NO se bloquea visualmente.
      const captureResult = await CameraPreview.capture({ width: 1920, quality: 80, format: 'jpeg' });
      const capturedValue = captureResult?.value;
      const rawImage = capturedValue ? (capturedValue.startsWith('data:') ? capturedValue : `data:image/jpeg;base64,${capturedValue}`) : null;
      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara nativa');

      // Liberar anti doble-tap al instante (botón ya disponible para siguiente foto)
      capturingRef.current = false;"""

if old_start in text:
    text = text.replace(old_start, new_start, 1)
    print('OK: replaced capture start')
elif 'capturingRef.current = true' in text:
    print('OK: capture already uses capturingRef')
else:
    raise SystemExit('FAIL: capture start not found')

# 3) Catch/finally
old_catch = """    } catch (e: any) {
      console.error('Batch capture error', e);
      setIsProcessing(false);
    } finally {
      // Re-armar el flash inmediatamente para la siguiente captura consecutiva
      if (flashMode === 'on') {
        void ensureFlashArmed('on');
      }
    }
  };"""

new_catch = """    } catch (e: any) {
      console.error('Batch capture error', e);
      capturingRef.current = false;
    } finally {
      capturingRef.current = false;
      // Re-armar el flash en background (no bloquea)
      if (flashMode === 'on') {
        void ensureFlashArmed('on');
      }
    }
  };"""

if old_catch in text:
    text = text.replace(old_catch, new_catch, 1)
    print('OK: catch uses capturingRef')
elif text.count('capturingRef.current = false') >= 2:
    print('OK: catch already fixed')
else:
    raise SystemExit('FAIL: catch block not found')

# 4) Shutter button
old_btn = """            <button 
              onClick={captureBatchPhoto}
              disabled={isProcessing}
              className=\"w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform\"
            >
              <div className=\"w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center\">
                 {isProcessing ? <RefreshCcw className=\"w-6 h-6 text-blue-600 animate-spin\"/> : <div className=\"w-10 h-10 border-4 border-gray-100 rounded-full\"></div>}
              </div>
            </button>"""

new_btn = """            <button 
              onClick={captureBatchPhoto}
              className=\"w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform\"
            >
              <div className=\"w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center\">
                 <div className=\"w-10 h-10 border-4 border-gray-100 rounded-full\"></div>
              </div>
            </button>"""

if old_btn in text:
    text = text.replace(old_btn, new_btn, 1)
    print('OK: shutter button no spinner/disabled')
else:
    idx = text.find('onClick={captureBatchPhoto}')
    if idx < 0:
        raise SystemExit('FAIL: shutter onClick not found')
    chunk = text[idx:idx+500]
    if 'disabled={isProcessing}' in chunk:
        text = text.replace(
            'onClick={captureBatchPhoto}\n              disabled={isProcessing}\n',
            'onClick={captureBatchPhoto}\n',
            1
        )
        text = text.replace(
            '{isProcessing ? <RefreshCcw className="w-6 h-6 text-blue-600 animate-spin"/> : <div className="w-10 h-10 border-4 border-gray-100 rounded-full"></div>}',
            '<div className="w-10 h-10 border-4 border-gray-100 rounded-full"></div>',
            1
        )
        print('OK: shutter fixed via alt path')
    else:
        print('OK: shutter already without disabled')

# Remove any leftover pulse
if "pulse.classList.add('bg-white/60')" in text:
    text = re.sub(
        r"\n\s*// Feedback visual[^\n]*\n\s*const pulse = document\.getElementById\('camera-pulse'\);\n\s*if \(pulse\) \{\n\s*pulse\.classList\.add\('bg-white/60'\);\n\s*setTimeout\(\(\) => pulse\.classList\.remove\('bg-white/60'\), 120\);\n\s*\}\n",
        "\n",
        text,
        count=1,
    )
    print('OK: removed leftover pulse')

p.write_text(text)

# Verify
t = p.read_text()
assert 'capturingRef' in t
assert "pulse.classList.add('bg-white/60')" not in t
start = t.find('const captureBatchPhoto')
snip = t[start:start+1500]
assert 'setIsProcessing(true)' not in snip
assert 'capturingRef.current = true' in snip
print('Final size', len(t))
print('SUCCESS')
