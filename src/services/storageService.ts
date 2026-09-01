/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NOTE: This service is now upgraded to use IndexedDB for production-grade binary storage.
 * It strictly separates metadata from heavy binary photo data.
 */

import type { Project, Evidence, Template } from '../types';

const DB_NAME = 'FieldTraceDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_EVIDENCES = 'evidences';
const STORE_PHOTOS = 'photos';
const STORE_TEMPLATES = 'templates';

class StorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORE_EVIDENCES)) db.createObjectStore(STORE_EVIDENCES, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id', autoIncrement: true });
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
    return manager.add(STORE_PROJECTS, { ...project, createdAt: new Date() });
  },

  async getAllProjects(): Promise<Project[]> {
    return manager.getAll<Project>(STORE_PROJECTS);
  },

  async getProject(id: number): Promise<Project> {
    return manager.get<Project>(STORE_PROJECTS, id);
  },

  async updateProject(id: number, project: Project): Promise<void> {
    await manager.put(STORE_PROJECTS, { ...project, id });
  },

  /**
   * Adds evidence with optimized storage.
   * Photos are stored as Blobs in separate store to avoid loading them when querying metadata.
   */
  async addEvidence(evidence: Evidence, imageBase64: string): Promise<number> {
    // 1. Save metadata (photoPath will store the reference ID)
    const photoId = `photo_${Date.now()}`;
    const evidenceToSave = { 
      ...evidence, 
      photoPath: photoId, // Reference to physical storage
      createdAt: new Date() 
    };

    const evidenceId = await manager.add(STORE_EVIDENCES, evidenceToSave);

    // 2. Save heavy photo data separately as a Blob
    try {
      const response = await fetch(imageBase64);
      const blob = await response.blob();
      await manager.put(STORE_PHOTOS, { id: photoId, blob });
    } catch (e) {
      console.error('Failed to save binary photo', e);
    }

    return evidenceId;
  },

  async getEvidencesByProject(projectId: number): Promise<Evidence[]> {
    const all = await manager.getAll<Evidence>(STORE_EVIDENCES);
    return all.filter(e => e.projectId === projectId);
  },

  async getPhotoBlob(photoId: string): Promise<string | null> {
    const data = await manager.get<{ blob: Blob }>(STORE_PHOTOS, photoId);
    if (data && data.blob) {
      return URL.createObjectURL(data.blob);
    }
    return null;
  },

  async saveTemplate(template: Template): Promise<number> {
    return manager.add(STORE_TEMPLATES, template);
  },

  async getTemplates(): Promise<Template[]> {
    return manager.getAll<Template>(STORE_TEMPLATES);
  }
};
