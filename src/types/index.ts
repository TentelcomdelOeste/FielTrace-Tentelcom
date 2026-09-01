/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id?: number;
  uuid?: string;
  name: string;
  client: string;
  description?: string;
  type?: string;
  templateId?: number;
  // Default Visibility
  showDateTime: boolean;
  dateTimeFormat: 'format1' | 'format2';
  showGps: boolean;
  showLocation: boolean;
  showTech: boolean;
  // Technical customization
  techName: string;
  customFields: CustomField[];
  // Location settings
  locationFormat: 'completa' | 'distrito-canton' | 'ciudad-provincia' | 'personalizado';
  customLocationFormat: {
    road: boolean;
    suburb: boolean;
    city: boolean;
    state: boolean;
  };
  // Export Settings
  allowPdf: boolean;
  allowExcel: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  fontSizeScale: 'small' | 'medium' | 'large';
  fontSizeValue?: number;
  overlayColor: string;
  logoImage?: string | null;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoSize?: number;
  logoOpacity?: number;
  createdAt: Date;
  updatedAt?: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
  syncCreatedAt?: Date;
  syncUpdatedAt?: Date;
  lastSyncedAt?: Date;
  syncError?: string;
  retryCount?: number;
}

export interface CustomField {
  name: string;
  value: string;
  showInPhoto: boolean;
  active?: boolean;
}

export interface BaseFields {
  posteId?: string;
  tecnico?: string;
  observaciones?: string;
  materiales?: string;
}

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export interface Evidence {
  id?: number;
  uuid: string;
  projectId: number;
  projectName?: string;
  photoPath: string; // Referencia robusta: FT_<uuid>.jpg
  photo?: {
    fileName: string;
    uri?: string;
    mimeType?: string;
    createdAt: Date;
  };
  capturedAt: Date;
  fecha: string;
  hora: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number;
  gpsCapturedAt?: Date;
  ubicacion: string;
  baseFields: BaseFields;
  customFields: CustomField[];
  sharedWhatsApp: boolean;
  createdAt: Date;
  updatedAt?: Date;
  locked: boolean;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncCreatedAt?: Date;
  syncUpdatedAt?: Date;
  lastSyncedAt?: Date;
  syncError?: string;
  retryCount: number;
}

export interface Template {
  id?: number;
  uuid?: string;
  name: string;
  fields: CustomField[];
}

export interface SyncQueue {
  id?: number;
  uuid?: string;
  entityType: 'project' | 'evidence';
  entityId: number | string;
  operation: SyncOperation;
  timestamp: Date;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount?: number;
  error?: string;
}
