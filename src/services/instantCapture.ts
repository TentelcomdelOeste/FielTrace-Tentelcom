import { CameraPreview } from '@capgo/camera-preview';

/**
 * Keep a recent preview frame ready only while the flash is OFF.
 *
 * IMPORTANT: captureSample() is a preview-frame capture, but when Android flash
 * is AUTO/ON it can interact with the active flash pipeline. Prewarming it
 * repeatedly can therefore make the flash fire/flicker continuously.
 * Native flash modes must be left to the real still-image capture operation.
 */
const preview: any = CameraPreview as any;
const originalCapture = typeof preview.capture === 'function'
  ? preview.capture.bind(preview)
  : null;
const originalSetFlashMode = typeof preview.setFlashMode === 'function'
  ? preview.setFlashMode.bind(preview)
  : null;

let latestSample: any = null;
let warming = false;
let started = false;
let currentFlashMode: 'off' | 'on' | 'auto' | 'torch' = 'off';

const scheduleWarmFrame = () => {
  if (currentFlashMode !== 'off') return;
  setTimeout(() => void warmFrame(), 250);
};

const warmFrame = async () => {
  if (currentFlashMode !== 'off') return;

  if (warming || typeof preview.captureSample !== 'function') {
    scheduleWarmFrame();
    return;
  }

  warming = true;
  try {
    const running = await CameraPreview.isRunning();
    // Never sample while a flash mode is active. The user expects AUTO/ON to
    // behave like a normal native camera: flash fires only when the shutter is
    // pressed, never continuously in the preview.
    if (running && currentFlashMode === 'off') {
      const sample = await preview.captureSample({ quality: 80 });
      if (sample?.value && currentFlashMode === 'off') latestSample = sample;
    }
  } catch (error) {
    console.debug('[Camera] preview prewarm:', error);
  } finally {
    warming = false;
    scheduleWarmFrame();
  }
};

if (!started) {
  started = true;
  void warmFrame();
}

if (originalSetFlashMode && !preview.__fieldTraceFlashPatched) {
  preview.__fieldTraceFlashPatched = true;
  preview.setFlashMode = async (options: any = {}) => {
    const next = String(options?.flashMode || 'off').toLowerCase() as typeof currentFlashMode;
    currentFlashMode = next;

    // Cached frames are valid only for flash-off capture. For AUTO/ON/TORCH,
    // force the native capture path so Android controls the flash normally.
    if (currentFlashMode !== 'off') latestSample = null;

    const result = await originalSetFlashMode(options);

    if (currentFlashMode === 'off') {
      scheduleWarmFrame();
    }

    return result;
  };
}

if (originalCapture && !preview.__fieldTraceInstantCapturePatched) {
  preview.__fieldTraceInstantCapturePatched = true;
  preview.capture = async (options: any = {}) => {
    // AUTO/ON/TORCH must use the native still capture so the flash fires only
    // for the actual photograph, exactly like a normal camera app.
    if (currentFlashMode !== 'off') {
      return originalCapture(options);
    }

    // Flash OFF: use the warmed preview frame for an almost-immediate shutter.
    if (latestSample?.value) return latestSample;

    // Cold-start fallback if the first frame has not been warmed yet.
    try {
      if (typeof preview.captureSample === 'function') {
        const sample = await preview.captureSample({
          quality: typeof options.quality === 'number' ? options.quality : 80,
        });
        if (sample?.value) {
          latestSample = sample;
          return sample;
        }
      }
    } catch (error) {
      console.warn('[Camera] Instant frame capture unavailable; using native still capture:', error);
    }

    return originalCapture(options);
  };
}
