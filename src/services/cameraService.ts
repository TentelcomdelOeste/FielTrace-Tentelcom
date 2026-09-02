/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Gallery save via @capacitor-community/media -> album Field Trace
 */

import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

let _cachedAlbumIdentifier: string | null = null;
let _lastSavedPath: string | null = null;
const ALBUM_NAME = 'Field Trace';

export const cameraService = {
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
            const gpsText = metadata.gpsLabel
              || (metadata.latitude && metadata.longitude
                  ? `${Number(metadata.latitude).toFixed(6)}, ${Number(metadata.longitude).toFixed(6)}`
                  : 'SIN GPS');
            rawLines.push(gpsText);
          }
          if (metadata.settings?.showLocation && metadata.ubicacion) rawLines.push(`${metadata.ubicacion.toUpperCase()}`);
          if (metadata.settings?.showTech) rawLines.push(`${metadata.baseFields?.tecnico || 'N/A'}`);

          (metadata.customFields || []).forEach((cf: any) => {
            if (cf.active !== false && cf.showInPhoto) {
              if (cf.value && String(cf.value).trim() !== '') {
                rawLines.push(`${cf.name.toUpperCase()}: ${String(cf.value).toUpperCase()}`);
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
              if (currentLine) lines.push(currentLine);
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

                resolve(canvas.toDataURL('image/jpeg', 0.90));
              } catch (err) {
                resolve(canvas.toDataURL('image/jpeg', 0.90));
              }
            };
            logoImg.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.90));
            logoImg.src = metadata.settings.logoImage;
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.90));
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

    if (platform === 'web') {
      console.warn('[Gallery] Native gallery is unavailable on web.');
      return false;
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      console.error('[Gallery] Invalid data URL for savePhoto');
      return false;
    }

    const baseName = (fileName || 'FT_photo').replace(/\.[^/.]+$/, '');

    try {
      const albumIdentifier = await this.ensureFieldTraceAlbum();
      const result = await Media.savePhoto({
        path: dataUrl,
        albumIdentifier,
        fileName: baseName,
      } as any);
      console.log('[Gallery] Saved to Field Trace album:', result);
      const path = (result as any)?.filePath || (result as any)?.path || (result as any)?.identifier || null;
      if (path) _lastSavedPath = String(path);
      return true;
    } catch (error: any) {
      console.error('[Gallery] Album save failed:', error?.code || error?.message || error);
    }

    try {
      _cachedAlbumIdentifier = null;
      const albumIdentifier = await this.ensureFieldTraceAlbum();
      const result = await Media.savePhoto({
        path: dataUrl,
        albumIdentifier,
        fileName: baseName,
      } as any);
      console.log('[Gallery] Saved to Field Trace on retry:', result);
      const path2 = (result as any)?.filePath || (result as any)?.path || (result as any)?.identifier || null;
      if (path2) _lastSavedPath = String(path2);
      return true;
    } catch (error: any) {
      console.error('[Gallery] Retry album save failed:', error?.code || error?.message || error);
    }

    try {
      const result = await Media.savePhoto({
        path: dataUrl,
        fileName: baseName,
      } as any);
      console.warn('[Gallery] Saved WITHOUT album (fallback):', result);
      return true;
    } catch (error: any) {
      console.error('[Gallery] Fallback save failed:', error?.code || error?.message || error);
      return false;
    }
  },

  async ensureFieldTraceAlbum(): Promise<string> {
    if (_cachedAlbumIdentifier) {
      return _cachedAlbumIdentifier;
    }

    let albumsPath = '';
    try {
      if (Capacitor.getPlatform() === 'android') {
        const pathRes = await (Media as any).getAlbumsPath?.();
        albumsPath = pathRes?.path || '';
      }
    } catch (e) {
      console.warn('[Gallery] getAlbumsPath not available:', e);
    }

    const isOurAlbum = (a: { name: string; identifier: string }) => {
      const nameOk =
        a.name === ALBUM_NAME ||
        a.name === 'FieldTrace' ||
        a.name === 'Field_Trace' ||
        (a.name || '').toLowerCase().includes('field trace') ||
        (a.name || '').toLowerCase().includes('fieldtrace');
      if (!nameOk) return false;
      if (albumsPath && a.identifier) {
        return a.identifier.startsWith(albumsPath) || a.identifier.includes(ALBUM_NAME.replace(/\s/g, ''));
      }
      return true;
    };

    const findAlbum = (albums: { name: string; identifier: string }[]) =>
      albums.find(isOurAlbum) ||
      albums.find((a) => a.name === ALBUM_NAME || a.name === 'FieldTrace' || a.name === 'Field_Trace');

    let albums = (await Media.getAlbums()).albums || [];
    let album = findAlbum(albums);

    if (!album) {
      try {
        await Media.createAlbum({ name: ALBUM_NAME });
      } catch (error: any) {
        console.warn('[Gallery] createAlbum:', error?.code || error?.message || error);
      }
      await new Promise((r) => setTimeout(r, 350));
      albums = (await Media.getAlbums()).albums || [];
      album = findAlbum(albums);
    }

    if (!album) {
      await new Promise((r) => setTimeout(r, 500));
      albums = (await Media.getAlbums()).albums || [];
      album = findAlbum(albums);
    }

    if (!album) {
      throw new Error('FIELD_TRACE_ALBUM_NOT_FOUND');
    }

    _cachedAlbumIdentifier = album.identifier;
    return album.identifier;
  },

  getLastSavedPath(): string | null {
    return _lastSavedPath;
  },

  async openFieldTraceAlbum(preferLastPhoto = true): Promise<boolean> {
    try {
      const native = (window as any).FieldTraceNative;

      if (preferLastPhoto && _lastSavedPath && native) {
        if (typeof native.openUri === 'function') {
          try {
            native.openUri(_lastSavedPath);
            return true;
          } catch (e) {
            console.warn('[Gallery] FieldTraceNative.openUri failed', e);
          }
        }
      }

      if (native && typeof native.openGallery === 'function') {
        try {
          native.openGallery();
          return true;
        } catch (e) {
          console.warn('[Gallery] FieldTraceNative.openGallery failed', e);
        }
      }

      try {
        const CapApp = (window as any).Capacitor?.Plugins?.App;
        if (CapApp?.openUrl) {
          await CapApp.openUrl({ url: 'content://media/external/images/media' });
          return true;
        }
      } catch (e) {
        console.warn('[Gallery] Cap App.openUrl failed', e);
      }

      if (Capacitor.getPlatform() === 'android') {
        const intents = [
          'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_GALLERY;end',
          'intent:#Intent;action=android.intent.action.VIEW;type=image/*;end',
          'intent://media/external/images/media#Intent;scheme=content;action=android.intent.action.VIEW;type=image/*;end',
        ];
        for (const url of intents) {
          try {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_system';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
          } catch (_) {}
        }
        try {
          window.open('content://media/external/images/media', '_system');
          return true;
        } catch (_) {}
      } else {
        window.open('photos://', '_blank');
        return true;
      }
    } catch (e) {
      console.warn('[Gallery] open failed', e);
    }
    return false;
  },
};
