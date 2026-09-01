/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id?: number;
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
  projectId: number;
  photoPath: string; // URL local o referencia a la galería
  fecha: string;
  hora: string;
  latitude: number;
  longitude: number;
  ubicacion: string;
  baseFields: BaseFields;
  customFields: CustomField[];
  sharedWhatsApp: boolean;
  createdAt: Date;
  locked: boolean;
}

export interface Template {
  id?: number;
  name: string;
  fields: CustomField[];
}

export interface SyncQueue {
  id?: number;
  entityType: 'project' | 'evidence';
  entityId: number;
  operation: SyncOperation;
  timestamp: Date;
}
