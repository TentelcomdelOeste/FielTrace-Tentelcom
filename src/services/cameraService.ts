/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * VERSIÓN MEJORADA - Guardado inteligente sin descargas
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

export const cameraService = {
  async takePhoto() {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false
    });
    return image.dataUrl;
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
          
          const rawLines = [];
          if (metadata.projectName) rawLines.push(`${metadata.projectName.toUpperCase()}`);
          if (metadata.settings?.showDateTime && metadata.dateTimeFormatted) rawLines.push(`${metadata.dateTimeFormatted}`);
          if (metadata.settings?.showGps) rawLines.push(`${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`);
          if (metadata.settings?.showLocation && metadata.ubicacion) rawLines.push(`${metadata.ubicacion.toUpperCase()}`);
          if (metadata.settings?.showTech) rawLines.push(`${metadata.baseFields?.tecnico || 'N/A'}`);
          
          metadata.customFields.forEach((cf: any) => {
            if (cf.active !== false && cf.showInPhoto) {
               if (cf.value && cf.value.trim() !== '') {
                 rawLines.push(`${cf.name.toUpperCase()}: ${cf.value.toUpperCase()}`);
               } else {
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
                  } else {
                    lines.push(currentLine);
                    currentLine = word;
                    subLineCount++;
                  }
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine) {
                lines.push(currentLine);
              }
            }
          }

          let maxWidth = 0;
          lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
          });
          const totalHeight = lines.length * lineHeight;

          let startX = margin;
          let startY = margin;

          if (position === 'top-right' || position === 'bottom-right') {
            ctx.textAlign = 'right';
            startX = canvas.width - margin;
            if (position === 'bottom-right') {
              startY = canvas.height - totalHeight - margin;
            }
          } else {
            ctx.textAlign = 'left';
            if (position === 'bottom-left') {
              startY = canvas.height - totalHeight - margin;
            }
          }

          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;

          ctx.fillStyle = overlayColor;
          lines.forEach((line, index) => {
            ctx.fillText(line, startX, startY + (index * lineHeight));
          });
          
          ctx.textAlign = 'left';

          if (metadata.settings?.logoImage) {
            const logoImg = new Image();
            logoImg.onload = () => {
              try {
                const logoSizeSetting = metadata.settings?.logoSize || 20;
                const logoOpacity = metadata.settings?.logoOpacity !== undefined ? metadata.settings.logoOpacity / 100 : 0.8;
                const logoPosition = metadata.settings?.logoPosition || 'top-left';

                const targetWidth = (canvas.width * logoSizeSetting) / 100;
                const ratio = logoImg.height / logoImg.width;
                const targetHeight = targetWidth * ratio;

                let logoX = margin;
                let logoY = margin;

                if (logoPosition === 'top-right') {
                   logoX = canvas.width - targetWidth - margin;
                } else if (logoPosition === 'bottom-left') {
                   logoY = canvas.height - targetHeight - margin;
                } else if (logoPosition === 'bottom-right') {
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
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
                resolve(dataUrl);
              } catch (err) {
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
                 resolve(dataUrl);
              }
            };
            logoImg.onerror = () => {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
              resolve(dataUrl);
            };
            logoImg.src = metadata.settings.logoImage;
          } else {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
            resolve(dataUrl);
          }
        } catch (err) {
          console.error('Error drawing overlay:', err);
          resolve(imageSrc);
        }
      };
      img.src = imageSrc;
    });
  },

  /**
   * Native gallery storage.
   * Android requires an album identifier with @capacitor-community/media v9.
   * The processed image is passed directly as a data URL; no Cache file is used.
   */
  async saveToGallery(dataUrl: string, fileName: string): Promise<boolean> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      console.warn('[Gallery] Native gallery is unavailable on web.');
      return false;
    }

    try {
      const options: any = { path: dataUrl };

      if (platform === 'android') {
        options.albumIdentifier = await this.ensureFieldTraceAlbum();
        // Media plugin expects the Android filename without the extension.
        options.fileName = fileName.replace(/\.[^/.]+$/, '');
      }

      const result = await Media.savePhoto(options);
      console.log('[Gallery] Photo saved successfully:', result);
      return true;
    } catch (error: any) {
      console.error('[Gallery] Failed to save photo:', error?.code || error);
      return false;
    }
  },

  /**
   * Find the app-owned Field Trace album or create it once.
   * On Android the identifier must belong to the app's album path.
   */
  async ensureFieldTraceAlbum(): Promise<string> {
    const albumName = 'Field Trace';
    const first = await Media.getAlbums();
    const albumsPath = (await Media.getAlbumsPath()).path;

    let album = first.albums.find(
      (a) => a.name === albumName && a.identifier.startsWith(albumsPath)
    );

    if (!album) {
      try {
        await Media.createAlbum({ name: albumName });
      } catch (error: any) {
        // The album can already exist while getAlbums() is still catching up.
        console.warn('[Gallery] createAlbum:', error?.code || error);
      }

      const refreshed = await Media.getAlbums();
      album = refreshed.albums.find(
        (a) => a.name === albumName && a.identifier.startsWith(albumsPath)
      );
    }

    if (!album) {
      throw new Error('FIELD_TRACE_ALBUM_NOT_FOUND');
    }

    return album.identifier;
  },

  /**
   * IndexedDB: Almacenamiento local sin descargas
   */
  async _saveToIndexedDB(dataUrl: string, fileName: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);

        request.onerror = () => {
          console.error('[IndexedDB] ✗ Error abriendo DB');
          resolve(false);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('photos')) {
            db.createObjectStore('photos', { keyPath: 'fileName' });
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readwrite');
          const store = transaction.objectStore('photos');

          const photoRecord = {
            fileName,
            dataUrl,
            timestamp: new Date().toISOString(),
            size: dataUrl.length / 1024,
          };

          const addRequest = store.add(photoRecord);

          addRequest.onsuccess = () => {
            console.log(
              `[IndexedDB] ✓ Foto guardada: ${fileName} (${photoRecord.size.toFixed(2)} KB)`
            );
            resolve(true);
          };

          addRequest.onerror = () => {
            console.error('[IndexedDB] ✗ Error guardando');
            resolve(false);
          };
        };
      } catch (error) {
        console.error('[IndexedDB] ✗ Error:', error);
        resolve(false);
      }
    });
  },

  async getSavedPhotosFromIndexedDB(): Promise<
    Array<{ fileName: string; dataUrl: string; timestamp: string; size: number }>
  > {
    return new Promise((resolve) => {
      const request = indexedDB.open('FieldTracePhotos', 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readonly');
        const store = transaction.objectStore('photos');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result);
        };
      };

      request.onerror = () => {
        console.error('[IndexedDB] Error recuperando fotos');
        resolve([]);
      };
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
            console.log(`[Export] Descargada foto: ${fileName}`);
          }
          resolve();
        };
      };
    });
  }
};