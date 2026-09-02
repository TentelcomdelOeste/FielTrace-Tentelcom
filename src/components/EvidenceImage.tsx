/**
 * Lazy-loaded evidence image from storage
 * Extracted from App.tsx — Phase 3
 */
import { memo, useState, useEffect, useRef } from 'react';
import { RefreshCcw } from 'lucide-react';
import { storageService } from '../services/storageService';

export const EvidenceImage = memo(({ photoId, className }: { photoId: string, className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    let observer: IntersectionObserver | null = null;

    const load = async () => {
      const blobUrl = await storageService.getPhotoBlob(photoId);
      if (active && blobUrl) {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      }
    };

    if (imgRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          load();
          observer?.disconnect();
        }
      }, { rootMargin: '100px' });
      observer.observe(imgRef.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!url) return <div ref={imgRef} className={`${className} bg-gray-100 flex items-center justify-center`}><RefreshCcw className="w-5 h-5 text-gray-300 animate-spin" /></div>;
  return <img ref={imgRef as any} src={url} className={className} alt="Evidencia" />;
});
