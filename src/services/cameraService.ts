/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * VERSIÓN NATIVA ROBUSTA - cámara embebida, overlay y galería
 */

import { CameraPreview } from '@capgo/camera-preview';
import { Camera } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

let previewRunning = false;
let previewStarting = false;
let previewHost: HTMLElement | null = null;
let previewObserverInstalled = false;
let previewStyle: HTMLStyleElement | null = null;
const previousBackgrounds = new Map<HTMLElement, string>();

function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

function findNativeCameraHost(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div'));
  return candidates.find((el) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return text.includes('Cámara Nativa Android') && el.children.length >= 1;
  }) || null;
}

function makeCameraSurfaceTransparent(host: HTMLElement) {
  let el: HTMLElement | null = host;
  let depth = 0;
  while (el && depth < 5) {
    if (!previousBackgrounds.has(el)) previousBackgrounds.set(el, el.style.backgroundColor);
    el.style.backgroundColor = 'transparent';
    el = el.parentElement;
    depth += 1;
  }

  if (!previewStyle) {
    previewStyle = document.createElement('style');
    previewStyle.id = 'field-trace-camera-preview-style';
    previewStyle.textContent = `
      html.ft-camera-preview-active,
      html.ft-camera-preview-active body,
      html.ft-camera-preview-active #root {
        background: transparent !important;
      }
      html.ft-camera-preview-active body,
      html.ft-camera-preview-active #root {
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(previewStyle);
  }
  document.documentElement.classList.add('ft-camera-preview-active');
}

function restoreCameraSurface() {
  previousBackgrounds.forEach((background, el) => {
    el.style.backgroundColor = background;
  });
  previousBackgrounds.clear();
  document.documentElement.classList.remove('ft-camera-preview-active');
  previewStyle?.remove();
  previewStyle = null;
}

function styleControlButton(button: HTMLButtonElement) {
  button.type = 'button';
  button.style.cssText = [
    'min-width:44px',
    'height:44px',
    'padding:0 12px',
    'border-radius:999px',
    'border:1px solid rgba(255,255,255,.22)',
    'background:rgba(0,0,0,.48)',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'color:#fff',
    'font:700 13px system-ui,sans-serif',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
    'box-shadow:0 4px 14px rgba(0,0,0,.28)',
    'touch-action:manipulation',
    'cursor:pointer'
  ].join(';');
}

function installControls(host: HTMLElement) {
  if (host.querySelector('[data-ft-camera-controls]')) return;

  Array.from(host.children).forEach((child) => {
    (child as HTMLElement).style.display = 'none';
  });

  const controls = document.createElement('div');
  controls.dataset.ftCameraControls = '1';
  controls.style.cssText = 'position:absolute;inset:0;z-index:9999;pointer-events:none;';

  const topRight = document.createElement('div');
  topRight.style.cssText = 'position:absolute;top:18px;right:18px;display:flex;align-items:center;gap:8px;pointer-events:auto;';

  const flash = document.createElement('button');
  flash.textContent = '⚡ AUTO';
  styleControlButton(flash);

  const flip = document.createElement('button');
  flip.textContent = '↻';
  flip.setAttribute('aria-label', 'Cambiar cámara');
  styleControlButton(flip);

  const grid = document.createElement('button');
  grid.textContent = '▦';
  grid.setAttribute('aria-label', 'Cuadrícula');
  styleControlButton(grid);

  topRight.append(flash, flip, grid);

  const zoomBar = document.createElement('div');
  zoomBar.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto;';

  controls.append(topRight, zoomBar);
  host.appendChild(controls);

  let flashModes: string[] = ['off', 'auto', 'on', 'torch'];
  let flashIndex = 1;
  let gridMode = 'none';

  CameraPreview.getSupportedFlashModes().then((result: any) => {
    const supported = result?.result || [];
    if (Array.isArray(supported) && supported.length) flashModes = supported;
    flashIndex = Math.max(0, flashModes.indexOf('auto'));
    if (flashIndex < 0) flashIndex = 0;
  }).catch(() => undefined);

  flash.addEventListener('click', async () => {
    flashIndex = (flashIndex + 1) % flashModes.length;
    const mode = flashModes[flashIndex];
    try {
      await CameraPreview.setFlashMode({ flashMode: mode as any });
      flash.textContent = `⚡ ${mode.toUpperCase()}`;
    } catch (e) {
      console.warn('[CameraPreview] flash:', e);
    }
  });

  flip.addEventListener('click', async () => {
    try {
      await CameraPreview.flip();
    } catch (e) {
      console.warn('[CameraPreview] flip:', e);
    }
  });

  grid.addEventListener('click', async () => {
    gridMode = gridMode === 'none' ? '3x3' : gridMode === '3x3' ? '4x4' : 'none';
    try {
      await CameraPreview.setGridMode({ gridMode: gridMode as any });
      grid.textContent = gridMode === 'none' ? '▦' : gridMode === '3x3' ? '3×3' : '4×4';
    } catch (e) {
      console.warn('[CameraPreview] grid:', e);
    }
  });

  CameraPreview.getZoomButtonValues().then((result: any) => {
    const values = Array.isArray(result?.values) && result.values.length ? result.values : [1, 2, 3];
    zoomBar.replaceChildren();
    values.forEach((value: number) => {
      const button = document.createElement('button');
      button.textContent = `${value}×`;
      styleControlButton(button);
      button.addEventListener('click', async () => {
        try {
          await CameraPreview.setZoom({ level: value, autoFocus: true });
          Array.from(zoomBar.children).forEach((child) => {
            (child as HTMLElement).style.background = 'rgba(0,0,0,.48)';
          });
          button.style.background = 'rgba(37,99,235,.78)';
        } catch (e) {
          console.warn('[CameraPreview] zoom:', e);
        }
      });
      zoomBar.appendChild(button);
    });
  }).catch(() => {
    [1, 2, 3].forEach((value) => {
      const button = document.createElement('button');
      button.textContent = `${value}×`;
      styleControlButton(button);
      button.addEventListener('click', () => CameraPreview.setZoom({ level: value, autoFocus: true }).catch(() => undefined));
      zoomBar.appendChild(button);
    });
  });
}

async function requestLocationBeforeCamera(): Promise<void> {
  try {
    const check = await Geolocation.checkPermissions();
    if (check.location !== 'granted') {
      await Geolocation.requestPermissions();
    }
  } catch (e) {
    console.warn('[GPS] No se pudo solicitar permiso antes de cámara:', e);
  }
}

async function startNativePreview(host: HTMLElement): Promise<void> {
  if (!isNativeAndroid() || previewRunning || previewStarting) return;
  previewStarting = true;
  previewHost = host;
  try {
    makeCameraSurfaceTransparent(host);
    installControls(host);

    // GPS primero, luego cámara. Así el usuario ve ambos permisos en orden.
    await requestLocationBeforeCamera();

    const permissions = await CameraPreview.checkPermissions({ disableAudio: true });
    if (permissions.camera !== 'granted') {
      const requested = await CameraPreview.requestPermissions({
        disableAudio: true,
        title: 'Permiso de cámara',
        message: 'Field Trace necesita la cámara para capturar evidencias técnicas.',
        cancelButtonTitle: 'Cancelar'
      });
      if (requested.camera !== 'granted') {
        console.warn('[CameraPreview] Permiso de cámara no concedido.');
        return;
      }
    }

    await CameraPreview.start({
      position: 'rear',
      aspectRatio: 'fill',
      aspectMode: 'cover',
      includeSafeAreaInsets: true,
      toBack: true,
      disableAudio: true,
      disableFocusIndicator: false,
      gridMode: 'none',
      initialZoomLevel: 1,
      force: false
    });

    previewRunning = true;
    console.info('[CameraPreview] Vista previa nativa iniciada.');
  } catch (e) {
    console.error('[CameraPreview] No se pudo iniciar la vista previa:', e);
  } finally {
    previewStarting = false;
  }
}

async function stopNativePreview(): Promise<void> {
  if (!previewRunning && !previewStarting) return;
  try {
    await CameraPreview.stop({ force: true });
  } catch (e) {
    console.warn('[CameraPreview] stop:', e);
  } finally {
    previewRunning = false;
    previewStarting = false;
    previewHost = null;
    restoreCameraSurface();
  }
}

function installPreviewObserver() {
  if (previewObserverInstalled || !isNativeAndroid() || typeof document === 'undefined') return;
  previewObserverInstalled = true;

  const sync = () => {
    const host = findNativeCameraHost();
    if (host) {
      previewHost = host;
      makeCameraSurfaceTransparent(host);
      installControls(host);
      if (!previewRunning && !previewStarting) void startNativePreview(host);
    } else if (previewRunning || previewStarting) {
      void stopNativePreview();
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(sync, 50);
  setTimeout(sync, 300);
  setTimeout(sync, 1000);
}

if (typeof document !== 'undefined') {
  installPreviewObserver();
}

export const cameraService = {
  async takePhoto(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        if (isNativeAndroid()) {
          const running = await CameraPreview.isRunning();
          if (!running) {
            const host = findNativeCameraHost();
            if (host) await startNativePreview(host);
          }
          const result = await CameraPreview.capture({
            quality: 95,
            format: 'jpeg',
            saveToGallery: false,
            withExifLocation: false,
            photoQualityPrioritization: 'quality'
          });
          return result.value?.startsWith('data:') ? result.value : `data:image/jpeg;base64,${result.value}`;
        }
      } catch (e) {
        console.warn('[CameraPreview] Capture falló, se intenta Camera API:', e);
      }

      try {
        const userActivation = (navigator as any).userActivation;
        if (userActivation && !userActivation.isActive) {
          console.info('[Cámara] Llamada automática ignorada; esperando pulsación del obturador.');
          return null;
        }
        const check = await Camera.checkPermissions();
        if (check.camera !== 'granted') {
          const request = await Camera.requestPermissions();
          if (request.camera !== 'granted') return null;
        }
        const image = await Camera.getPhoto({
          quality: 95,
          allowEditing: false,
          resultType: 'dataUrl' as any,
          source: 'CAMERA' as any,
          saveToGallery: false,
          correctOrientation: true
        });
        return image.dataUrl || null;
      } catch (err) {
        console.warn('Error capturando foto o cancelación de la cámara nativa:', err);
        return null;
      }
    }

    try {
      const image = await Camera.getPhoto({
        quality: 95,
        allowEditing: false,
        resultType: 'dataUrl' as any,
        source: 'CAMERA' as any,
        saveToGallery: false,
        correctOrientation: true
      });
      return image.dataUrl || null;
    } catch (err) {
      console.warn('Error capturando foto:', err);
      return null;
    }
  },

  async drawOverlay(imageSrc: string, metadata: any): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('drawOverlay timed out, returning original image');
        resolve(imageSrc);
      }, 5000);

      const img = new Image();
      img.onerror = () => {
        clearTimeout(timeout);
        console.error('Error loading image for overlay');
        resolve(imageSrc);
      };
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imageSrc);
          ctx.drawImage(img, 0, 0);

          const position = metadata.settings?.overlayPosition || 'top-left';
          const fontSizeScale = metadata.settings?.fontSizeScale || 'medium';
          const fontSizeValue = metadata.settings?.fontSizeValue;
          const overlayColor = metadata.settings?.overlayColor || '#FFFFFF';
          const baseSize = Math.max(24, Math.floor(canvas.width / 40));
          let fontSize = baseSize;
          if (fontSizeValue) fontSize = (fontSizeValue / 100) * (canvas.width / 10);
          else {
            if (fontSizeScale === 'small') fontSize = baseSize * 0.7;
            if (fontSizeScale === 'large') fontSize = baseSize * 1.5;
          }

          const margin = canvas.width * 0.04;
          const lineHeight = fontSize * 1.4;
          ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
          ctx.textBaseline = 'top';

          const rawLines: string[] = [];
          if (metadata.projectName) rawLines.push(`${metadata.projectName.toUpperCase()}`);
          if (metadata.settings?.showDateTime && metadata.dateTimeFormatted) rawLines.push(`${metadata.dateTimeFormatted}`);
          if (metadata.settings?.showGps) {
            const lat = Number(metadata.latitude);
            const lon = Number(metadata.longitude);
            rawLines.push(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
          }
          if (metadata.settings?.showLocation && metadata.ubicacion) rawLines.push(`${metadata.ubicacion.toUpperCase()}`);
          if (metadata.settings?.showTech) rawLines.push(`${metadata.baseFields?.tecnico || 'N/A'}`);
          (metadata.customFields || []).forEach((cf: any) => {
            if (cf.active !== false && cf.showInPhoto) {
              if (cf.value && cf.value.trim() !== '') rawLines.push(`${cf.name.toUpperCase()}: ${cf.value.toUpperCase()}`);
              else if (cf.name) rawLines.push(`${cf.name.toUpperCase()}`);
            }
          });
          if (rawLines.length === 0) return resolve(imageSrc);

          const p_overlayPos = metadata.settings?.overlayPosition || 'top-left';
          const p_logoPos = metadata.settings?.logoPosition || 'top-left';
          const hasLogo = !!metadata.settings?.logoImage;
          const logoSizeSetting = metadata.settings?.logoSize || 20;
          const logoCanvasWidth = (canvas.width * logoSizeSetting) / 100;
          const isSameYAndDifferentX =
            (p_overlayPos.includes('top') && p_logoPos.includes('top') && p_overlayPos !== p_logoPos) ||
            (p_overlayPos.includes('bottom') && p_logoPos.includes('bottom') && p_overlayPos !== p_logoPos);
          const maxTextWidth = (hasLogo && isSameYAndDifferentX)
            ? canvas.width - (3 * margin) - logoCanvasWidth
            : canvas.width - (2 * margin);

          const lines: string[] = [];
          for (const rawLine of rawLines) {
            for (const subLine of rawLine.split('\n')) {
              const words = subLine.split(' ');
              let currentLine = words[0] || '';
              let subLineCount = 1;
              for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + ' ' + words[i];
                if (ctx.measureText(testLine).width > maxTextWidth) {
                  if (subLineCount >= 4) {
                    currentLine += '...';
                    break;
                  }
                  lines.push(currentLine);
                  currentLine = words[i];
                  subLineCount++;
                } else currentLine = testLine;
              }
              if (currentLine) lines.push(currentLine);
            }
          }

          const totalHeight = lines.length * lineHeight;
          let startX = margin;
          let startY = margin;
          if (position === 'top-right' || position === 'bottom-right') {
            ctx.textAlign = 'right';
            startX = canvas.width - margin;
            if (position === 'bottom-right') startY = canvas.height - totalHeight - margin;
          } else {
            ctx.textAlign = 'left';
            if (position === 'bottom-left') startY = canvas.height - totalHeight - margin;
          }

          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = overlayColor;
          lines.forEach((line, index) => ctx.fillText(line, startX, startY + index * lineHeight));
          ctx.textAlign = 'left';

          if (metadata.settings?.logoImage) {
            const logoImg = new Image();
            logoImg.onload = () => {
              try {
                const logoSize = metadata.settings?.logoSize || 20;
                const logoOpacity = metadata.settings?.logoOpacity !== undefined ? metadata.settings.logoOpacity / 100 : 0.8;
                const logoPosition = metadata.settings?.logoPosition || 'top-left';
                const targetWidth = (canvas.width * logoSize) / 100;
                const ratio = logoImg.height / logoImg.width;
                const targetHeight = targetWidth * ratio;
                let logoX = margin;
                let logoY = margin;
                if (logoPosition === 'top-right') logoX = canvas.width - targetWidth - margin;
                if (logoPosition === 'bottom-left') logoY = canvas.height - targetHeight - margin;
                if (logoPosition === 'bottom-right') {
                  logoX = canvas.width - targetWidth - margin;
                  logoY = canvas.height - targetHeight - margin;
                }
                ctx.save();
                ctx.globalAlpha = logoOpacity;
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.drawImage(logoImg, logoX, logoY, targetWidth, targetHeight);
                ctx.restore();
                resolve(canvas.toDataURL('image/jpeg', 0.92));
              } catch {
                resolve(canvas.toDataURL('image/jpeg', 0.92));
              }
            };
            logoImg.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.92));
            logoImg.src = metadata.settings.logoImage;
          } else resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (err) {
          console.error('Error drawing overlay:', err);
          resolve(imageSrc);
        }
      };
      img.src = imageSrc;
    });
  },

  async saveToGallery(dataUrl: string, fileName: string): Promise<boolean> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') return this._saveToIndexedDB(dataUrl, fileName);
    if (platform === 'android' || platform === 'ios') return this._saveToNativeGallery(dataUrl, fileName);
    return false;
  },

  async _saveToNativeGallery(dataUrl: string, fileName: string): Promise<boolean> {
    try {
      let albums = await Media.getAlbums();
      let album = albums.albums.find((a: any) => a.name === 'Field Trace');
      if (!album) {
        try {
          await Media.createAlbum({ name: 'Field Trace' });
          albums = await Media.getAlbums();
          album = albums.albums.find((a: any) => a.name === 'Field Trace');
        } catch (albumError) {
          console.warn('[Galería] No se pudo crear/obtener el álbum Field Trace:', albumError);
        }
      }

      const baseName = fileName.replace(/\.[^.]+$/, '');
      const result = await Media.savePhoto({
        path: dataUrl,
        ...(album?.identifier ? { albumIdentifier: album.identifier } : {}),
        fileName: baseName
      });
      console.log('[Galería] ✓ Fotografía guardada:', result);
      return true;
    } catch (error: any) {
      console.error('[Galería] ✗ Error guardando fotografía:', error?.code || error?.message || error);
      return false;
    }
  },

  async _saveToIndexedDB(dataUrl: string, fileName: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);
        request.onerror = () => resolve(false);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'fileName' });
        };
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readwrite');
          const store = transaction.objectStore('photos');
          const addRequest = store.put({ fileName, dataUrl, timestamp: new Date().toISOString(), size: dataUrl.length / 1024 });
          addRequest.onsuccess = () => resolve(true);
          addRequest.onerror = () => resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  },

  async getSavedPhotosFromIndexedDB(): Promise<Array<{ fileName: string; dataUrl: string; timestamp: string; size: number }>> {
    return new Promise((resolve) => {
      const request = indexedDB.open('FieldTracePhotos', 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readonly');
        const store = transaction.objectStore('photos');
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      };
      request.onerror = () => resolve([]);
    });
  },

  async exportPhotoFromIndexedDB(fileName: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('FieldTracePhotos', 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readonly');
        const store = transaction.objectStore('photos');
        const getRequest = store.get(fileName);
        getRequest.onsuccess = () => {
          const photo = getRequest.result;
          if (photo) {
            const link = document.createElement('a');
            link.href = photo.dataUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          resolve();
        };
      };
      request.onerror = () => resolve();
    });
  }
};
