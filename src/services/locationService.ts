/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Geolocation } from '@capacitor/geolocation';

let currentGps: { lat: number; lon: number; accuracy: number } | null = null;
let currentLocationData: any = null;
let lastGeocodeTime = 0;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
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

  async getCurrentPosition() {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      return {
        lat: coordinates.coords.latitude,
        lon: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy
      };
    } catch (error) {
      console.error('Error getting location', error);
      return null;
    }
  },

  async watchPosition(callback?: (pos: any) => void) {
    return await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 10000
    }, async (position) => {
      if (position) {
        const gps = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        currentGps = gps;
        
        if (callback) callback(gps);
        
        const now = Date.now();
        // Allow re-geocode if 5s passed
        if (now - lastGeocodeTime > 5000) {
           lastGeocodeTime = now;
           this.reverseGeocodeAndUpdate(gps.lat, gps.lon);
        } else {
           notifySubscribers();
        }
      }
    });
  },

  async reverseGeocodeAndUpdate(lat: number, lon: number) {
     const locData = await this.reverseGeocode(lat, lon);
     if (locData) {
        currentLocationData = locData;
        notifySubscribers();
     }
  },

  async clearWatch(id: string) {
    await Geolocation.clearWatch({ id });
  },

  async reverseGeocode(lat: number, lon: number): Promise<any> {
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
