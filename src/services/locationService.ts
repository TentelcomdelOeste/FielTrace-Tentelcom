/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

let currentGps: { lat: number; lon: number; accuracy: number; timestamp?: number } | null = (() => {
  try {
    const data = localStorage.getItem('fieldtrace_last_gps');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
        return parsed;
      }
    }
  } catch (_) {}
  return null;
})();

let currentLocationData: any = (() => {
  try {
    const data = localStorage.getItem('fieldtrace_last_loc_data');
    if (data) return JSON.parse(data);
  } catch (_) {}
  return null;
})();

let lastGeocodeLat = 0;
let lastGeocodeLon = 0;
let lastGeocodeTime = 0;
let fetchPromise: Promise<any> | null = null;

/** GPS older than this is treated as stale (30 minutes) */
const GPS_FRESH_MS = 1800_000;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

function setGpsState(gps: { lat: number; lon: number; accuracy: number; timestamp?: number }) {
  currentGps = gps;
  try {
    localStorage.setItem('fieldtrace_last_gps', JSON.stringify(gps));
  } catch (_) {}
  notifySubscribers();
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
  if (!gps) return false;
  if (gps.timestamp == null) return true;
  return Date.now() - gps.timestamp < GPS_FRESH_MS;
}

export const locationService = {
  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  getCurrentState() {
    return {
      gps: currentGps,
      locationData: currentLocationData
    };
  },

  /** Explicitly clear cached GPS (permission denied, location off, errors) */
  clearGps() {
    currentGps = null;
    currentLocationData = null;
    try {
      localStorage.removeItem('fieldtrace_last_gps');
      localStorage.removeItem('fieldtrace_last_loc_data');
    } catch (_) {}
    notifySubscribers();
  },

  async checkAndRequestPermissions(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const check = await Geolocation.checkPermissions();
        const locStatus = check?.location as string;
        if (locStatus === 'granted' || locStatus === 'coarse') {
          return true;
        }
        
        const request = await Geolocation.requestPermissions();
        const reqStatus = request?.location as string;
        if (reqStatus === 'granted' || reqStatus === 'coarse') {
          return true;
        }
        
        this.clearGps();
        return false;
      } catch (e) {
        console.warn('Error checking/requesting location permission:', e);
      }
    }
    
    // Web fallback permission check
    if (navigator?.permissions && navigator.permissions.query) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        if (p.state === 'denied') {
          this.clearGps();
          return false;
        }
      } catch (_) {}
    }
    return true;
  },

  async getCurrentPosition() {
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
      try {
        const hasPermission = await this.checkAndRequestPermissions();
        if (!hasPermission) {
          this.clearGps();
          return null;
        }

        // 1. First try cached or fresh position from Capacitor Geolocation (high accuracy)
        try {
          const coordinates = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000
          });
          const gps = {
            lat: coordinates.coords.latitude,
            lon: coordinates.coords.longitude,
            accuracy: coordinates.coords.accuracy,
            timestamp: coordinates.timestamp || Date.now()
          };
          setGpsState(gps);
          if (navigator.onLine && (!lastGeocodeLat || (Date.now() - lastGeocodeTime > 60000))) {
            lastGeocodeLat = gps.lat;
            lastGeocodeLon = gps.lon;
            lastGeocodeTime = Date.now();
            this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
          }
          return gps;
        } catch (highAccErr) {
          console.warn('High accuracy location timeout/fail, trying low accuracy...', highAccErr);
        }

        // 2. Retry with low accuracy (Cell / Wi-Fi network location, works indoors)
        try {
          const coordinates = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 120000
          });
          const gps = {
            lat: coordinates.coords.latitude,
            lon: coordinates.coords.longitude,
            accuracy: coordinates.coords.accuracy,
            timestamp: coordinates.timestamp || Date.now()
          };
          setGpsState(gps);
          if (navigator.onLine && (!lastGeocodeLat || (Date.now() - lastGeocodeTime > 60000))) {
            lastGeocodeLat = gps.lat;
            lastGeocodeLon = gps.lon;
            lastGeocodeTime = Date.now();
            this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
          }
          return gps;
        } catch (lowAccErr) {
          console.warn('Low accuracy location failed:', lowAccErr);
        }

        // 3. Web API Fallback
        if (navigator.geolocation) {
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const gps = {
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  timestamp: pos.timestamp || Date.now()
                };
                setGpsState(gps);
                if (navigator.onLine && (!lastGeocodeLat || (Date.now() - lastGeocodeTime > 60000))) {
                  lastGeocodeLat = gps.lat;
                  lastGeocodeLon = gps.lon;
                  lastGeocodeTime = Date.now();
                  this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
                }
                resolve(gps);
              },
              (err) => {
                console.warn('navigator.geolocation failed:', err);
                resolve(currentGps);
              },
              { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
            );
          });
        }

        return currentGps;
      } catch (error) {
        console.error('Error getting location', error);
        return currentGps;
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  },

  /** Returns fresh GPS or cached GPS */
  async getFreshGps() {
    if (fetchPromise) {
      await fetchPromise;
    }
    if (currentGps) return currentGps;
    return this.getCurrentPosition();
  },

  async watchPosition(callback?: (pos: any) => void) {
    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        this.clearGps();
        return null;
      }

      // Trigger immediate initial fix
      void this.getCurrentPosition();

      return await Geolocation.watchPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000
      }, async (position, err) => {
        if (err || !position) {
          void this.getCurrentPosition();
          return;
        }
        const gps = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now()
        };
        setGpsState(gps);

        if (callback) callback(gps);

        if (navigator.onLine) {
          const now = Date.now();
          const distance = lastGeocodeLat && lastGeocodeLon
            ? calculateDistance(lastGeocodeLat, lastGeocodeLon, gps.lat, gps.lon)
            : 999;

          if (distance > 30 || (now - lastGeocodeTime > 60000)) {
            lastGeocodeLat = gps.lat;
            lastGeocodeLon = gps.lon;
            lastGeocodeTime = now;
            this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
          }
        }
      });
    } catch (e) {
      console.warn('Could not start watchPosition:', e);
      void this.getCurrentPosition();
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
    } catch (e) {
      // ignore
    }
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
