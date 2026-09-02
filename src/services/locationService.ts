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

/** GPS older than this is treated as stale and shown as SIN GPS */
const GPS_FRESH_MS = 90_000;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isFresh(gps: typeof currentGps): boolean {
  if (!gps || gps.timestamp == null) return false;
  return Date.now() - gps.timestamp < GPS_FRESH_MS;
}

export const locationService = {
  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  getCurrentState() {
    const gps = isFresh(currentGps) ? currentGps : null;
    return {
      gps,
      locationData: gps ? currentLocationData : null
    };
  },

  clearGps() {
    currentGps = null;
    currentLocationData = null;
    notifySubscribers();
  },

  async checkAndRequestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const check = await Geolocation.checkPermissions();
      if (check.location === 'granted') return true;
      const request = await Geolocation.requestPermissions();
      if (request.location === 'granted') return true;
      this.clearGps();
      return false;
    } catch (e) {
      console.warn('[GPS] Error checking/requesting location permission:', e);
      this.clearGps();
      return false;
    }
  },

  async getCurrentPosition() {
    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) return null;

      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });
      const gps = {
        lat: coordinates.coords.latitude,
        lon: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: coordinates.timestamp || Date.now()
      };
      currentGps = gps;
      notifySubscribers();
      return gps;
    } catch (error) {
      console.warn('[GPS] Initial position unavailable:', error);
      // Do not erase a still-valid last fix because a single location request
      // can time out indoors while the watcher continues working.
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
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) return null;

      return await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }, async (position, err) => {
        if (err || !position) {
          // A transient callback error must not immediately erase a good fix.
          // The 90-second freshness guard handles genuinely stale coordinates.
          if (!isFresh(currentGps)) notifySubscribers();
          return;
        }

        const gps = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now()
        };
        currentGps = gps;

        if (callback) callback(gps);
        notifySubscribers();

        if (navigator.onLine) {
          const now = Date.now();
          const distance = lastGeocodeLat && lastGeocodeLon
            ? calculateDistance(lastGeocodeLat, lastGeocodeLon, gps.lat, gps.lon)
            : 999;

          if (distance > 30 || (now - lastGeocodeTime > 60000)) {
            lastGeocodeLat = gps.lat;
            lastGeocodeLon = gps.lon;
            lastGeocodeTime = now;
            void this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
          }
        }
      });
    } catch (e) {
      console.warn('[GPS] Could not start watchPosition:', e);
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
    } catch (_) {}
  },

  async reverseGeocode(lat: number, lon: number): Promise<any> {
    if (!navigator.onLine) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'es',
          'User-Agent': 'FieldTraceApp/1.0'
        }
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data && data.address) {
        return {
          completa: data.display_name,
          road: data.address.road || '',
          suburb: data.address.suburb || data.address.neighbourhood || '',
          city: data.address.city || data.address.town || data.address.village || '',
          state: data.address.state || '',
          postcode: data.address.postcode || ''
        };
      }
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Geocoding failed, internet might be unavailable.', error);
      return null;
    }
  }
};
