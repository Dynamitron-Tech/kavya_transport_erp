import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/kt_colors.dart';
import '../../services/ocr_service.dart';

// ─── Scan status ──────────────────────────────────────────────────────────────

enum _ScanStatus { starting, ready, capturing, processing, done, error }

// ─── Widget ───────────────────────────────────────────────────────────────────

/// Full-screen document scanner.
/// Returns [OcrResult] (via Navigator.pop) when recognised, or null if cancelled.
///
/// Usage:
/// ```dart
/// final result = await Navigator.push<OcrResult>(
///   context,
///   MaterialPageRoute(builder: (_) => const DocumentScannerWidget()),
/// );
/// ```
class DocumentScannerWidget extends StatefulWidget {
  const DocumentScannerWidget({super.key});

  @override
  State<DocumentScannerWidget> createState() => _DocumentScannerWidgetState();
}

class _DocumentScannerWidgetState extends State<DocumentScannerWidget>
    with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  _ScanStatus _status = _ScanStatus.starting;
  String? _statusMessage;
  File? _capturedFile;
  OcrResult? _result;
  bool _flashOn = false;
  bool _isDisposed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _initCamera();
  }

  @override
  void dispose() {
    _isDisposed = true;
    WidgetsBinding.instance.removeObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      ctrl.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  // ─── Camera init ──────────────────────────────────────────────────────────

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        _setStatus(_ScanStatus.error, 'No camera available');
        return;
      }
      final back = _cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => _cameras.first,
      );
      final ctrl = CameraController(
        back,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await ctrl.initialize();
      if (_isDisposed) {
        await ctrl.dispose();
        return;
      }
      _controller = ctrl;
      _setStatus(_ScanStatus.ready, null);
    } catch (e) {
      _setStatus(_ScanStatus.error, 'Camera error: $e');
    }
  }

  void _setStatus(_ScanStatus s, String? msg) {
    if (!mounted) return;
    setState(() {
      _status = s;
      _statusMessage = msg;
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  Future<void> _captureAndRecognise() async {
    if (_status != _ScanStatus.ready || _controller == null) return;
    _setStatus(_ScanStatus.capturing, 'Capturing…');
    try {
      final xFile = await _controller!.takePicture();
      final file = File(xFile.path);
      _capturedFile = file;
      _setStatus(_ScanStatus.processing, 'Scanning document…');
      final result = await OcrService.instance.recognizeText(file);
      if (!mounted) return;
      setState(() {
        _result = result;
        _status = _ScanStatus.done;
      });
    } catch (e) {
      _setStatus(_ScanStatus.error, 'Capture failed: $e');
    }
  }

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
    );
    if (xFile == null) return;
    final file = File(xFile.path);
    _capturedFile = file;
    _setStatus(_ScanStatus.processing, 'Scanning document…');
    try {
      final result = await OcrService.instance.recognizeText(file);
      if (!mounted) return;
      setState(() {
        _result = result;
        _status = _ScanStatus.done;
      });
    } catch (e) {
      _setStatus(_ScanStatus.error, 'OCR failed: $e');
    }
  }

  void _retake() {
    setState(() {
      _result = null;
      _capturedFile = null;
      _status = _ScanStatus.ready;
    });
  }

  Future<void> _toggleFlash() async {
    if (_controller == null) return;
    final next = _flashOn ? FlashMode.off : FlashMode.torch;
    await _controller!.setFlashMode(next);
    setState(() => _flashOn = !_flashOn);
  }

  void _acceptResult() {
    Navigator.of(context).pop(_result);
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera preview
          _buildCameraPreview(),
          // Dark overlay with document frame cutout
          if (_status == _ScanStatus.ready) _DocumentFrameOverlay(),
          // Status badge
          _buildStatusBadge(),
          // Top bar (close + flash)
          _buildTopBar(),
          // Bottom controls
          _buildBottomBar(),
          // Processing spinner
          if (_status == _ScanStatus.processing ||
              _status == _ScanStatus.capturing)
            _buildSpinner(),
        ],
      ),
    );
  }

  Widget _buildCameraPreview() {
    if (_status == _ScanStatus.done && _capturedFile != null) {
      return Image.file(_capturedFile!, fit: BoxFit.cover);
    }
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_status == _ScanStatus.error) ...[
              Icon(Icons.warning_amber_rounded, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text(
                _statusMessage ?? 'Error',
                style: const TextStyle(color: Colors.white, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ] else
              const CircularProgressIndicator(color: Colors.white),
          ],
        ),
      );
    }
    return CameraPreview(ctrl);
  }

  Widget _buildTopBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Close button
            _iconCircle(
              icon: Icons.close,
              onTap: () => Navigator.of(context).pop(null),
            ),
            // Title
            const Text(
              'Scan Document',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
            // Flash toggle
            _iconCircle(
              icon: _flashOn ? Icons.flash_on : Icons.flash_off,
              onTap: _toggleFlash,
              active: _flashOn,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    if (_status == _ScanStatus.done && _result != null) {
      return Align(
        alignment: Alignment.bottomCenter,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // OCR confidence chip
                _ConfidencePill(confidence: _result!.overallConfidence),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _OutlineBtn(
                        label: 'Retake',
                        icon: Icons.refresh,
                        onTap: _retake,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: _SolidBtn(
                        label: 'Use This',
                        icon: Icons.check_circle_outline,
                        onTap: _acceptResult,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_status == _ScanStatus.error) {
      return Align(
        alignment: Alignment.bottomCenter,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
            child: Row(
              children: [
                Expanded(
                  child: _OutlineBtn(
                    label: 'Gallery',
                    icon: Icons.photo_library_outlined,
                    onTap: _pickFromGallery,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Ready state controls
    return Align(
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Gallery fallback
              _iconCircle(
                icon: Icons.photo_library_outlined,
                onTap: _pickFromGallery,
                size: 48,
              ),
              // Capture button
              GestureDetector(
                onTap: _captureAndRecognise,
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white.withAlpha(80),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.camera_alt, color: Colors.black, size: 34),
                ),
              ),
              // Spacer to balance layout
              const SizedBox(width: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    String label;
    Color color;
    IconData icon;

    switch (_status) {
      case _ScanStatus.ready:
        label = 'Point at document';
        color = Colors.white.withAlpha(200);
        icon = Icons.crop_free;
      case _ScanStatus.capturing:
        label = 'Capturing…';
        color = KTColors.warning;
        icon = Icons.camera;
      case _ScanStatus.processing:
        label = _statusMessage ?? 'Processing…';
        color = KTColors.info;
        icon = Icons.document_scanner_outlined;
      case _ScanStatus.done:
        label = 'Scan complete';
        color = KTColors.success;
        icon = Icons.check_circle_outline;
      default:
        return const SizedBox.shrink();
    }

    return Positioned(
      top: MediaQuery.of(context).padding.top + 64,
      left: 0,
      right: 0,
      child: Center(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.black.withAlpha(160),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withAlpha(120)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpinner() {
    return Container(
      color: Colors.black.withAlpha(140),
      child: const Center(
        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
      ),
    );
  }

  Widget _iconCircle({
    required IconData icon,
    required VoidCallback onTap,
    bool active = false,
    double size = 44,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active
              ? Colors.white.withAlpha(40)
              : Colors.black.withAlpha(100),
          border: Border.all(color: Colors.white.withAlpha(80)),
        ),
        child: Icon(icon, color: Colors.white, size: size * 0.48),
      ),
    );
  }
}

// ─── Document frame overlay ───────────────────────────────────────────────────

class _DocumentFrameOverlay extends StatelessWidget {
  const _DocumentFrameOverlay();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _FramePainter(),
      child: Container(),
    );
  }
}

class _FramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Dim the area outside the frame
    final dimPaint = Paint()..color = Colors.black.withAlpha(120);
    final frameW = size.width * 0.85;
    final frameH = frameW * 0.63; // A4/document aspect ratio
    final left = (size.width - frameW) / 2;
    final top = (size.height - frameH) / 2 - size.height * 0.04;
    final frameRect = Rect.fromLTWH(left, top, frameW, frameH);

    // Draw dim overlay with hole
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(frameRect, const Radius.circular(12)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, dimPaint);

    // Frame border
    final borderPaint = Paint()
      ..color = Colors.white.withAlpha(220)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    canvas.drawRRect(
      RRect.fromRectAndRadius(frameRect, const Radius.circular(12)),
      borderPaint,
    );

    // Corner accents
    const cornerLen = 24.0;
    const cornerRadius = 12.0;
    final cornerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    void drawCorner(double x, double y, double dx, double dy) {
      canvas.drawLine(Offset(x + dx * cornerRadius, y), Offset(x + dx * (cornerRadius + cornerLen), y), cornerPaint);
      canvas.drawLine(Offset(x, y + dy * cornerRadius), Offset(x, y + dy * (cornerRadius + cornerLen)), cornerPaint);
      // Arc
      final arcRect = Rect.fromCenter(
        center: Offset(x + dx * cornerRadius, y + dy * cornerRadius),
        width: cornerRadius * 2,
        height: cornerRadius * 2,
      );
      final startAngle = dx < 0
          ? (dy < 0 ? 1.5 * 3.14159 : 0.0)
          : (dy < 0 ? 3.14159 : 0.5 * 3.14159);
      canvas.drawArc(arcRect, startAngle, 0.5 * 3.14159, false, cornerPaint);
    }

    drawCorner(left, top, 1, 1);                         // top-left
    drawCorner(left + frameW, top, -1, 1);               // top-right
    drawCorner(left, top + frameH, 1, -1);               // bottom-left
    drawCorner(left + frameW, top + frameH, -1, -1);     // bottom-right
  }

  @override
  bool shouldRepaint(covariant CustomPainter o) => false;
}

// ─── Small reusable widgets ───────────────────────────────────────────────────

class _ConfidencePill extends StatelessWidget {
  final double confidence;
  const _ConfidencePill({required this.confidence});

  @override
  Widget build(BuildContext context) {
    final pct = (confidence * 100).round();
    final color = pct >= 75
        ? KTColors.success
        : pct >= 50
            ? KTColors.warning
            : KTColors.danger;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withAlpha(160),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withAlpha(120)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.auto_awesome, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            'OCR confidence: $pct%',
            style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _SolidBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _SolidBtn({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: KTColors.driverAccent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OutlineBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _OutlineBtn({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withAlpha(120)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 17, color: Colors.white.withAlpha(220)),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withAlpha(220),
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
