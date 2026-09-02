#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(
  process.cwd(),
  'node_modules/@capgo/camera-preview/android/src/main/java/app/capgo/capacitor/camera/preview/CameraXView.java',
);

if (!fs.existsSync(file)) {
  throw new Error(`CameraXView.java not found: ${file}`);
}

let source = fs.readFileSync(file, 'utf8');
const oldText = '.setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)';
const newText = '.setCaptureMode(ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG)';

if (source.includes(newText)) {
  console.log('CameraX ZSL patch already applied.');
  process.exit(0);
}

if (!source.includes(oldText)) {
  throw new Error('Expected CameraX capture mode was not found; refusing an unsafe patch.');
}

source = source.replace(oldText, newText);
fs.writeFileSync(file, source);
console.log('CameraX ZERO_SHUTTER_LAG patch applied.');
