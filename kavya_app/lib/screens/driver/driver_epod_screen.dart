import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../providers/trip_provider.dart';
import '../../services/notification_service.dart';
import '../../widgets/fireworks_overlay.dart';
import '../../core/localization/locale_provider.dart';

class DriverEpodScreen extends ConsumerStatefulWidget {
  final int tripId;
  const DriverEpodScreen({super.key, required this.tripId});

  @override
  ConsumerState<DriverEpodScreen> createState() => _DriverEpodScreenState();
}

class _DriverEpodScreenState extends ConsumerState<DriverEpodScreen> {
  int _currentStep = 0; // 0=details 1=signature 2=photo 3=review
  bool _deliveryConfirmed = false;
  final _receiverNameCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  File? _photoProof;
  bool _submitting = false;

  File? _signaturePhoto;  // photo of receiver's signature
  bool get _hasSignature => _signaturePhoto != null;

  static const _steps = ['Delivery Details', 'Signature', 'Photo Proof', 'Review & Submit'];

  @override
  void initState() {
    super.initState();
    // Notify driver that they are almost done
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationService().showTripEvent(
        title: "You're almost done! 🏁",
        body: 'Complete the delivery process to finish your trip.',
      );
    });
  }

  Future<void> _captureSignature(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, maxWidth: 1280, imageQuality: 85);
    if (picked != null) setState(() => _signaturePhoto = File(picked.path));
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, maxWidth: 1280, imageQuality: 80);
    if (picked != null) setState(() => _photoProof = File(picked.path));
  }

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1280, imageQuality: 80);
    if (picked != null) setState(() => _photoProof = File(picked.path));
  }

  void _next() {
    if (_currentStep == 0 && !_deliveryConfirmed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please confirm the delivery checkbox')),
      );
      return;
    }
    if (_currentStep == 1 && !_hasSignature) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please capture a photo of the receiver\'s signature')),
      );
      return;
    }
    if (_currentStep < 3) {
      setState(() => _currentStep++);
    } else {
      _submit();
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      // Upload signature photo
      if (_signaturePhoto != null) {
        await api.uploadDocument(_signaturePhoto!, 'epod_signature', widget.tripId.toString());
      }
      // Upload delivery proof photo
      if (_photoProof != null) {
        await api.uploadDocument(_photoProof!, 'epod_photo', widget.tripId.toString());
      }
      // Mark trip as completed (correct status accepted by backend)
      await api.updateTripStatus(widget.tripId, 'completed');

      // Refresh both trip providers so Trips screen updates immediately
      ref.invalidate(tripDetailProvider(widget.tripId));
      ref.invalidate(tripsPaginatedProvider);

      if (mounted) {
        // Fire completion notification
        NotificationService().showTripEvent(
          title: 'Congratulations! 🎉',
          body: 'The trip is completed. Great job!',
        );
        // Show fireworks overlay — navigates to trips list on dismiss
        _showFireworks();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ePOD failed: $e'), backgroundColor: KTColors.danger),
        );
        setState(() => _submitting = false);
      }
    }
  }

  @override
  void dispose() {
    _receiverNameCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  void _showFireworks() {
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => FireworksOverlay(
        onDone: () {
          entry.remove();
          if (mounted) context.go('/driver/trips');
        },
      ),
    );
    Overlay.of(context).insert(entry);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);
    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text(s.completeDeliveryEpod, style: KTTextStyles.h3),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // Step indicator
          _buildStepBar(),
          // Step content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _buildStepContent(),
            ),
          ),
          // Bottom navigation
          _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildStepBar() {
    return Container(
      color: KTColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(_steps.length, (i) {
          final done = i < _currentStep;
          final active = i == _currentStep;
          return Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        margin: const EdgeInsets.only(bottom: 4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: done
                              ? KTColors.success
                              : active
                                  ? KTColors.primary
                                  : const Color(0xFF334155),
                        ),
                        child: Center(
                          child: done
                              ? const Icon(Icons.check, size: 14, color: Colors.white)
                              : Text(
                                  '${i + 1}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: active ? Colors.white : KTColors.textMuted,
                                  ),
                                ),
                        ),
                      ),
                      Text(
                        _steps[i],
                        style: TextStyle(
                          fontSize: 9,
                          color: active ? KTColors.primary : done ? KTColors.success : KTColors.textMuted,
                          fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (i < _steps.length - 1)
                  Container(
                    height: 2,
                    width: 12,
                    margin: const EdgeInsets.only(bottom: 16),
                    color: i < _currentStep ? KTColors.success : const Color(0xFF334155),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _buildDeliveryDetails();
      case 1:
        return _buildSignature();
      case 2:
        return _buildPhotoProof();
      case 3:
        return _buildReview();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildDeliveryDetails() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Confirm Delivery', style: KTTextStyles.h3),
        const SizedBox(height: 4),
        const Text('Enter receiver details and confirm goods condition', style: TextStyle(color: KTColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 20),
        _darkField(controller: _receiverNameCtrl, label: 'Receiver Name', icon: Icons.person_outline),
        const SizedBox(height: 16),
        _darkField(controller: _remarksCtrl, label: 'Delivery Remarks (optional)', icon: Icons.note_outlined, maxLines: 3),
        const SizedBox(height: 20),
        InkWell(
          onTap: () => setState(() => _deliveryConfirmed = !_deliveryConfirmed),
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _deliveryConfirmed
                  ? KTColors.success.withValues(alpha: 0.1)
                  : const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _deliveryConfirmed ? KTColors.success : const Color(0xFF334155),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _deliveryConfirmed ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  color: _deliveryConfirmed ? KTColors.success : KTColors.textMuted,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'I confirm goods were delivered in good condition',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSignature() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Receiver Signature', style: KTTextStyles.h3),
        const SizedBox(height: 4),
        const Text('Ask the receiver to sign on paper, then capture a photo of it', style: TextStyle(color: KTColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 20),
        if (_signaturePhoto != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(_signaturePhoto!, height: 220, width: double.infinity, fit: BoxFit.cover),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: KTColors.success, size: 16),
              const SizedBox(width: 6),
              const Text('Signature photo captured', style: TextStyle(color: KTColors.success, fontSize: 13, fontWeight: FontWeight.w500)),
              const Spacer(),
              TextButton.icon(
                onPressed: () => setState(() => _signaturePhoto = null),
                icon: const Icon(Icons.delete_outline_rounded, size: 16),
                label: const Text('Remove'),
                style: TextButton.styleFrom(foregroundColor: KTColors.danger),
              ),
            ],
          ),
          const SizedBox(height: 4),
        ] else ...[
          Container(
            height: 180,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF334155), width: 1.5),
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.draw_outlined, size: 40, color: Color(0xFF475569)),
                SizedBox(height: 10),
                Text('No signature photo yet', style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
                SizedBox(height: 4),
                Text('Use Camera or Gallery below', style: TextStyle(color: Color(0xFF475569), fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        Row(
          children: [
            Expanded(
              child: _actionButton(
                icon: Icons.camera_alt_rounded,
                label: _signaturePhoto != null ? 'Retake' : 'Camera',
                onTap: () => _captureSignature(ImageSource.camera),
                primary: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _actionButton(
                icon: Icons.photo_library_rounded,
                label: 'Gallery',
                onTap: () => _captureSignature(ImageSource.gallery),
                primary: false,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPhotoProof() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Photo Proof', style: KTTextStyles.h3),
        const SizedBox(height: 4),
        const Text('Take a photo of delivered goods or signed document (optional)', style: TextStyle(color: KTColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 20),
        if (_photoProof != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(_photoProof!, height: 220, width: double.infinity, fit: BoxFit.cover),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: _actionButton(
                icon: Icons.camera_alt_rounded,
                label: _photoProof != null ? 'Retake Photo' : 'Camera',
                onTap: _takePhoto,
                primary: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _actionButton(
                icon: Icons.photo_library_rounded,
                label: 'Gallery',
                onTap: _pickFromGallery,
                primary: false,
              ),
            ),
          ],
        ),
        if (_photoProof == null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KTColors.warning.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: KTColors.warning.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, color: KTColors.warning, size: 16),
                const SizedBox(width: 8),
                const Expanded(child: Text('Photo is optional but recommended for records', style: TextStyle(color: KTColors.textSecondary, fontSize: 12))),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildReview() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Review & Submit', style: KTTextStyles.h3),
        const SizedBox(height: 4),
        const Text('Confirm all details before submitting', style: TextStyle(color: KTColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Column(
            children: [
              _reviewRow(Icons.tag, 'Trip', 'Trip #${widget.tripId}'),
              const Divider(height: 20, color: Color(0xFF334155)),
              _reviewRow(Icons.person_outline, 'Receiver',
                  _receiverNameCtrl.text.trim().isEmpty ? 'Not provided' : _receiverNameCtrl.text.trim()),
              const Divider(height: 20, color: Color(0xFF334155)),
              _reviewRow(Icons.draw_outlined, 'Signature', _hasSignature ? 'Captured ✓' : 'Missing ✗',
                  valueColor: _hasSignature ? KTColors.success : KTColors.danger),
              const Divider(height: 20, color: Color(0xFF334155)),
              _reviewRow(Icons.photo_camera_outlined, 'Photo',
                  _photoProof != null ? 'Taken ✓' : 'Skipped',
                  valueColor: _photoProof != null ? KTColors.success : KTColors.textSecondary),
              if (_remarksCtrl.text.trim().isNotEmpty) ...[
                const Divider(height: 20, color: Color(0xFF334155)),
                _reviewRow(Icons.note_outlined, 'Remarks', _remarksCtrl.text.trim()),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (!_hasSignature)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KTColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: KTColors.danger.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: KTColors.danger, size: 16),
                const SizedBox(width: 8),
                const Expanded(child: Text('Signature is missing — go back to capture it', style: TextStyle(color: KTColors.danger, fontSize: 12))),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildBottomBar() {
    final isLast = _currentStep == 3;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: KTColors.surface,
        border: Border(top: BorderSide(color: Color(0xFF334155))),
      ),
      child: Row(
        children: [
          if (_currentStep > 0)
            Expanded(
              flex: 1,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF334155)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => setState(() => _currentStep--),
                child: const Text('Back', style: TextStyle(color: KTColors.textSecondary)),
              ),
            ),
          if (_currentStep > 0) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: isLast ? KTColors.success : KTColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _submitting ? null : _next,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(isLast ? Icons.check_circle_rounded : Icons.arrow_forward_rounded, size: 18),
                        const SizedBox(width: 8),
                        Text(isLast ? 'Submit & Complete' : 'Next', style: const TextStyle(fontWeight: FontWeight.w700)),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _darkField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: KTColors.textSecondary),
        prefixIcon: Icon(icon, color: KTColors.textSecondary),
        filled: true,
        fillColor: const Color(0xFF1E293B),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF334155)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF334155)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: KTColors.primary),
        ),
      ),
    );
  }

  Widget _actionButton({required IconData icon, required String label, required VoidCallback onTap, required bool primary}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: primary ? KTColors.primary.withValues(alpha: 0.1) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: primary ? KTColors.primary.withValues(alpha: 0.4) : const Color(0xFF334155)),
        ),
        child: Column(
          children: [
            Icon(icon, color: primary ? KTColors.primary : KTColors.textSecondary),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 12, color: primary ? KTColors.primary : KTColors.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _reviewRow(IconData icon, String label, String value, {Color? valueColor}) {
    return Row(
      children: [
        Icon(icon, size: 16, color: KTColors.textMuted),
        const SizedBox(width: 8),
        SizedBox(width: 80, child: Text(label, style: const TextStyle(color: KTColors.textSecondary, fontSize: 13))),
        Expanded(
          child: Text(
            value,
            style: TextStyle(fontWeight: FontWeight.w600, color: valueColor ?? Colors.white),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}
