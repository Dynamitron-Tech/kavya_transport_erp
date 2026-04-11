import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lottie/lottie.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart'; // For apiServiceProvider

class AssociateDocUploadScreen extends ConsumerStatefulWidget {
  const AssociateDocUploadScreen({super.key});

  @override
  ConsumerState<AssociateDocUploadScreen> createState() => _AssociateDocUploadScreenState();
}

class _AssociateDocUploadScreenState extends ConsumerState<AssociateDocUploadScreen> {
  final ImagePicker _picker = ImagePicker(); //
  
  String? _selectedDocType;
  final List<String> _docTypes = ['Invoice', 'LR copy', 'POD', 'EWB', 'Other']; // [cite: 98, 99]
  
  String? _linkedRecord;
  final List<File> _images = []; // Support for multi-page docs [cite: 100]
  
  bool _isUploading = false; //
  bool _uploadSuccess = false; //

  Future<void> _pickImage(ImageSource source) async {
    final XFile? image = await _picker.pickImage(source: source, imageQuality: 80); // Two buttons: "Camera" | "Gallery" [cite: 99, 100]
    if (image != null) {
      setState(() => _images.add(File(image.path))); // On capture/select: image preview shown [cite: 100]
    }
  }

  Future<void> _uploadDocument() async {
    if (_selectedDocType == null || _linkedRecord == null || _images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please complete all steps'), backgroundColor: KTColors.danger)); // [cite: 117]
      return;
    }

    setState(() => _isUploading = true); // Progress indicator during upload [cite: 100]

    try {
      // API Call: POST /api/v1/documents/upload (multipart/form-data) [cite: 100]
      // In a real scenario, you'd loop through _images if the API supports multiple files, 
      // or map them to separate calls. We'll use the first one to mock the flow.
      await ref.read(apiServiceProvider).uploadDocument(_images.first, _selectedDocType!, _linkedRecord!);
      
      if (mounted) setState(() => _uploadSuccess = true); // On success: green check animation (Lottie) [cite: 100]
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
    } finally {
      if (mounted) setState(() => _isUploading = false); //
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_uploadSuccess) {
      return Scaffold(
        backgroundColor: KTColors.cardSurface,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Lottie.asset('assets/lottie/success.json', width: 150, repeat: false), // On success: green check animation (Lottie) [cite: 100]
              const SizedBox(height: 24),
              Text("Document Uploaded", style: KTTextStyles.h2),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () => context.go('/associate/home'),
                child: const Text("Back to Home"),
              )
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text("Upload document")), // [cite: 98]
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Step 1: Select document type [cite: 98]
            Text("Step 1: Document type", style: KTTextStyles.h3),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _docTypes.map((type) {
                final isSelected = _selectedDocType == type;
                return ChoiceChip( // Large button grid / Selected type highlighted in purple [cite: 98, 99]
                  label: Text(type),
                  selected: isSelected,
                  onSelected: (selected) => setState(() => _selectedDocType = selected ? type : null),
                  selectedColor: KTColors.roleAssociate.withOpacity(0.2),
                  labelStyle: TextStyle(color: isSelected ? KTColors.roleAssociate : Colors.black87),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(color: isSelected ? KTColors.roleAssociate : Colors.grey.shade300),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            // Step 2: Link to record [cite: 99]
            Text("Step 2: Link to record", style: KTTextStyles.h3),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Select Job/Trip/Vehicle"), // Dropdown to select matched record [cite: 99]
              items: ['KT-T-0089', 'KT-2026-0042', 'TN01AB1234'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (val) => setState(() => _linkedRecord = val),
            ),
            const SizedBox(height: 32),

            // Step 3: Capture / select [cite: 99]
            Text("Step 3: Capture document", style: KTTextStyles.h3),
            const SizedBox(height: 12),
            if (_images.isEmpty)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickImage(ImageSource.camera), // "Camera" [cite: 99]
                      icon: const Icon(Icons.camera_alt),
                      label: const Text("Camera"),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickImage(ImageSource.gallery), // "Gallery" [cite: 100]
                      icon: const Icon(Icons.photo_library),
                      label: const Text("Gallery"),
                    ),
                  ),
                ],
              )
            else ...[
              // Image preview shown (full width, cropped to 4:3) [cite: 100]
              AspectRatio(
                aspectRatio: 4 / 3,
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12)),
                  child: Image.file(_images.first, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton.icon(
                    onPressed: () {
                      setState(() => _images.clear());
                      _pickImage(ImageSource.camera); // "Retake" option [cite: 100]
                    },
                    icon: const Icon(Icons.refresh),
                    label: const Text("Retake"),
                  ),
                  TextButton.icon(
                    onPressed: () => _pickImage(ImageSource.camera), // "Add another page" [cite: 100]
                    icon: const Icon(Icons.add),
                    label: const Text("Add page"),
                  ),
                ],
              )
            ],
            
            const SizedBox(height: 48),

            // Step 4: Upload button [cite: 100]
            ElevatedButton(
              onPressed: _isUploading ? null : _uploadDocument,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.roleAssociate, // Use associate theme color
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isUploading 
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) // [cite: 110]
                : const Text("Upload Document", style: TextStyle(fontSize: 16)), // "Upload" button [cite: 100]
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}