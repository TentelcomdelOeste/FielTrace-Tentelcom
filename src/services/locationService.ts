/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

let currentGps: { lat: number; lon: number; accuracy: number; timestamp?: number } | null = null;
let currentLocationData: any = null;
let lastGeocodeLat = 0;
let lastGeocodeLon = 0;
let lastGeocodeTime = 0;
let activeWatchId: string | null = null;

/** GPS older than this is treated as stale and shown as SIN GPS. */
const GPS_FRESH_MS = 5 * 60_000;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try { cb(); } catch (_) {}
  });
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function isFresh(gps: typeof currentGps): boolean {
  if (!gps || gps.timestamp == null || !isValidCoordinate(gps.lat, gps.lon)) return false;
  return Date.now() - gps.timestamp < GPS_FRESH_MS;
}

async function requestLocationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const check = await Geolocation.checkPermissions();
    if (check.location === 'granted') return true;
    const request = await Geolocation.requestPermissions();
    return request.location === 'granted';
  } catch (error) {
    console.warn('[GPS] Permission check/request failed:', error);
    return false;
  }
}

async function readPosition(enableHighAccuracy: boolean, maximumAge: number, timeout: number) {
  const coordinates = await Geolocation.getCurrentPosition({
    enableHighAccuracy,
    timeout,
    maximumAge,
  });
  const lat = coordinates.coords.latitude;
  const lon = coordinates.coords.longitude;
  if (!isValidCoordinate(lat, lon)) throw new Error('INVALID_GPS_COORDINATES');
  return {
    lat,
    lon,
    accuracy: coordinates.coords.accuracy,
    timestamp: coordinates.timestamp || Date.now(),
  };
}

export const locationService = {
  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  getCurrentState() {
    const gps = isFresh(currentGps) ? currentGps : null;
    return { gps, locationData: gps ? currentLocationData : null };
  },

  clearGps() {
    currentGps = null;
    currentLocationData = null;
    notifySubscribers();
  },

  async checkAndRequestPermissions(): Promise<boolean> {
    const granted = await requestLocationPermission();
    if (!granted) this.clearGps();
    return granted;
  },

  async getCurrentPosition() {
    try {
      if (!(await requestLocationPermission())) {
        this.clearGps();
        return null;
      }

      // First try a recent/high-accuracy fix. If Android cannot obtain a
      // satellite fix quickly (common indoors), immediately fall back to the
      // fused/network provider instead of leaving the app permanently at GPS=0.
      try {
        const gps = await readPosition(true, 5000, 5000);
        currentGps = gps;
        notifySubscribers();
        return gps;
      } catch (highAccuracyError) {
        console.warn('[GPS] High accuracy fix unavailable, trying network fix:', highAccuracyError);
      }

      const gps = await readPosition(false, 30_000, 5000);
      currentGps = gps;
      notifySubscribers();
      return gps;
    } catch (error) {
      console.warn('[GPS] Position unavailable:', error);
      if (!isFresh(currentGps)) this.clearGps();
      return null;
    }
  },

  async getFreshGps() {
    if (isFresh(currentGps)) return currentGps;
    return this.getCurrentPosition();
  },

  async watchPosition(callback?: (pos: any) => void) {
    try {
      if (!(await requestLocationPermission())) return null;

      if (activeWatchId) {
        await this.clearWatch(activeWatchId);
        activeWatchId = null;
      }

      // Start the watcher immediately, but also request a one-shot fix. This
      // covers Android devices where watchPosition waits too long for its first
      // callback.
      void this.getCurrentPosition().then((gps) => {
        if (gps && callback) callback(gps);
      });

      activeWatchId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      }, async (position, err) => {
        if (err || !position) {
          if (!isFresh(currentGps)) notifySubscribers();
          return;
        }

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (!isValidCoordinate(lat, lon)) return;

        const gps = {
          lat,
          lon,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        };
        currentGps = gps;
        if (callback) callback(gps);
        notifySubscribers();

        if (navigator.onLine) {
          const now = Date.now();
          const distance = lastGeocodeLat && lastGeocodeLon
            ? calculateDistance(lastGeocodeLat, lastGeocodeLon, gps.lat, gps.lon)
            : 999;
          if (distance > 30 || now - lastGeocodeTime > 60_000) {
            lastGeocodeLat = gps.lat;
            lastGeocodeLon = gps.lon;
            lastGeocodeTime = now;
            void this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
          }
        }
      });

      return activeWatchId;
    } catch (error) {
      console.warn('[GPS] Could not start watchPosition:', error);
      if (!isFresh(currentGps)) this.clearGps();
      return null;
    }
  },

  async reverseGeocodeAndUpdate(lat: number, lon: number) {
    if (!navigator.onLine) return;
    const locData = await this.reverseGeocode(lat, lon);
    if (locData) {
      currentLocationData = locData;
      notifySubscribers();
    }
  },

  async clearWatch(id: string) {
    try {
      await Geolocation.clearWatch({ id });
      if (activeWatchId === id) activeWatchId = null;
    } catch (_) {}
  },

  async reverseGeocode(lat: number, lon: number): Promise<any> {
    if (!navigator.onLine || !isValidCoordinate(lat, lon)) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'es', 'User-Agent': 'FieldTraceApp/1.0' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.address) {
        return {
          completa: data.display_name,
          road: data.address.road || '',
          suburb: data.address.suburb || data.address.neighbourhood || '',
          city: data.address.city || data.address.town || data.address.village || '',
          state: data.address.state || '',
          postcode: data.address.postcode || '',
        };
      }
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('[GPS] Reverse geocoding failed:', error);
      return null;
    }
  },
};
