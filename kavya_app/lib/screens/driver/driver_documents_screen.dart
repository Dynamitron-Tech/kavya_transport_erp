import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/section_header.dart';

class DriverDocumentsScreen extends ConsumerStatefulWidget {
  const DriverDocumentsScreen({super.key});

  @override
  ConsumerState<DriverDocumentsScreen> createState() => _DriverDocumentsScreenState();
}

class _DriverDocumentsScreenState extends ConsumerState<DriverDocumentsScreen> {
  final ImagePicker _picker = ImagePicker();
  List<DocumentItem> _documents = [
    DocumentItem(
      id: '1',
      name: 'Vehicle RC',
      type: 'Certificate',
      uploadedDate: '2025-03-10',
      status: 'verified',
    ),
    DocumentItem(
      id: '2',
      name: 'Insurance Policy',
      type: 'Insurance',
      uploadedDate: '2025-03-10',
      status: 'verified',
    ),
    DocumentItem(
      id: '3',
      name: 'Driving License',
      type: 'License',
      uploadedDate: '2025-03-10',
      status: 'verified',
    ),
    DocumentItem(
      id: '4',
      name: 'Route Permit',
      type: 'Permit',
      uploadedDate: '2025-03-10',
      status: 'verified',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Documents')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Important Documents Section
            const SectionHeader(title: 'Vehicle Documents'),
            const SizedBox(height: 12),
            ..._documents.where((d) => ['Certificate', 'Insurance', 'Permit'].contains(d.type)).map(_documentCard),
            const SizedBox(height: 24),

            // Driver Documents
            const SectionHeader(title: 'Driver Documents'),
            const SizedBox(height: 12),
            ..._documents.where((d) => d.type == 'License').map(_documentCard),
            const SizedBox(height: 24),

            // Trip Documents
            const SectionHeader(title: 'Trip Documents'),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.folder_open_outlined, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('No trip documents yet', style: TextStyle(color: KTColors.textSecondary)),
                    const SizedBox(height: 16),
                    KtButton(
                      label: 'Upload Trip Document',
                      icon: Icons.cloud_upload,
                      outlined: true,
                      onPressed: () => _pickDocument('trip'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Receipt Photos
            const SectionHeader(title: 'Receipt Photos'),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.image_outlined, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('No receipt photos yet', style: TextStyle(color: KTColors.textSecondary)),
                    const SizedBox(height: 16),
                    KtButton(
                      label: 'Upload Receipt Photo',
                      icon: Icons.camera_alt,
                      outlined: true,
                      onPressed: () => _pickPhoto(),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _documentCard(DocumentItem doc) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: _getDocumentColor(doc.type).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(_getDocumentIcon(doc.type), color: _getDocumentColor(doc.type)),
        ),
        title: Text(doc.name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Uploaded ${doc.uploadedDate}', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _getStatusColor(doc.status).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                doc.status.toUpperCase(),
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _getStatusColor(doc.status)),
              ),
            ),
            const SizedBox(height: 4),
            Icon(
              doc.status == 'verified' ? Icons.check_circle : Icons.clock_outlined,
              size: 16,
              color: _getStatusColor(doc.status),
            ),
          ],
        ),
        onTap: () => _showDocumentPreview(doc),
      ),
    );
  }

  void _showDocumentPreview(DocumentItem doc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(doc.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.description,
                size: 80,
                color: Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Type: ${doc.type}', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                const SizedBox(height: 4),
                Text('Uploaded: ${doc.uploadedDate}', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                const SizedBox(height: 4),
                Text('Status: ${doc.status}', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          TextButton(onPressed: () {
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Document downloaded')));
          }, child: const Text('Download')),
        ],
      ),
    );
  }

  Future<void> _pickDocument(String type) async {
    try {
      final result = await _picker.pickImage(source: ImageSource.gallery);
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document uploaded successfully')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
      );
    }
  }

  Future<void> _pickPhoto() async {
    try {
      final result = await _picker.pickImage(source: ImageSource.camera);
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo uploaded successfully')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
      );
    }
  }

  IconData _getDocumentIcon(String type) {
    const icons = {
      'Certificate': Icons.verified,
      'Insurance': Icons.shield,
      'License': Icons.card_membership,
      'Permit': Icons.assignment,
    };
    return icons[type] ?? Icons.description;
  }

  Color _getDocumentColor(String type) {
    const colors = {
      'Certificate': KTColors.success,
      'Insurance': KTColors.info,
      'License': KTColors.primary,
      'Permit': KTColors.warning,
    };
    return colors[type] ?? KTColors.textMuted;
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'verified': return KTColors.success;
      case 'pending': return KTColors.warning;
      case 'rejected': return KTColors.danger;
      default: return KTColors.textMuted;
    }
  }
}

class DocumentItem {
  final String id;
  final String name;
  final String type;
  final String uploadedDate;
  final String status;

  DocumentItem({
    required this.id,
    required this.name,
    required this.type,
    required this.uploadedDate,
    required this.status,
  });
}
