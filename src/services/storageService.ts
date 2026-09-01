/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Field Trace - Almacenamiento Local Robusto (Offline-First)
 * Separa metadatos de evidencias (IndexedDB con índices) y referencias a fotos (Galería Nativa / Web Fallback).
 */

import { Capacitor } from '@capacitor/core';
import type { Project, Evidence, Template, SyncQueue } from '../types';
import { firebaseService } from './firebaseService';

const DB_NAME = 'FieldTraceDB';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_EVIDENCES = 'evidences';
const STORE_PHOTOS = 'photos'; // Web preview fallback only
const STORE_TEMPLATES = 'templates';
const STORE_SYNC_QUEUE = 'syncQueue';

class StorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Projects Store
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id', autoIncrement: true });
          projStore.createIndex('uuid', 'uuid', { unique: true });
          projStore.createIndex('createdAt', 'createdAt', { unique: false });
          projStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        } else {
          const tx = (event.currentTarget as IDBOpenDBRequest).transaction!;
          const projStore = tx.objectStore(STORE_PROJECTS);
          if (!projStore.indexNames.contains('uuid')) projStore.createIndex('uuid', 'uuid', { unique: true });
          if (!projStore.indexNames.contains('createdAt')) projStore.createIndex('createdAt', 'createdAt', { unique: false });
          if (!projStore.indexNames.contains('syncStatus')) projStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Evidences Store with Indices for robust querying without in-memory filtering
        if (!db.objectStoreNames.contains(STORE_EVIDENCES)) {
          const evStore = db.createObjectStore(STORE_EVIDENCES, { keyPath: 'id', autoIncrement: true });
          evStore.createIndex('uuid', 'uuid', { unique: true });
          evStore.createIndex('projectId', 'projectId', { unique: false });
          evStore.createIndex('createdAt', 'createdAt', { unique: false });
          evStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          evStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          evStore.createIndex('photoPath', 'photoPath', { unique: false });
        } else {
          const tx = (event.currentTarget as IDBOpenDBRequest).transaction!;
          const evStore = tx.objectStore(STORE_EVIDENCES);
          if (!evStore.indexNames.contains('uuid')) evStore.createIndex('uuid', 'uuid', { unique: true });
          if (!evStore.indexNames.contains('projectId')) evStore.createIndex('projectId', 'projectId', { unique: false });
          if (!evStore.indexNames.contains('createdAt')) evStore.createIndex('createdAt', 'createdAt', { unique: false });
          if (!evStore.indexNames.contains('updatedAt')) evStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          if (!evStore.indexNames.contains('syncStatus')) evStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          if (!evStore.indexNames.contains('photoPath')) evStore.createIndex('photoPath', 'photoPath', { unique: false });
        }

        // Photos Store (Web Fallback Only)
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        }

        // Templates Store
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id', autoIncrement: true });
        }

        // Sync Queue Store
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('syncStatus', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: number | string): Promise<T> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName: string, item: any): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, item: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const manager = new StorageManager();

export const storageService = {
  async createProject(project: Project): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'proj_' + Date.now() + Math.random().toString(36).substr(2, 9);
    const projectToSave: Project = {
      ...project,
      uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending'
    };
    return manager.add(STORE_PROJECTS, projectToSave);
  },

  async getAllProjects(): Promise<Project[]> {
    const projects = await manager.getAll<Project>(STORE_PROJECTS);
    return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getProject(id: number): Promise<Project> {
    return manager.get<Project>(STORE_PROJECTS, id);
  },

  async updateProject(id: number, project: Project): Promise<void> {
    const existing = await this.getProject(id);
    const updated = {
      ...existing,
      ...project,
      id,
      updatedAt: new Date(),
      syncStatus: 'pending'
    };
    await manager.put(STORE_PROJECTS, updated);
  },

  /**
   * Guarda la evidencia en IndexedDB (solo metadatos y referencia robusta a la foto de la galería).
   * En plataformas móviles (Android/iOS), la foto está en la galería nativa.
   * En Web, se guarda un respaldo temporal en STORE_PHOTOS para la vista previa de la app.
   */
  async addEvidence(evidence: Evidence, imageBase64: string): Promise<number> {
    const evidenceToSave: Evidence = {
      ...evidence,
      updatedAt: new Date(),
      syncStatus: 'pending',
      retryCount: evidence.retryCount ?? 0
    };

    const evidenceId = await manager.add(STORE_EVIDENCES, evidenceToSave);

    // En navegador web (preview sin galería nativa), almacenamos el blob en STORE_PHOTOS como respaldo
    if (Capacitor.getPlatform() === 'web') {
      try {
        const response = await fetch(imageBase64);
        const blob = await response.blob();
        await manager.put(STORE_PHOTOS, { id: evidenceToSave.photoPath, blob });
      } catch (e) {
        console.error('[StorageService] Error guardando respaldo web de la foto:', e);
      }
    }

    // Intentar sincronizar con Firebase en segundo plano si hay internet (NO sube fotos, solo metadatos)
    if (navigator.onLine) {
      firebaseService.syncEvidenceToCloud(evidenceToSave).then(async (success) => {
        if (success) {
          evidenceToSave.syncStatus = 'synced';
          evidenceToSave.lastSyncedAt = new Date();
          if (evidenceId) {
            await manager.put(STORE_EVIDENCES, { ...evidenceToSave, id: evidenceId });
          }
        }
      }).catch(err => {
        console.error('[StorageService] Background sync failed:', err);
      });
    }

    return evidenceId;
  },

  async syncPendingEvidences(): Promise<number> {
    if (!navigator.onLine) return 0;
    try {
      const pendingEvidences = await this.getEvidencesBySyncStatus('pending');
      let syncedCount = 0;
      for (const ev of pendingEvidences) {
        const success = await firebaseService.syncEvidenceToCloud(ev);
        if (success) {
          ev.syncStatus = 'synced';
          ev.lastSyncedAt = new Date();
          if (ev.id) {
            await manager.put(STORE_EVIDENCES, ev);
          }
          syncedCount++;
        }
      }
      return syncedCount;
    } catch (e) {
      console.error('[StorageService] Error syncing pending evidences:', e);
      return 0;
    }
  },

  /**
   * Consulta optimizada usando índice IDBIndex 'projectId' (sin filtrado en memoria).
   */
  async getEvidencesByProject(projectId: number): Promise<Evidence[]> {
    const db = await manager.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_EVIDENCES, 'readonly');
      const store = transaction.objectStore(STORE_EVIDENCES);
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => {
        const list = (request.result as Evidence[]).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getPhotoBlob(photoId: string): Promise<string | null> {
    // 1. Buscar en respaldo web (STORE_PHOTOS)
    const data = await manager.get<{ blob: Blob }>(STORE_PHOTOS, photoId);
    if (data && data.blob) {
      return URL.createObjectURL(data.blob);
    }
    // 2. Si es una URL o path directo
    if (photoId && (photoId.startsWith('data:') || photoId.startsWith('blob:') || photoId.startsWith('http') || photoId.startsWith('file:'))) {
      return photoId;
    }
    return null;
  },

  async getEvidencesBySyncStatus(status: string): Promise<Evidence[]> {
    const db = await manager.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_EVIDENCES, 'readonly');
      const store = transaction.objectStore(STORE_EVIDENCES);
      const index = store.index('syncStatus');
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveTemplate(template: Template): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'tpl_' + Date.now();
    return manager.add(STORE_TEMPLATES, { ...template, uuid });
  },

  async getTemplates(): Promise<Template[]> {
    return manager.getAll<Template>(STORE_TEMPLATES);
  }
};
