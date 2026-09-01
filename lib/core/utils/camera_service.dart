import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:gallery_saver/gallery_saver.dart';
import 'package:path_provider/path_provider.dart';

class CameraService {
  Future<String?> saveEvidenceToGallery(String imagePath, Map<String, String> metadata) async {
    // 1. Load image
    final File imageFile = File(imagePath);
    final ui.Image originalImage = await _decodeImage(imageFile);

    // 2. Create Canvas and draw overlay
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder);
    final Size size = Size(originalImage.width.toDouble(), originalImage.height.toDouble());
    
    // Draw original
    canvas.drawImage(originalImage, Offset.zero, Paint());

    // Draw Overlay Background
    final Paint paint = Paint()..color = Colors.black.withOpacity(0.6);
    const double margin = 40;
    const double padding = 30;
    final double textHeight = metadata.length * 50.0 + (padding * 2);
    
    canvas.drawRect(
      Rect.fromLTWH(margin, margin, 800, textHeight),
      paint,
    );

    // Accent line
    canvas.drawRect(
      Rect.fromLTWH(margin, margin, 15, textHeight),
      Paint()..color = Colors.blue,
    );

    // Draw Text Metadata
    final textPainter = TextPainter(
      textDirection: TextDirection.ltr,
    );

    double currentY = margin + padding;
    metadata.forEach((key, value) {
      textPainter.text = TextSpan(
        text: "$key: $value",
        style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
      );
      textPainter.layout();
      textPainter.paint(canvas, Offset(margin + padding + 10, currentY));
      currentY += 50;
    });

    // 3. Save resulting image
    final ui.Picture picture = recorder.endRecording();
    final ui.Image finalImage = await picture.toImage(size.width.toInt(), size.height.toInt());
    final data = await finalImage.toByteData(format: ui.ImageByteFormat.png);
    
    final directory = await getTemporaryDirectory();
    final String stampedPath = '${directory.path}/stamped_${DateTime.now().millisecondsSinceEpoch}.png';
    await File(stampedPath).writeAsBytes(data!.buffer.asUint8List());

    // 4. Send to Gallery
    await GallerySaver.saveImage(stampedPath, albumName: 'FieldTrace');
    
    return stampedPath;
  }

  Future<ui.Image> _decodeImage(File file) async {
    final bytes = await file.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    return frame.image;
  }
}
