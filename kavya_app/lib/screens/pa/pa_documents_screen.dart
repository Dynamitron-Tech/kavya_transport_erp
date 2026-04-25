import 'dart:io';
import 'package:dio/dio.dart' as dio;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider
import '../../services/api_service.dart';

// Document types required for a trip
const _requiredDocs = [
  ('LR Copy', 'lr_copy'),
  ('Loading Slip', 'loading_slip'),
  ('Weigh-bridge Slip', 'weighbridge_slip'),
  ('POD / Delivery Receipt', 'pod'),
  ('Vehicle RC', 'vehicle_rc'),
  ('Driver License', 'driver_license'),
];

final _tripDocsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/documents', queryParameters: {'entity_type': 'trip', 'entity_id': tripId});
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

class PADocumentsScreen extends ConsumerWidget {
  final int tripId;
  const PADocumentsScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(_tripDocsProvider(tripId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('Documents', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        leading: const BackButton(color: KTColors.textHeading),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: KTColors.textHeading),
            onPressed: () => ref.invalidate(_tripDocsProvider(tripId)),
          ),
        ],
      ),
      body: docsAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_tripDocsProvider(tripId)),
        ),
        data: (data) {
          final uploadedTypes = <String>{};
          if (data['documents'] is List) {
            for (final d in data['documents'] as List) {
              if (d is Map && d['document_type'] != null) {
                uploadedTypes.add(d['document_type'] as String);
              }
            }
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Upload zone header ──────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: KTColors.paAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: KTColors.paAccent.withOpacity(0.4), style: BorderStyle.none),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_upload_outlined, color: KTColors.paAccent, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Upload Trip Documents',
                              style: KTTextStyles.body.copyWith(
                                color: KTColors.textHeading,
                                fontWeight: FontWeight.w600,
                              )),
                          Text('Tap on any document below to upload / replace',
                              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Document checklist ──────────────────────────────────
              ..._requiredDocs.map((doc) {
                final isUploaded = uploadedTypes.contains(doc.$2);
                return _DocItemTile(
                  label: doc.$1,
                  docType: doc.$2,
                  tripId: tripId,
                  isUploaded: isUploaded,
                  onUploaded: () => ref.invalidate(_tripDocsProvider(tripId)),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}

class _DocItemTile extends StatefulWidget {
  final String label;
  final String docType;
  final int tripId;
  final bool isUploaded;
  final VoidCallback onUploaded;

  const _DocItemTile({
    required this.label,
    required this.docType,
    required this.tripId,
    required this.isUploaded,
    required this.onUploaded,
  });

  @override
  State<_DocItemTile> createState() => _DocItemTileState();
}

class _DocItemTileState extends State<_DocItemTile> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null || !mounted) return;

    setState(() => _uploading = true);
    try {
      final file = File(picked.path);
      final fileName = file.path.split('/').last;
      final api = ApiService();
      final formData = dio.FormData.fromMap({
        'file': await dio.MultipartFile.fromFile(file.path, filename: fileName),
        'document_type': widget.docType,
        'entity_type': 'trip',
        'entity_id': widget.tripId,
      });
      await api.post('/documents/upload', data: formData);

      widget.onUploaded();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.label} uploaded'),
            backgroundColor: KTColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Icon(
            widget.isUploaded ? Icons.check_circle : Icons.radio_button_unchecked,
            color: widget.isUploaded ? KTColors.success : KTColors.textMuted,
            size: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.label,
                    style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                Text(
                  widget.isUploaded ? 'Uploaded' : 'Missing',
                  style: KTTextStyles.bodySmall.copyWith(
                    color: widget.isUploaded ? KTColors.success : KTColors.warning,
                  ),
                ),
              ],
            ),
          ),
          if (_uploading)
            const SizedBox(
              height: 20, width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: KTColors.paAccent),
            )
          else
            IconButton(
              icon: Icon(
                widget.isUploaded ? Icons.upload : Icons.upload,
                color: KTColors.paAccent,
                size: 20,
              ),
              tooltip: widget.isUploaded ? 'Replace' : 'Upload',
              onPressed: _pickAndUpload,
            ),
        ],
      ),
    );
  }
}
