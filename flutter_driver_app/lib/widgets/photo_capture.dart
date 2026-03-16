import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/app_theme.dart';

class PhotoCapture extends StatefulWidget {
  final void Function(File file) onCaptured;

  const PhotoCapture({super.key, required this.onCaptured});

  @override
  State<PhotoCapture> createState() => _PhotoCaptureState();
}

class _PhotoCaptureState extends State<PhotoCapture> {
  File? _image;
  final _picker = ImagePicker();

  Future<void> _takePhoto() async {
    final xFile =
        await _picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (xFile != null) {
      final file = File(xFile.path);
      setState(() => _image = file);
      widget.onCaptured(file);
    }
  }

  Future<void> _pickFromGallery() async {
    final xFile =
        await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (xFile != null) {
      final file = File(xFile.path);
      setState(() => _image = file);
      widget.onCaptured(file);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_image != null) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(_image!,
                height: 200, width: double.infinity, fit: BoxFit.cover),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: () => setState(() => _image = null),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                    color: Colors.black54, shape: BoxShape.circle),
                child:
                    const Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: _takePhoto,
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.border, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(12),
          color: AppTheme.surface,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.camera_alt_outlined,
                size: 32, color: AppTheme.textMuted),
            const SizedBox(height: 8),
            const Text('Tap to capture',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
            const SizedBox(height: 4),
            GestureDetector(
              onTap: _pickFromGallery,
              child: const Text('or choose from gallery',
                  style: TextStyle(
                      color: AppTheme.info,
                      fontSize: 12,
                      decoration: TextDecoration.underline)),
            ),
          ],
        ),
      ),
    );
  }
}
