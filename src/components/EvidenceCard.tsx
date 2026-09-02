/**
 * Evidence metadata card (no photo — photos live in native gallery)
 * Extracted from App.tsx — Phase 3
 */
import { memo } from 'react';

export const EvidenceCard = memo(({ evidence }: { evidence: any }) => {
  const hasGps = evidence.latitude && evidence.longitude && !(evidence.latitude === 0 && evidence.longitude === 0);
  const gpsText = evidence.gpsLabel || (hasGps
    ? `${Number(evidence.latitude).toFixed(5)}, ${Number(evidence.longitude).toFixed(5)}`
    : 'SIN GPS');
  const tech = evidence.baseFields?.tecnico || '-';
  const fields = (evidence.customFields || [])
    .filter((f: any) => f.active !== false && f.showInPhoto)
    .slice(0, 3);

  return (
    <div className="aspect-[4/5] rounded-[2rem] overflow-hidden border border-gray-100 relative group shadow-sm bg-white flex flex-col p-4">
      <div className="absolute top-3 left-3 flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
      </div>
      <div className="mt-4 space-y-1.5 flex-1 min-h-0 overflow-hidden">
        <p className="text-[10px] font-black uppercase text-gray-950 tracking-tight line-clamp-2">
          {evidence.projectName || 'Evidencia'}
        </p>
        <p className="text-[9px] font-mono text-gray-500">{evidence.fecha} {evidence.hora || ''}</p>
        <p className={`text-[9px] font-mono ${hasGps ? 'text-green-600' : 'text-amber-600'}`}>{gpsText}</p>
        {evidence.ubicacion && evidence.ubicacion !== 'Pendiente de geocodificación' && evidence.ubicacion !== '' && (
          <p className="text-[8px] text-gray-400 line-clamp-2 uppercase">{evidence.ubicacion}</p>
        )}
        <p className="text-[9px] font-bold text-gray-700 uppercase">{tech}</p>
        {fields.map((f: any, i: number) => (
          <p key={i} className="text-[8px] text-gray-500 uppercase truncate">
            {f.value ? `${f.name}: ${f.value}` : f.name}
          </p>
        ))}
      </div>
      <div className="mt-auto pt-2 border-t border-gray-50">
        <p className="text-[7px] text-gray-300 font-mono truncate" title={evidence.photoPath}>
          ref: {evidence.photoPath || evidence.uuid || '-'}
        </p>
      </div>
    </div>
  );
});
