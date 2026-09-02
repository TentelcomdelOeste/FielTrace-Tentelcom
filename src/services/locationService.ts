/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export type GpsSource = 'live' | 'cache' | 'none';
export type GpsStatus = 'idle' | 'acquiring' | 'ready' | 'permission_denied' | 'location_disabled' | 'error';
export type GpsErrorCode = 
  | 'PERMISSION_DENIED'
  | 'LOCATION_DISABLED'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'GOOGLE_SERVICES_ERROR'
  | 'UNKNOWN';

export interface GpsCoordinate {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
  source: 'live' | 'cache';
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export interface GpsDiagnostic {
  status: GpsStatus;
  source: GpsSource;
  lastError: string | null;
  lastErrorCode: GpsErrorCode | null;
  lastNativeError: string | null;
  permissionGranted: boolean;
  locationServicesEnabled: boolean;
  lastFixTimestamp: number | null;
  isWatching: boolean;
  attempts: number;
}

/** GPS older than this is treated as stale (30 seconds for live freshness) */
const GPS_FRESH_THRESHOLD_MS = 30_000;

let liveGps: GpsCoordinate | null = null;
let cachedGps: GpsCoordinate | null = (() => {
  try {
    const data = localStorage.getItem('fieldtrace_last_gps');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
        return {
          lat: parsed.lat,
          lon: parsed.lon,
          accuracy: parsed.accuracy || 50,
          timestamp: parsed.timestamp || Date.now(),
          source: 'cache'
        };
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

let diagnostic: GpsDiagnostic = {
  status: cachedGps ? 'ready' : 'idle',
  source: cachedGps ? 'cache' : 'none',
  lastError: null,
  lastErrorCode: null,
  lastNativeError: null,
  permissionGranted: false,
  locationServicesEnabled: true,
  lastFixTimestamp: cachedGps ? cachedGps.timestamp : null,
  isWatching: false,
  attempts: 0
};

let lastGeocodeLat = 0;
let lastGeocodeLon = 0;
let lastGeocodeTime = 0;
let activeFetchPromise: Promise<GpsCoordinate | null> | null = null;
let activeWatchId: string | null = null;
let watchReconnectTimeout: any = null;
let watchdogInterval: any = null;
let isWatchingRequested = false;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => {
    try { cb(); } catch (e) { console.error('[GPS] Subscriber error:', e); }
  });
}

function updateLiveGps(coords: {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
}, timestamp?: number) {
  const fix: GpsCoordinate = {
    lat: coords.latitude,
    lon: coords.longitude,
    accuracy: coords.accuracy,
    timestamp: timestamp || Date.now(),
    source: 'live',
    altitude: coords.altitude,
    speed: coords.speed,
    heading: coords.heading
  };

  liveGps = fix;
  cachedGps = { ...fix, source: 'cache' };

  diagnostic.status = 'ready';
  diagnostic.source = 'live';
  diagnostic.lastError = null;
  diagnostic.lastErrorCode = null;
  diagnostic.lastNativeError = null;
  diagnostic.lastFixTimestamp = fix.timestamp;
  diagnostic.permissionGranted = true;
  diagnostic.locationServicesEnabled = true;

  try {
    localStorage.setItem('fieldtrace_last_gps', JSON.stringify(fix));
  } catch (_) {}

  notifySubscribers();

  // Reverse geocoding de fondo
  if (navigator.onLine) {
    const now = Date.now();
    const distance = lastGeocodeLat && lastGeocodeLon
      ? calculateDistance(lastGeocodeLat, lastGeocodeLon, fix.lat, fix.lon)
      : 999;

    if (distance > 30 || (now - lastGeocodeTime > 60000)) {
      lastGeocodeLat = fix.lat;
      lastGeocodeLon = fix.lon;
      lastGeocodeTime = now;
      void locationService.reverseGeocodeAndUpdate(fix.lat, fix.lon);
    }
  }

  return fix;
}

function classifyError(error: any): { code: GpsErrorCode; message: string; nativeMsg: string } {
  const msg = String(error?.message || error || '').toLowerCase();
  const rawMsg = String(error?.message || error || '');
  const errCode = String(error?.code || '');

  if (errCode === 'OS-PLUG-GLOC-0007' || msg.includes('location services are not enabled') || msg.includes('disabled')) {
    return {
      code: 'LOCATION_DISABLED',
      message: 'Ubicación desactivada en el teléfono',
      nativeMsg: rawMsg
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0003' || msg.includes('permission') || msg.includes('denied')) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Permiso de ubicación no concedido',
      nativeMsg: rawMsg
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0010' || msg.includes('timeout') || msg.includes('time')) {
    return {
      code: 'TIMEOUT',
      message: 'Tiempo de espera de GPS agotado (buscando satélites)',
      nativeMsg: rawMsg
    };
  }

  if (errCode === 'OS-PLUG-GLOC-0014' || msg.includes('google')) {
    return {
      code: 'GOOGLE_SERVICES_ERROR',
      message: 'Error de Google Play Services',
      nativeMsg: rawMsg
    };
  }

  return {
    code: 'PROVIDER_ERROR',
    message: 'Error del proveedor de ubicación',
    nativeMsg: rawMsg
  };
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

export const locationService = {
  subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  },

  getCurrentState() {
    const isLive = !!(liveGps && (Date.now() - liveGps.timestamp < GPS_FRESH_THRESHOLD_MS));
    const activeGps = isLive ? liveGps : (liveGps || cachedGps);

    return {
      gps: activeGps,
      liveGps,
      cachedGps,
      isLive,
      locationData: currentLocationData,
      diagnostic: { ...diagnostic }
    };
  },

  getDiagnostic(): GpsDiagnostic {
    return { ...diagnostic };
  },

  clearGps() {
    liveGps = null;
    cachedGps = null;
    currentLocationData = null;
    diagnostic.status = 'idle';
    diagnostic.source = 'none';
    try {
      localStorage.removeItem('fieldtrace_last_gps');
      localStorage.removeItem('fieldtrace_last_loc_data');
    } catch (_) {}
    notifySubscribers();
  },

  async checkAndRequestPermissions(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        let check: any = null;
        try {
          check = await Geolocation.checkPermissions();
        } catch (checkErr: any) {
          const classified = classifyError(checkErr);
          if (classified.code === 'LOCATION_DISABLED') {
            diagnostic.locationServicesEnabled = false;
            diagnostic.status = 'location_disabled';
            diagnostic.lastError = classified.message;
            diagnostic.lastErrorCode = classified.code;
            diagnostic.lastNativeError = classified.nativeMsg;
            notifySubscribers();
            return false;
          }
          console.warn('[GPS] checkPermissions error:', checkErr);
        }

        const checkLoc = check?.location as string;
        const checkCoarse = check?.coarseLocation as string;
        const isAlreadyGranted =
          checkLoc === 'granted' ||
          checkLoc === 'coarse' ||
          checkCoarse === 'granted' ||
          checkCoarse === 'coarse';

        if (isAlreadyGranted) {
          diagnostic.permissionGranted = true;
          return true;
        }

        // Solicitar permisos de ubicación
        const request = await Geolocation.requestPermissions();
        const reqLoc = request?.location as string;
        const reqCoarse = request?.coarseLocation as string;
        const isRequestGranted =
          reqLoc === 'granted' ||
          reqLoc === 'coarse' ||
          reqCoarse === 'granted' ||
          reqCoarse === 'coarse';

        if (isRequestGranted) {
          diagnostic.permissionGranted = true;
          diagnostic.lastError = null;
          diagnostic.lastErrorCode = null;
          return true;
        }

        diagnostic.permissionGranted = false;
        diagnostic.status = 'permission_denied';
        diagnostic.lastError = 'Permisos de ubicación denegados';
        diagnostic.lastErrorCode = 'PERMISSION_DENIED';
        notifySubscribers();
        return false;
      } catch (e: any) {
        const classified = classifyError(e);
        diagnostic.lastError = classified.message;
        diagnostic.lastErrorCode = classified.code;
        diagnostic.lastNativeError = classified.nativeMsg;
        if (classified.code === 'LOCATION_DISABLED') {
          diagnostic.locationServicesEnabled = false;
          diagnostic.status = 'location_disabled';
        }
        console.warn('[GPS] Permission error:', e);
        notifySubscribers();
        return false;
      }
    }

    // Web fallback
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        if (p.state === 'denied') {
          diagnostic.permissionGranted = false;
          diagnostic.status = 'permission_denied';
          diagnostic.lastError = 'Permiso denegado en navegador';
          diagnostic.lastErrorCode = 'PERMISSION_DENIED';
          notifySubscribers();
          return false;
        }
      } catch (_) {}
    }
    diagnostic.permissionGranted = true;
    return true;
  },

  /**
   * Obtiene la posición actual de forma metódica:
   * 1. Fused Location Provider rápido (red/última posición conocida)
   * 2. GPS de alta precisión (satelital)
   * 3. Fallback de baja precisión
   * 4. Fallback Web API
   */
  async getCurrentPosition(): Promise<GpsCoordinate | null> {
    if (activeFetchPromise) return activeFetchPromise;

    activeFetchPromise = (async () => {
      diagnostic.attempts++;
      diagnostic.status = 'acquiring';
      notifySubscribers();

      try {
        const hasPermission = await this.checkAndRequestPermissions();
        if (!hasPermission) {
          console.warn('[GPS] Permiso no concedido para getCurrentPosition');
          return liveGps || cachedGps;
        }

        // 1. FAST PATH: Consulta inmediata de última ubicación conocida de Android (máx 5 min antigüedad)
        try {
          const quickCoords = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 300000
          });
          if (quickCoords?.coords?.latitude != null && quickCoords?.coords?.longitude != null) {
            const fix = updateLiveGps(quickCoords.coords, quickCoords.timestamp);
            console.log('[GPS] Posición rápida obtenida:', fix.lat, fix.lon);
          }
        } catch (fastErr: any) {
          const c = classifyError(fastErr);
          console.warn('[GPS] Fast path no disponible:', c.nativeMsg);
          if (c.code === 'LOCATION_DISABLED') {
            diagnostic.locationServicesEnabled = false;
            diagnostic.status = 'location_disabled';
            diagnostic.lastError = c.message;
            diagnostic.lastErrorCode = c.code;
            notifySubscribers();
            return liveGps || cachedGps;
          }
        }

        // 2. HIGH ACCURACY SATELLITE FIX: Solicitud satelital de precisión
        try {
          const coordinates = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 9000,
            maximumAge: 5000
          });
          if (coordinates?.coords?.latitude != null && coordinates?.coords?.longitude != null) {
            const fix = updateLiveGps(coordinates.coords, coordinates.timestamp);
            console.log('[GPS] Posición de alta precisión fijada:', fix.lat, fix.lon, 'precisión:', fix.accuracy);
            return fix;
          }
        } catch (highAccErr: any) {
          const c = classifyError(highAccErr);
          diagnostic.lastError = c.message;
          diagnostic.lastErrorCode = c.code;
          diagnostic.lastNativeError = c.nativeMsg;
          console.warn('[GPS] Alta precisión falló/timeout:', c.nativeMsg);
        }

        // 3. NETWORK PROVIDER FALLBACK (Torres celulares / Wi-Fi)
        try {
          const coordinates = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 60000
          });
          if (coordinates?.coords?.latitude != null && coordinates?.coords?.longitude != null) {
            const fix = updateLiveGps(coordinates.coords, coordinates.timestamp);
            console.log('[GPS] Posición de red obtenida:', fix.lat, fix.lon);
            return fix;
          }
        } catch (lowAccErr: any) {
          const c = classifyError(lowAccErr);
          diagnostic.lastError = c.message;
          diagnostic.lastErrorCode = c.code;
          diagnostic.lastNativeError = c.nativeMsg;
          console.warn('[GPS] Baja precisión falló:', c.nativeMsg);
        }

        // 4. WEB GEOLOCATION API FALLBACK
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          const webFix = await new Promise<GpsCoordinate | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const fix = updateLiveGps(pos.coords, pos.timestamp);
                resolve(fix);
              },
              (err) => {
                console.warn('[GPS] navigator.geolocation fallback error:', err.message);
                resolve(null);
              },
              { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
            );
          });
          if (webFix) return webFix;
        }

        // Si ninguna adquisición en vivo tuvo éxito
        if (!liveGps && !cachedGps) {
          diagnostic.status = 'error';
          notifySubscribers();
        }

        return liveGps || cachedGps;
      } catch (error: any) {
        const c = classifyError(error);
        diagnostic.lastError = c.message;
        diagnostic.lastErrorCode = c.code;
        diagnostic.lastNativeError = c.nativeMsg;
        diagnostic.status = 'error';
        console.error('[GPS] Error global en getCurrentPosition:', c.nativeMsg);
        notifySubscribers();
        return liveGps || cachedGps;
      } finally {
        activeFetchPromise = null;
      }
    })();

    return activeFetchPromise;
  },

  /**
   * getFreshGps():
   * Distingue inequívocamente entre:
   * - Posición FRESCA (live < 20s): Devuelve inmediatamente con source='live'
   * - Adquisición en curso o nueva adquisición rápida (timeout controlado 3.5s)
   * - Posición en CACHÉ (fallback si la adquisición fresca falla)
   * - SIN GPS (si no hay ni fresca ni en caché)
   */
  async getFreshGps(): Promise<GpsCoordinate | null> {
    const isLive = !!(liveGps && (Date.now() - liveGps.timestamp < GPS_FRESH_THRESHOLD_MS));
    if (isLive && liveGps) {
      console.log('[GPS] getFreshGps: Usando fix fresco existente (<30s)');
      return liveGps;
    }

    console.log('[GPS] getFreshGps: Adquiriendo coordenada fresca antes del disparo...');

    // Si ya había una adquisición en progreso, esperarla con un límite seguro
    if (activeFetchPromise) {
      try {
        const res = await Promise.race([
          activeFetchPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 2500))
        ]);
        if (res && res.source === 'live') return res;
      } catch (_) {}
    }

    // Disparar adquisición con límite de tiempo para no bloquear el obturador
    try {
      const freshFix = await Promise.race([
        this.getCurrentPosition(),
        new Promise<null>((r) => setTimeout(() => r(null), 3000))
      ]);

      if (freshFix && freshFix.source === 'live') {
        return freshFix;
      }
    } catch (e) {
      console.warn('[GPS] getFreshGps: Falló adquisición fresca:', e);
    }

    // Fallback: Si no se logró fix fresco pero hay caché previa en localStorage
    if (liveGps) return liveGps;
    if (cachedGps) {
      console.warn('[GPS] getFreshGps: Fallback a coordenadas almacenadas en caché');
      return cachedGps;
    }

    return null;
  },

  /**
   * Inicia el rastreo continuo (watchPosition) con auto-reconexión robusta.
   * En Android, si ocurre un timeout o error transitorio, el callback nativo
   * es rechazado por Capacitor. Esta implementación detecta la terminación
   * y re-establece el rastreo automáticamente.
   */
  async startWatching(callback?: (pos: GpsCoordinate) => void): Promise<string | null> {
    isWatchingRequested = true;

    if (activeWatchId) {
      // Ya está activo
      return activeWatchId;
    }

    const hasPermission = await this.checkAndRequestPermissions();
    if (!hasPermission) {
      console.warn('[GPS Watch] Permiso no concedido al iniciar watch');
      return null;
    }

    // Disparar lectura inicial rápida
    void this.getCurrentPosition();

    try {
      diagnostic.isWatching = true;
      activeWatchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        },
        (position: Position | null, err: any) => {
          if (err) {
            const classified = classifyError(err);
            console.warn('[GPS Watch] Error nativo en watchPosition:', classified.nativeMsg);
            diagnostic.lastError = classified.message;
            diagnostic.lastErrorCode = classified.code;
            diagnostic.lastNativeError = classified.nativeMsg;
            notifySubscribers();

            // En Capacitor, tras un error el callback nativo se destruye.
            // Programamos auto-reconexión segura:
            activeWatchId = null;
            if (isWatchingRequested && !watchReconnectTimeout) {
              watchReconnectTimeout = setTimeout(() => {
                watchReconnectTimeout = null;
                if (isWatchingRequested) {
                  console.log('[GPS Watch] Re-conectando watchPosition...');
                  void locationService.startWatching(callback);
                }
              }, 3000);
            }
            return;
          }

          if (position?.coords?.latitude != null && position?.coords?.longitude != null) {
            const fix = updateLiveGps(position.coords, position.timestamp);
            if (callback) callback(fix);
          }
        }
      );

      // Iniciar perro guardián (watchdog) para asegurar que el hardware GPS no quede inactivo
      if (!watchdogInterval) {
        watchdogInterval = setInterval(() => {
          if (!isWatchingRequested) return;
          const isStale = !liveGps || (Date.now() - liveGps.timestamp > 12000);
          if (isStale && !activeFetchPromise) {
            console.log('[GPS Watchdog] Señal inactiva >12s, refrescando posición...');
            void locationService.getCurrentPosition();
          }
        }, 8000);
      }

      notifySubscribers();
      return activeWatchId;
    } catch (e: any) {
      const c = classifyError(e);
      console.warn('[GPS Watch] Falló iniciar watchPosition:', c.nativeMsg);
      diagnostic.lastError = c.message;
      diagnostic.lastErrorCode = c.code;
      diagnostic.lastNativeError = c.nativeMsg;
      notifySubscribers();

      // Reintentar en 3s
      if (isWatchingRequested && !watchReconnectTimeout) {
        watchReconnectTimeout = setTimeout(() => {
          watchReconnectTimeout = null;
          if (isWatchingRequested) {
            void locationService.startWatching(callback);
          }
        }, 3000);
      }

      return null;
    }
  },

  async watchPosition(callback?: (pos: any) => void): Promise<string | null> {
    return this.startWatching(callback);
  },

  async stopWatching() {
    isWatchingRequested = false;
    diagnostic.isWatching = false;
    if (watchReconnectTimeout) {
      clearTimeout(watchReconnectTimeout);
      watchReconnectTimeout = null;
    }
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
    if (activeWatchId) {
      try {
        await Geolocation.clearWatch({ id: activeWatchId });
      } catch (_) {}
      activeWatchId = null;
    }
    notifySubscribers();
  },

  async clearWatch(id: string) {
    if (id === activeWatchId) {
      await this.stopWatching();
    } else {
      try {
        await Geolocation.clearWatch({ id });
      } catch (_) {}
    }
  },

  async reverseGeocodeAndUpdate(lat: number, lon: number) {
    if (!navigator.onLine) return;
    const locData = await this.reverseGeocode(lat, lon);
    if (locData) {
      currentLocationData = locData;
      try {
        localStorage.setItem('fieldtrace_last_loc_data', JSON.stringify(locData));
      } catch (_) {}
      notifySubscribers();
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
      console.warn('[Geocoding] Falló geocodificación inversa:', error);
      return null;
    }
  }
};
