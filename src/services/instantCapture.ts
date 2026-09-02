import { CameraPreview } from '@capgo/camera-preview';

/**
 * The app's capture handler already owns the evidence-processing pipeline.
 * For the shutter itself we prefer the current preview frame, which avoids
 * waiting for a full sensor still-image pipeline on slower Android devices.
 * If the frame API is unavailable/fails, the native still capture remains the
 * safe fallback.
 */
const preview: any = CameraPreview as any;
const originalCapture = typeof preview.capture === 'function'
  ? preview.capture.bind(preview)
  : null;

if (originalCapture && !preview.__fieldTraceInstantCapturePatched) {
  preview.__fieldTraceInstantCapturePatched = true;
  preview.capture = async (options: any = {}) => {
    try {
      const running = await CameraPreview.isRunning();
      if (running && typeof preview.captureSample === 'function') {
        const sample = await preview.captureSample({
          quality: typeof options.quality === 'number' ? options.quality : 80,
        });
        if (sample?.value) return sample;
      }
    } catch (error) {
      console.warn('[Camera] Instant frame capture unavailable; using native still capture:', error);
    }
    return originalCapture(options);
  };
}
