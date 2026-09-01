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

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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

  async checkAndRequestPermissions(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      // Flujo nativo: Verificar y solicitar permisos de GPS en tiempo de ejecución
      try {
        const check = await Geolocation.checkPermissions();
        if (check.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            return false;
          }
        }
      } catch (e) {
        console.warn('Error checking/requesting location permission:', e);
        return false;
      }
    }
    return true;
  },

  async getCurrentPosition() {
    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) return currentGps;

      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
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
      console.error('Error getting location', error);
      return currentGps;
    }
  },

  async watchPosition(callback?: (pos: any) => void) {
    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) return null;

      return await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }, async (position) => {
        if (position) {
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
              this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Could not start watchPosition:', e);
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
