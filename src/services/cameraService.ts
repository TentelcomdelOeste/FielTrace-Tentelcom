/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * VERSIÓN NATIVA ROBUSTA - cámara, overlay y galería
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

export const cameraService = {
  async takePhoto(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      // Pedimos explícitamente cámara antes de abrir la Activity nativa.
      try {
        const check = await Camera.checkPermissions();
        if (check.camera !== 'granted') {
          const request = await Camera.requestPermissions({ permissions: ['camera'] });
          if (request.camera !== 'granted') {
            console.warn('[Cámara] Permiso de cámara no concedido.');
            return null;
          }
        }
      } catch (e) {
        console.error('[Cámara] Error solicitando permiso:', e);
        return null;
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
      const timeout = setTimeout(() => resolve(imageSrc), 5000);
      const img = new Image();
      img.onerror = () => {
        clearTimeout(timeout);
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
          if (metadata.projectName) rawLines.push(metadata.projectName.toUpperCase());
          if (metadata.settings?.showDateTime && metadata.dateTimeFormatted) rawLines.push(metadata.dateTimeFormatted);
          if (metadata.settings?.showGps) {
            const lat = Number(metadata.latitude);
            const lon = Number(metadata.longitude);
            rawLines.push(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
          }
          if (metadata.settings?.showLocation && metadata.ubicacion) rawLines.push(metadata.ubicacion.toUpperCase());
          if (metadata.settings?.showTech) rawLines.push(metadata.baseFields?.tecnico || 'N/A');
          (metadata.customFields || []).forEach((cf: any) => {
            if (cf.active !== false && cf.showInPhoto && cf.name) {
              rawLines.push(cf.value && cf.value.trim() !== '' ? `${cf.name.toUpperCase()}: ${cf.value.toUpperCase()}` : cf.name.toUpperCase());
            }
          });
          if (rawLines.length === 0) return resolve(imageSrc);

          const pOverlay = metadata.settings?.overlayPosition || 'top-left';
          const pLogo = metadata.settings?.logoPosition || 'top-left';
          const hasLogo = !!metadata.settings?.logoImage;
          const logoSizeSetting = metadata.settings?.logoSize || 20;
          const logoCanvasWidth = (canvas.width * logoSizeSetting) / 100;
          const sameYDifferentX = (pOverlay.includes('top') && pLogo.includes('top') && pOverlay !== pLogo) || (pOverlay.includes('bottom') && pLogo.includes('bottom') && pOverlay !== pLogo);
          const maxTextWidth = hasLogo && sameYDifferentX ? canvas.width - (3 * margin) - logoCanvasWidth : canvas.width - (2 * margin);

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
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = overlayColor;
          lines.forEach((line, i) => ctx.fillText(line, startX, startY + i * lineHeight));
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
                let logoX = margin, logoY = margin;
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
              } catch {}
              resolve(canvas.toDataURL('image/jpeg', 0.92));
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
    if (Capacitor.getPlatform() === 'web') return this._saveToIndexedDB(dataUrl, fileName);
    if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') return this._saveToNativeGallery(dataUrl, fileName);
    return false;
  },

  async _saveToNativeGallery(dataUrl: string, fileName: string): Promise<boolean> {
    try {
      // Media 9.x acepta directamente data:image/jpeg;base64,... .
      // En Android el albumIdentifier es obligatorio.
      let albums = await Media.getAlbums();
      let album = albums.albums.find((a: any) => a.name === 'Field Trace');
      if (!album) {
        try {
          await Media.createAlbum({ name: 'Field Trace' });
          albums = await Media.getAlbums();
          album = albums.albums.find((a: any) => a.name === 'Field Trace');
        } catch (e) {
          console.warn('[Galería] No se pudo crear el álbum:', e);
        }
      }
      if (Capacitor.getPlatform() === 'android' && !album?.identifier) {
        console.error('[Galería] No se encontró el identificador del álbum Field Trace.');
        return false;
      }
      const baseName = fileName.replace(/\.[^.]+$/, '');
      await Media.savePhoto({
        path: dataUrl,
        albumIdentifier: album?.identifier,
        fileName: baseName
      });
      console.log('[Galería] ✓ Foto guardada en Field Trace');
      return true;
    } catch (error: any) {
      console.error('[Galería] ✗ Error:', error?.code || error?.message || error);
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
          const tx = db.transaction('photos', 'readwrite');
          const req = tx.objectStore('photos').put({ fileName, dataUrl, timestamp: new Date().toISOString(), size: dataUrl.length / 1024 });
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        };
      } catch { resolve(false); }
    });
  },

  async getSavedPhotosFromIndexedDB(): Promise<Array<{ fileName: string; dataUrl: string; timestamp: string; size: number }>> {
    return new Promise((resolve) => {
      const request = indexedDB.open('FieldTracePhotos', 1);
      request.onsuccess = () => {
        const db = request.result;
        const req = db.transaction('photos', 'readonly').objectStore('photos').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
      };
      request.onerror = () => resolve([]);
    });
  },

  async exportPhotoFromIndexedDB(fileName: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('FieldTracePhotos', 1);
      request.onsuccess = () => {
        const db = request.result;
        const req = db.transaction('photos', 'readonly').objectStore('photos').get(fileName);
        req.onsuccess = () => {
          const photo = req.result;
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
        req.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    });
  }
};
