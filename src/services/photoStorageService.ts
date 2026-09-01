/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Gestor de almacenamiento de fotos en IndexedDB
 */

export const photoStorageService = {
  async getAllPhotos(): Promise<
    Array<{
      fileName: string;
      dataUrl: string;
      timestamp: string;
      size: number;
    }>
  > {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readonly');
          const store = transaction.objectStore('photos');
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const photos = (getAllRequest.result as any[]).sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            );
            resolve(photos);
          };

          getAllRequest.onerror = () => {
            console.error('[StorageService] Error obteniendo fotos');
            resolve([]);
          };
        };

        request.onerror = () => {
          console.error('[StorageService] Error abriendo BD');
          resolve([]);
        };
      } catch (error) {
        console.error('[StorageService] Error:', error);
        resolve([]);
      }
    });
  },

  async getPhoto(fileName: string): Promise<{
    fileName: string;
    dataUrl: string;
    timestamp: string;
    size: number;
  } | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readonly');
          const store = transaction.objectStore('photos');
          const getRequest = store.get(fileName);

          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };

          getRequest.onerror = () => {
            resolve(null);
          };
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        console.error('[StorageService] Error obteniendo foto:', error);
        resolve(null);
      }
    });
  },

  async deletePhoto(fileName: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readwrite');
          const store = transaction.objectStore('photos');
          const deleteRequest = store.delete(fileName);

          deleteRequest.onsuccess = () => {
            console.log(`[StorageService] Foto eliminada: ${fileName}`);
            resolve(true);
          };

          deleteRequest.onerror = () => {
            console.error('[StorageService] Error eliminando foto');
            resolve(false);
          };
        };

        request.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        console.error('[StorageService] Error:', error);
        resolve(false);
      }
    });
  },

  async deleteAllPhotos(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('FieldTracePhotos', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('photos', 'readwrite');
          const store = transaction.objectStore('photos');
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => {
            console.log('[StorageService] Todas las fotos eliminadas');
            resolve(true);
          };

          clearRequest.onerror = () => {
            console.error('[StorageService] Error eliminando todas las fotos');
            resolve(false);
          };
        };

        request.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        console.error('[StorageService] Error:', error);
        resolve(false);
      }
    });
  },

  async getStorageInfo(): Promise<{
    usedMB: number;
    usedKB: number;
    percentUsed: number;
    photoCount: number;
  }> {
    try {
      const photos = await this.getAllPhotos();
      const totalBytes = photos.reduce((sum, p) => sum + p.size * 1024, 0);
      const usedMB = totalBytes / (1024 * 1024);
      const usedKB = totalBytes / 1024;
      const limitMB = 50;
      const percentUsed = (usedMB / limitMB) * 100;

      return {
        usedMB,
        usedKB,
        percentUsed,
        photoCount: photos.length
      };
    } catch (error) {
      console.error('[StorageService] Error obteniendo info:', error);
      return {
        usedMB: 0,
        usedKB: 0,
        percentUsed: 0,
        photoCount: 0
      };
    }
  },

  async exportPhoto(fileName: string): Promise<boolean> {
    try {
      const photo = await this.getPhoto(fileName);
      if (!photo) {
        console.error('[StorageService] Foto no encontrada:', fileName);
        return false;
      }

      const link = document.createElement('a');
      link.href = photo.dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`[StorageService] Foto descargada: ${fileName}`);
      return true;
    } catch (error) {
      console.error('[StorageService] Error exportando foto:', error);
      return false;
    }
  },

  async getPhotoCount(): Promise<number> {
    try {
      const photos = await this.getAllPhotos();
      return photos.length;
    } catch (error) {
      console.error('[StorageService] Error obteniendo contador:', error);
      return 0;
    }
  }
};