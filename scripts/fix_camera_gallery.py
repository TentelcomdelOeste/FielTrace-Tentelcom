from pathlib import Path
import re

CAMERA = Path('src/services/cameraService.ts')
APP = Path('src/App.tsx')

camera = CAMERA.read_text()

# Remove the temporary-cache based native gallery implementation and replace it
# with the supported @capacitor-community/media v9 flow: direct data URL + album id.
start = camera.index("  /**\n   * MÉTODO MEJORADO: Guardado inteligente según plataforma")
end = camera.index("  /**\n   * IndexedDB: Almacenamiento local sin descargas", start)

replacement = r'''  /**
   * Native gallery storage.
   * Android requires an album identifier with @capacitor-community/media v9.
   * The processed image is passed directly as a data URL; no Cache file is used.
   */
  async saveToGallery(dataUrl: string, fileName: string): Promise<boolean> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      console.warn('[Gallery] Native gallery is unavailable on web.');
      return false;
    }

    try {
      const options: any = { path: dataUrl };

      if (platform === 'android') {
        options.albumIdentifier = await this.ensureFieldTraceAlbum();
        // Media plugin expects the Android filename without the extension.
        options.fileName = fileName.replace(/\.[^/.]+$/, '');
      }

      const result = await Media.savePhoto(options);
      console.log('[Gallery] Photo saved successfully:', result);
      return true;
    } catch (error: any) {
      console.error('[Gallery] Failed to save photo:', error?.code || error);
      return false;
    }
  },

  /**
   * Find the app-owned Field Trace album or create it once.
   * On Android the identifier must belong to the app's album path.
   */
  async ensureFieldTraceAlbum(): Promise<string> {
    const albumName = 'Field Trace';
    const first = await Media.getAlbums();
    const albumsPath = (await Media.getAlbumsPath()).path;

    let album = first.albums.find(
      (a) => a.name === albumName && a.identifier.startsWith(albumsPath)
    );

    if (!album) {
      try {
        await Media.createAlbum({ name: albumName });
      } catch (error: any) {
        // The album can already exist while getAlbums() is still catching up.
        console.warn('[Gallery] createAlbum:', error?.code || error);
      }

      const refreshed = await Media.getAlbums();
      album = refreshed.albums.find(
        (a) => a.name === albumName && a.identifier.startsWith(albumsPath)
      );
    }

    if (!album) {
      throw new Error('FIELD_TRACE_ALBUM_NOT_FOUND');
    }

    return album.identifier;
  },

'''

camera = camera[:start] + replacement + camera[end:]

# Filesystem is no longer needed: photos go directly to Media.savePhoto().
camera = camera.replace("import { Filesystem, Directory } from '@capacitor/filesystem';\n", '')
CAMERA.write_text(camera)

app = APP.read_text()
old = "onUserMedia={() => console.log('Camera ready')}"
new = """onUserMedia={() => {
                      console.log('Camera ready');
                      requestAnimationFrame(() => {
                        const video = webcamRef.current?.video;
                        if (video) {
                          video.muted = true;
                          video.setAttribute('playsinline', 'true');
                          void video.play().catch((err) => console.warn('Camera autoplay:', err));
                        }
                      });
                    }}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      video.muted = true;
                      video.setAttribute('playsinline', 'true');
                      void video.play().catch((err) => console.warn('Camera autoplay:', err));
                    }}
                    autoPlay
                    muted
                    playsInline
                    controls={false}"""
if old not in app:
    raise SystemExit('Expected camera onUserMedia handler was not found')
app = app.replace(old, new, 1)
APP.write_text(app)

print('Camera/gallery repair applied.')
