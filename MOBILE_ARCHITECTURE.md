# Arquitectura Técnica Móvil — Field Trace

Este documento detalla la migración de la arquitectura web hacia una estructura nativa de **Flutter**, diseñada para robustez **Offline-First** y escalabilidad empresarial.

## 1. Estructura de Carpetas (Flutter Modular)

La aplicación sigue un patrón de diseño por módulos para facilitar la escalabilidad y el mantenimiento.

```text
lib/
 ├── core/              # Lógica compartida, temas, servicios globales
 │    ├── storage/      # Hive Services & Adapters
 │    ├── network/      # Cliente API (preparado para futuro)
 │    ├── utils/        # GPS, Camera Helpers, Formatters
 │    └── constants/    # Configuración de la App
 ├── modules/           # Funcionalidades del negocio
 │    ├── projects/     # Gestión de Proyectos
 │    ├── records/      # Captura de Evidencias (Cámara/Fotos)
 │    ├── templates/    # Gestión de Plantillas Dinámicas
 │    ├── sync/         # Motor de Sincronización en segundo plano
 │    └── auth/         # Preparado para Login / Identity
 └── main.dart          # Punto de entrada
```

## 2. Estrategia de Almacenamiento: Hive

Se ha seleccionado **Hive** como motor de persistencia principal por:
- **Performance:** Es significativamente más rápido que SQLite.
- **Simplicidad:** No requiere SQL, trabaja directamente con objetos Dart.
- **Offline-First:** Sincronización inmediata de datos en disco.

### Entidades y Relaciones

| Entidad | Relación | Descripción |
| :--- | :--- | :--- |
| **Project** | 1 : N | Un proyecto agrupa múltiples evidencias técnicas. |
| **Evidence** | N : 1 | El registro central con metadatos incrustados y rutas de fotos. |
| **CustomField** | Embebido | Campos dinámicos inyectados dentro de Evidence y Templates. |
| **SyncItem** | Cola | Rastrea cambios locales para replicar en la nube en el futuro. |

## 3. Flujo de Captura y Persistencia

1. **Captura:** La app obtiene GPS (async) y toma la foto.
2. **Procesado:** `gallery_saver` guarda la imagen original; `screenshot` o `canvas` genera la versión con metadatos.
3. **Persistencia:** Se guarda el objeto `Evidence` en la box de Hive.
4. **Sync Queue:** Automáticamente se añade una entrada a `SyncItem` marcando el registro como pendiente de subida.

## 4. Preparación para el Futuro

- **Login:** El módulo `auth/` está diseñado para inyectar un `AuthInterceptor` en el cliente de red.
- **Sincronización:** El `SyncEngine` procesará la cola de `SyncItem` cuando se detecte conectividad activa.
- **Sistema Principal:** La arquitectura sigue principios de Clean Architecture para que el cambio de una API REST a GraphQL o Firebase sea trivial.

## 5. Proceso de Compilación (Android APK)

Para generar el APK instalable y realizar pruebas en dispositivos físicos, siga estos pasos:

### Prerrequisitos
- Flutter SDK instalado localmente.
- Dispositivo Android con 'Depuración USB' activada.

### Comandos de Compilación
```bash
# 1. Obtener dependencias nativas
flutter pub get

# 2. Generar adaptadores de Hive (TypeAdapters)
flutter pub run build_runner build --delete-conflicting-outputs

# 3. Compilar APK (Release mode para rendimiento real)
flutter build apk --release
```
El archivo resultante se encontrará en: `build/app/outputs/flutter-apk/app-release.apk`

## 6. Validación de Permisos Configuradas
El `AndroidManifest.xml` ya incluye las siguientes delegaciones de sistema:
- `CAMERA`: Captura de evidencia.
- `ACCESS_FINE_LOCATION`: Estampado de coordenadas GPS.
- `WRITE_EXTERNAL_STORAGE`: Guardado automático en la galería pública.

## 7. Plan de Prueba en Campo (Android Físico)
1. **Instalación:** Transferir el APK al móvil e instalar.
2. **GPS:** Abrir la app a cielo abierto y verificar que el HUD detecte coordenadas.
3. **Captura:** Tomar foto y revisar que aparezca el overlay azul/negro con metadatos.
4. **Galería:** Cerrar la app y validar que exista el álbum "FieldTrace" en Google Photos / Galería.
5. **Persistencia:** Reiniciar el equipo y verificar que los proyectos creados sigan listados (Hive Lock).
