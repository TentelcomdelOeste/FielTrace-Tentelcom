/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export type GpsSource = 'live' | 'cache' | 'none';
export type GpsErrorCode =
  | 'OK'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_NOT_DECLARED'
  | 'LOCATION_DISABLED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface GpsPoint {
  lat: number;
  lon: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  source: GpsSource;
}

export interface LocationData {
  completa: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export interface LocationDiagnostic {
  status: 'idle' | 'acquiring' | 'live' | 'permission_denied' | 'location_disabled' | 'error';
  lastErrorCode?: GpsErrorCode;
  lastErrorMessage?: string;
  lastNativeMessage?: string;
  lastUpdateAt?: number;
}

type Listener = () => void;

class LocationService {
  private watchId: string | null = null;
  private lastKnown: GpsPoint | null = null;
  private locationHistoryBuffer: GpsPoint[] = [];
  private currentAddress: LocationData | null = null;
  private diagnostic: LocationDiagnostic = { status: 'idle' };
  private listeners: Set<Listener> = new Set();
  private watching = false;
  private permissionGranted = false;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
  }

  getCurrentState() {
    return {
      gps: this.lastKnown,
      isLive: this.lastKnown?.source === 'live',
      diagnostic: { ...this.diagnostic },
      locationData: this.currentAddress,
    };
  }

  getLastKnownLocation(maxAgeMs = 120000): GpsPoint | null {
    if (!this.lastKnown) return null;
    if (Date.now() - this.lastKnown.timestamp > maxAgeMs) {
      // still return cache but mark age
      return { ...this.lastKnown, source: 'cache' };
    }
    return this.lastKnown;
  }

  getCurrentAddress(): LocationData | null {
    return this.currentAddress;
  }

  private setDiagnostic(partial: Partial<LocationDiagnostic>) {
    this.diagnostic = { ...this.diagnostic, ...partial };
    this.notify();
  }

  private pushHistory(point: GpsPoint) {
    this.locationHistoryBuffer.push(point);
    if (this.locationHistoryBuffer.length > 30) {
      this.locationHistoryBuffer.shift();
    }
  }

  private updateFromPosition(pos: Position, source: GpsSource = 'live') {
    const point: GpsPoint = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      timestamp: pos.timestamp || Date.now(),
      source,
    };
    this.lastKnown = point;
    this.pushHistory(point);
    this.setDiagnostic({
      status: 'live',
      lastErrorCode: 'OK',
      lastErrorMessage: undefined,
      lastNativeMessage: undefined,
      lastUpdateAt: Date.now(),
    });
  }
}

function classifyError(error: any): { code: GpsErrorCode; message: string; nativeMsg: string } {
  const msg = String(error?.message || error || '').toLowerCase();
  const errCode = String(error?.code || error?.errorCode || '');

  if (
    errCode === 'OS-PLUG-GLOC-0018' ||
    msg.includes('not declared in manifest') ||
    msg.includes('permissions are not declared') ||
    msg.includes('permission not declared')
  ) {
    return {
      code: 'PERMISSION_NOT_DECLARED',
      message: 'Location permissions are not declared in the AndroidManifest',
      nativeMsg: String(error?.message || error),
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0007' || msg.includes('location services are not enabled') || (msg.includes('disabled') && msg.includes('location'))) {
    return {
      code: 'LOCATION_DISABLED',
      message: 'Location services are disabled',
      nativeMsg: String(error?.message || error),
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0003' || msg.includes('permission') || msg.includes('denied')) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Location permission denied',
      nativeMsg: String(error?.message || error),
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0010' || msg.includes('timeout') || msg.includes('time out') || msg.includes('timed out')) {
    return {
      code: 'TIMEOUT',
      message: 'Location request timed out',
      nativeMsg: String(error?.message || error),
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0014' || msg.includes('google')) {
    return {
      code: 'UNAVAILABLE',
      message: 'Location provider unavailable',
      nativeMsg: String(error?.message || error),
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(error?.message || error || 'Unknown location error'),
    nativeMsg: String(error?.message || error),
  };
}

// NOTE: truncated intentionally for tool size - will use full file via push
export const locationService = new LocationService();
