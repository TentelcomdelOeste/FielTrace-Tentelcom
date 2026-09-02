/**
 * Live GPS / location text for camera overlay
 * Extracted from App.tsx — Phase 1
 */
import { memo, useState, useEffect } from 'react';
import { locationService } from '../services/locationService';

export function getFormattedLocationText(loc: any, selectedProject: any): string {
  if (!loc) return "Buscando...";
  let text = "";
  const format = selectedProject?.locationFormat || 'completa';

  if (format === 'completa') {
    const parts = (loc.completa || '').split(',');
    text = parts.slice(0, 3).join(',').trim();
  } else if (format === 'distrito-canton') {
    text = `${loc.suburb || ''}, ${loc.city || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'ciudad-provincia') {
    text = `${loc.city || ''}, ${loc.state || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'personalizado') {
    const p = selectedProject.customLocationFormat || { road: true, suburb: true, city: true, state: true };
    const parts = [];
    if (p.road && loc.road) parts.push(loc.road);
    if (p.suburb && loc.suburb) parts.push(loc.suburb);
    if (p.city && loc.city) parts.push(loc.city);
    if (p.state && loc.state) parts.push(loc.state);
    text = parts.join(', ');
  }

  return text || "Ubicación detectada";
}

export const LiveLocationOverlay = memo(({ selectedProject }: { selectedProject: any }) => {
  const [locState, setLocState] = useState(locationService.getCurrentState());

  useEffect(() => {
    return locationService.subscribe(() => {
      setLocState(locationService.getCurrentState());
    });
  }, []);

  const { gps, locationData } = locState;
  const formattedLocation = getFormattedLocationText(locationData, selectedProject);

  return (
    <>
      {selectedProject.showGps && (
        <p className={`line-clamp-4 break-words whitespace-pre-wrap ${gps ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
          {gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` : 'SIN GPS'}
        </p>
      )}
      {selectedProject.showLocation && formattedLocation && formattedLocation !== "Buscando..." && (
        <p className="line-clamp-4 break-words whitespace-pre-wrap">{formattedLocation.toUpperCase()}</p>
      )}
    </>
  );
});
