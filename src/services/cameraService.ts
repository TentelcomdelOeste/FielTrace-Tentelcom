/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * VERSIÓN NATIVA ROBUSTA - cámara, overlay y galería
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const cameraService = {
  async takePhoto(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      // El efecto de React que entra a la vista de cámara también puede llamar
      // esta función. Solo una pulsación real del usuario debe abrir la cámara.
      const userActivation = (navigator as any).userActivation;
      if (userActivation && !userActivation.isActive) {
        console.info('[Cámara] Llamada automática ignorada; esperando pulsación del obturador.');
        return null;
      }

      // Primero pedimos GPS. Esto evita que el diálogo de ubicación compita
      // con la Activity nativa de la cámara.
      try {
        const locationCheck = await Geolocation.checkPermissions();
        if (locationCheck.location !== 'granted') {
          const locationRequest = await Geolocation.requestPermissions();
          if (locationRequest.location !== 'granted') {
            console.warn('[GPS] Permiso de ubicación no concedido.');
          }
        }
      } catch (e) {
        console.warn('[GPS] No se pudo solicitar ubicación antes de la cámara:', e);
      }

      // Capacitor Camera moderno no necesita un diálogo de permiso de cámara
      // para lanzar la Activity de cámara. Android gestiona la cámara nativa.
      try {
        const check = await Camera.checkPermissions();
        if (check.camera === 'denied') {
          console.warn('[Cámara] Android reportó permiso de cámara denegado.');
          return null;
        }
      } catch (e) {
        console.warn('[Cámara] No se pudo consultar el estado del permiso:', e);
      }
    }

    try {
      const image = await Camera.getPhoto({
        quality: 95,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
        correctOrientation: true
      });
      return image.dataUrl || null;
    } catch (err) {
      console.warn('Error capturando foto o cancelación de la cámara:', err);
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

          if (fontSizeValue) {
            fontSize = (fontSizeValue / 100) * (canvas.width / 10);
          } else {
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
              if (cf.value && cf.value.trim() !== '') {
                rawLines.push(`${cf.name.toUpperCase()}: ${cf.value.toUpperCase()}`);
              } else if (cf.name) {
                rawLines.push(`${cf.name.toUpperCase()}`);
              }
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
            const subLines = rawLine.split('\n');
            for (const subLine of subLines) {
              const words = subLine.split(' ');
              let currentLine = words[0] || '';
              let subLineCount = 1;
              for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine + ' ' + word;
                if (ctx.measureText(testLine).width > maxTextWidth) {
                  if (subLineCount >= 4) {
                    currentLine += '...';
                    break;
                  }
                  lines.push(currentLine);
                  currentLine = word;
                  subLineCount++;
                } else {
                  currentLine = testLine;
                }
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
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          }
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
      // Media 9.x (Capacitor 8) guarda directamente data:image/jpeg;base64,...
      // y en Android requiere un albumIdentifier.
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
