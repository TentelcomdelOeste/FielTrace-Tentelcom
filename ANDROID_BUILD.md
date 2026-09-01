# Guía de Compilación Android (Capacitor Unified)

Esta aplicación utiliza **Capacitor** para unificar el núcleo de React con las APIs nativas de Android. Siga estos pasos para generar su APK instalable.

## 1. Preparación del Entorno Local
Necesita tener instalado:
- Node.js (v18+)
- Android Studio
- Android SDK & Gradle

## 2. Comandos de Compilación

Desde la terminal en la raíz del proyecto:

```bash
# 1. Instalar dependencias
npm install

# 2. Generar el build de producción web
npm run build

# 3. Sincronizar con el proyecto nativo Android
# Si es la primera vez: npx cap add android
npx cap sync android

# 4. Abrir en Android Studio para el paso final
npx cap open android
```

## 3. Generación del APK en Android Studio
1. Una vez abierto el proyecto en Android Studio.
2. Vaya a: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. El archivo resultante estará en: `android/app/build/outputs/apk/debug/app-debug.apk`.

## 4. Pruebas Reales a Validar
- **Cámara**: Al presionar "Abrir Cámara Nativa", se activará la interfaz del sistema con enfoque automático.
- **GPS**: El HUD en la parte superior mostrará `GPS OK` solo si el hardware detecta satélites (mejor probar en exteriores).
- **Compartir**: El botón "Compartir Evidencia" abrirá el menú nativo de Android permitiendo enviar directamente a WhatsApp.
- **Galería**: Las fotos se guardan en la carpeta `Documents/FieldTrace`.

---
**Arquitectura Unificada**: El archivo `src/App.tsx` contiene la lógica consolidada que funciona tanto en la web como en el APK nativo.
