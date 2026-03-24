import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../core/localization/locale_provider.dart';

class DriverDocumentsScreen extends ConsumerStatefulWidget {
  const DriverDocumentsScreen({super.key});

  @override
  ConsumerState<DriverDocumentsScreen> createState() => _DriverDocumentsScreenState();
}

class _DriverDocumentsScreenState extends ConsumerState<DriverDocumentsScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _loading = true;
  String? _error;
  Map<String, _DriverDoc?> _docs = {};

  static const _docTypes = [
    _DocMeta(key: 'driving_license', label: 'Driving License', icon: Icons.badge_outlined, color: KTColors.info),
    _DocMeta(key: 'aadhaar_card', label: 'Aadhaar Card', icon: Icons.credit_card_outlined, color: KTColors.success),
    _DocMeta(key: 'driver_badge', label: 'Driver Badge', icon: Icons.verified_user_outlined, color: KTColors.amber500),
    _DocMeta(key: 'medical_fitness', label: 'Medical Fitness', icon: Icons.health_and_safety_outlined, color: KTColors.danger),
  ];

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiServiceProvider);
      final items = await api.getMyDocuments();
      final map = <String, _DriverDoc?>{};
      for (final meta in _docTypes) {
        map[meta.key] = null;
      }
      for (final item in items) {
        final type = item['document_type'] as String?;
        if (type != null && map.containsKey(type)) {
          map[type] = _DriverDoc(
            id: item['id'] as int,
            documentType: type,
            documentNumber: item['document_number'] as String?,
            fileUrl: item['file_url'] as String?,
            isVerified: item['is_verified'] == true,
            uploadedAt: item['uploaded_at'] as String?,
          );
        }
      }
      setState(() { _docs = map; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Failed to load documents'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);
    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        title: Text(
          s.driverDocuments,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: KTColors.darkTextPrimary,
            letterSpacing: 0.3,
          ),
        ),
        iconTheme: const IconThemeData(color: KTColors.darkTextPrimary),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KTColors.amber500))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  color: KTColors.amber500,
                  backgroundColor: KTColors.darkSurface,
                  onRefresh: _loadDocuments,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                    children: [
                      // Header info
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: KTColors.amber500.withAlpha(18),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: KTColors.amber500.withAlpha(40)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline, size: 18, color: KTColors.amber500.withAlpha(200)),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text(
                                'Upload all required documents for verification. Accepted formats: JPG, PNG.',
                                style: TextStyle(fontSize: 12.5, color: KTColors.darkTextSecondary, height: 1.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Document cards
                      ..._docTypes.map((meta) => _buildDocumentCard(meta, _docs[meta.key])),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, size: 48, color: KTColors.danger.withAlpha(180)),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: KTColors.darkTextSecondary, fontSize: 14)),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: _loadDocuments,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Retry'),
            style: TextButton.styleFrom(foregroundColor: KTColors.amber500),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentCard(_DocMeta meta, _DriverDoc? doc) {
    final bool uploaded = doc != null && doc.fileUrl != null && doc.fileUrl!.isNotEmpty;
    final bool verified = doc?.isVerified == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: uploaded
              ? (verified ? KTColors.success.withAlpha(60) : KTColors.darkBorder)
              : KTColors.darkBorder.withAlpha(120),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: icon + title + status
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: meta.color.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(meta.icon, color: meta.color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        meta.label,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: KTColors.darkTextPrimary,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      if (uploaded && doc.documentNumber != null && doc.documentNumber!.isNotEmpty)
                        Text(
                          doc.documentNumber!,
                          style: const TextStyle(fontSize: 12, color: KTColors.darkTextSecondary),
                        )
                      else
                        Text(
                          uploaded ? 'Uploaded' : 'Not uploaded',
                          style: TextStyle(
                            fontSize: 12,
                            color: uploaded ? KTColors.darkTextSecondary : KTColors.textMuted,
                          ),
                        ),
                    ],
                  ),
                ),
                _statusBadge(uploaded, verified),
              ],
            ),
            const SizedBox(height: 14),
            // Divider
            Container(height: 1, color: KTColors.darkBorder.withAlpha(80)),
            const SizedBox(height: 14),
            // Action buttons
            if (!uploaded) ...[
              _actionButton(
                label: 'Upload Document',
                icon: Icons.cloud_upload_outlined,
                color: KTColors.amber500,
                filled: true,
                onTap: () => _handleUpload(meta),
              ),
            ] else ...[
              Row(
                children: [
                  Expanded(
                    child: _actionButton(
                      label: 'View',
                      icon: Icons.visibility_outlined,
                      color: KTColors.info,
                      filled: false,
                      onTap: () => _showDocumentPreview(meta, doc),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _actionButton(
                      label: 'Update',
                      icon: Icons.refresh_outlined,
                      color: KTColors.amber500,
                      filled: false,
                      onTap: () => _handleUpdate(meta, doc),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(bool uploaded, bool verified) {
    if (!uploaded) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: KTColors.textMuted.withAlpha(25),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Text(
          'MISSING',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: KTColors.textMuted, letterSpacing: 0.5),
        ),
      );
    }
    if (verified) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: KTColors.success.withAlpha(25),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, size: 12, color: KTColors.success.withAlpha(220)),
            const SizedBox(width: 4),
            const Text(
              'VERIFIED',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: KTColors.success, letterSpacing: 0.5),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: KTColors.amber500.withAlpha(25),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.schedule, size: 12, color: KTColors.amber500.withAlpha(220)),
          const SizedBox(width: 4),
          const Text(
            'PENDING',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: KTColors.amber500, letterSpacing: 0.5),
          ),
        ],
      ),
    );
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required Color color,
    required bool filled,
    required VoidCallback onTap,
  }) {
    return Material(
      color: filled ? color : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: filled ? null : Border.all(color: color.withAlpha(80)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: filled ? Colors.white : color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: filled ? Colors.white : color,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleUpload(_DocMeta meta) async {
    final numberController = TextEditingController();
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: KTColors.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _UploadSheet(meta: meta, numberController: numberController),
    );

    if (result == null || !mounted) return;

    final file = result['file'] as File;
    final docNumber = result['number'] as String?;

    setState(() { _loading = true; });
    try {
      final api = ref.read(apiServiceProvider);
      await api.uploadDriverDocument(file, meta.key, documentNumber: docNumber);
      await _loadDocuments();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${meta.label} uploaded successfully'),
            backgroundColor: KTColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      setState(() { _loading = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: ${_parseError(e)}'),
            backgroundColor: KTColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleUpdate(_DocMeta meta, _DriverDoc doc) async {
    final numberController = TextEditingController(text: doc.documentNumber ?? '');
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: KTColors.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _UploadSheet(meta: meta, numberController: numberController, isUpdate: true),
    );

    if (result == null || !mounted) return;

    final file = result['file'] as File;
    final docNumber = result['number'] as String?;

    setState(() { _loading = true; });
    try {
      final api = ref.read(apiServiceProvider);
      await api.updateDriverDocument(doc.id, file, documentNumber: docNumber);
      await _loadDocuments();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${meta.label} updated successfully'),
            backgroundColor: KTColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      setState(() { _loading = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Update failed: ${_parseError(e)}'),
            backgroundColor: KTColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showDocumentPreview(_DocMeta meta, _DriverDoc doc) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: KTColors.darkSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: meta.color.withAlpha(18),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Icon(meta.icon, color: meta.color, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      meta.label,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: KTColors.darkTextPrimary,
                      ),
                    ),
                  ),
                  _statusBadge(true, doc.isVerified),
                ],
              ),
            ),
            // Image preview
            if (doc.fileUrl != null && doc.fileUrl!.isNotEmpty)
              Container(
                constraints: const BoxConstraints(maxHeight: 300),
                width: double.infinity,
                color: KTColors.darkBg,
                child: Image.network(
                  doc.fileUrl!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Container(
                    height: 180,
                    color: KTColors.darkBg,
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.broken_image_outlined, size: 48, color: KTColors.textMuted),
                        SizedBox(height: 8),
                        Text('Preview unavailable', style: TextStyle(color: KTColors.textMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              )
            else
              Container(
                height: 180,
                color: KTColors.darkBg,
                child: const Center(
                  child: Icon(Icons.description_outlined, size: 56, color: KTColors.textMuted),
                ),
              ),
            // Details
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (doc.documentNumber != null && doc.documentNumber!.isNotEmpty)
                    _detailRow('Document No.', doc.documentNumber!),
                  if (doc.uploadedAt != null)
                    _detailRow('Uploaded', _formatDate(doc.uploadedAt!)),
                  _detailRow('Status', doc.isVerified ? 'Verified' : 'Pending Verification'),
                ],
              ),
            ),
            // Close button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: TextButton.styleFrom(
                    foregroundColor: KTColors.darkTextSecondary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Close', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: KTColors.darkTextSecondary)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: KTColors.darkTextPrimary)),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('409')) return 'Document already exists';
    if (s.contains('400')) return 'Invalid document type';
    if (s.contains('404')) return 'Driver profile not found';
    return 'Something went wrong';
  }
}

// --- Upload / Update Bottom Sheet ---

class _UploadSheet extends StatefulWidget {
  final _DocMeta meta;
  final TextEditingController numberController;
  final bool isUpdate;

  const _UploadSheet({required this.meta, required this.numberController, this.isUpdate = false});

  @override
  State<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends State<_UploadSheet> {
  final ImagePicker _picker = ImagePicker();
  File? _selectedFile;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: KTColors.darkBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Title
          Text(
            widget.isUpdate ? 'Update ${widget.meta.label}' : 'Upload ${widget.meta.label}',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: KTColors.darkTextPrimary),
          ),
          const SizedBox(height: 20),
          // Document number
          TextField(
            controller: widget.numberController,
            style: const TextStyle(color: KTColors.darkTextPrimary, fontSize: 14),
            decoration: InputDecoration(
              labelText: 'Document Number (optional)',
              labelStyle: const TextStyle(color: KTColors.darkTextSecondary, fontSize: 13),
              filled: true,
              fillColor: KTColors.darkBg,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: KTColors.darkBorder.withAlpha(120)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: KTColors.amber500),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 16),
          // File picker area
          GestureDetector(
            onTap: _pickFile,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 28),
              decoration: BoxDecoration(
                color: KTColors.darkBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _selectedFile != null ? KTColors.success.withAlpha(100) : KTColors.darkBorder.withAlpha(120),
                  style: _selectedFile != null ? BorderStyle.solid : BorderStyle.solid,
                ),
              ),
              child: Column(
                children: [
                  Icon(
                    _selectedFile != null ? Icons.check_circle_outline : Icons.add_photo_alternate_outlined,
                    size: 36,
                    color: _selectedFile != null ? KTColors.success : KTColors.darkTextSecondary,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _selectedFile != null
                        ? _selectedFile!.path.split('/').last
                        : 'Tap to select image',
                    style: TextStyle(
                      fontSize: 13,
                      color: _selectedFile != null ? KTColors.darkTextPrimary : KTColors.darkTextSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedFile != null ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.amber500,
                disabledBackgroundColor: KTColors.amber500.withAlpha(60),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              child: Text(
                widget.isUpdate ? 'Update Document' : 'Upload Document',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: 0.3),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickFile() async {
    try {
      final xFile = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (xFile != null) {
        setState(() { _selectedFile = File(xFile.path); });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not pick image: $e'), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  void _submit() {
    Navigator.pop(context, {
      'file': _selectedFile,
      'number': widget.numberController.text.trim(),
    });
  }
}

// --- Data classes ---

class _DocMeta {
  final String key;
  final String label;
  final IconData icon;
  final Color color;
  const _DocMeta({required this.key, required this.label, required this.icon, required this.color});
}

class _DriverDoc {
  final int id;
  final String documentType;
  final String? documentNumber;
  final String? fileUrl;
  final bool isVerified;
  final String? uploadedAt;

  _DriverDoc({
    required this.id,
    required this.documentType,
    this.documentNumber,
    this.fileUrl,
    this.isVerified = false,
    this.uploadedAt,
  });
}
