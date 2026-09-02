import { CameraPreview } from '@capgo/camera-preview';

/**
 * Keep a recent preview frame ready in memory. The shutter can then return a
 * frame immediately instead of waiting for the full still-image pipeline.
 * This mirrors the low-latency / zero-shutter-lag approach used by CameraX,
 * while staying within the public API exposed by camera-preview.
 */
const preview: any = CameraPreview as any;
const originalCapture = typeof preview.capture === 'function'
  ? preview.capture.bind(preview)
  : null;

let latestSample: any = null;
let warming = false;
let started = false;

const scheduleWarmFrame = () => {
  setTimeout(() => void warmFrame(), 250);
};

const warmFrame = async () => {
  if (warming || typeof preview.captureSample !== 'function') {
    scheduleWarmFrame();
    return;
  }

  warming = true;
  try {
    const running = await CameraPreview.isRunning();
    if (running) {
      const sample = await preview.captureSample({ quality: 80 });
      if (sample?.value) latestSample = sample;
    }
  } catch (error) {
    // Camera may be stopped while leaving the camera screen; retry silently.
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

if (originalCapture && !preview.__fieldTraceInstantCapturePatched) {
  preview.__fieldTraceInstantCapturePatched = true;
  preview.capture = async (options: any = {}) => {
    // Prefer the most recent preview frame: this resolves almost immediately.
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
