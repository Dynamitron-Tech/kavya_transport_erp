import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';

class AssociateEWBCreateScreen extends ConsumerStatefulWidget {
  final String? lrId; // Query param: ?lr_id= [cite: 94]
  const AssociateEWBCreateScreen({super.key, this.lrId});

  @override
  ConsumerState<AssociateEWBCreateScreen> createState() => _AssociateEWBCreateScreenState();
}

class _AssociateEWBCreateScreenState extends ConsumerState<AssociateEWBCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  String? _generatedEwbNumber; // [cite: 96]
  String? _ewbValidUntil;

  // Form Controllers
  final _vehicleNo = TextEditingController(text: 'TN01AB1234'); // auto-filled, editable [cite: 95]
  final _transporterId = TextEditingController(text: '33AAAAA0000A1Z5');
  String _transportMode = 'Road';
  
  final _fromPin = TextEditingController();
  final _toPin = TextEditingController();
  final _distance = TextEditingController();
  
  String _docType = 'Invoice';
  final _docNo = TextEditingController();
  DateTime _docDate = DateTime.now();

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return; // [cite: 116]

    setState(() => _isLoading = true);

    try {
      // API Call: POST /api/v1/eway-bills/generate [cite: 96]
      // Shows loading indicator (can take 5-10 seconds for GST portal call)
      await Future.delayed(const Duration(seconds: 4)); 
      
      if (mounted) {
        setState(() {
          _generatedEwbNumber = "123456789012";
          _ewbValidUntil = "19 Mar 2026, 23:59";
        });
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_generatedEwbNumber != null) {
      return _buildSuccessScreen(); // [cite: 96]
    }

    return Scaffold(
      appBar: AppBar(title: const Text("Generate E-way bill")), // [cite: 94]
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSectionHeader("LR details"), // [cite: 94-95]
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("LR: ${widget.lrId ?? 'Not linked'}", style: KTTextStyles.h3),
                    const Text("Consignor GST: 33BBBBB0000B1Z5\nConsignee GST: 33CCCCC0000C1Z5\nGoods value: ₹1,45,000"), // read-only, auto-filled from LR
                  ],
                ),
              ),
            ),
            
            _buildSectionHeader("Transport"), // [cite: 95]
            TextFormField(controller: _vehicleNo, decoration: const InputDecoration(labelText: "Vehicle number"), validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _transporterId, decoration: const InputDecoration(labelText: "Transporter ID (GSTIN)"), validator: (val) => val!.length != 15 ? 'Invalid ID' : null),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _transportMode,
              decoration: const InputDecoration(labelText: "Mode"),
              items: ['Road', 'Rail', 'Air', 'Ship'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (val) => setState(() => _transportMode = val!),
            ),

            _buildSectionHeader("Route"), // [cite: 95]
            Row(
              children: [
                Expanded(child: TextFormField(controller: _fromPin, decoration: const InputDecoration(labelText: "From PIN"), keyboardType: TextInputType.number, maxLength: 6, validator: (val) => val!.length != 6 ? 'Required' : null)),
                const SizedBox(width: 12),
                Expanded(child: TextFormField(controller: _toPin, decoration: const InputDecoration(labelText: "To PIN"), keyboardType: TextInputType.number, maxLength: 6, validator: (val) => val!.length != 6 ? 'Required' : null)),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _distance, decoration: const InputDecoration(labelText: "Distance (km)"), keyboardType: TextInputType.number, validator: (val) => val!.isEmpty ? 'Required' : null),

            _buildSectionHeader("Document details"), // [cite: 95]
            DropdownButtonFormField<String>(
              value: _docType,
              decoration: const InputDecoration(labelText: "Document type"),
              items: ['Invoice', 'Delivery challan', 'Bill of supply'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (val) => setState(() => _docType = val!),
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _docNo, decoration: const InputDecoration(labelText: "Document number"), validator: (val) => val!.isEmpty ? 'Required' : null),
            
            const SizedBox(height: 32),
            ElevatedButton( // "Generate EWB" button [cite: 95-96]
              onPressed: _isLoading ? null : _submitForm, // [cite: 116]
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary, padding: const EdgeInsets.symmetric(vertical: 16)),
              child: _isLoading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text("Generate EWB", style: TextStyle(fontSize: 16)),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 12),
      child: Text(title.toUpperCase(), style: KTTextStyles.label.copyWith(color: KTColors.primaryDark, letterSpacing: 1.2)),
    );
  }

  Widget _buildSuccessScreen() { // [cite: 96]
    return Scaffold(
      backgroundColor: KTColors.cardSurface,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle, color: KTColors.success, size: 80),
              const SizedBox(height: 24),
              Text("E-Way Bill Generated", style: KTTextStyles.h2),
              const SizedBox(height: 16),
              Container( // EWB number (large, bold, copyable)
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(color: KTColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                child: SelectableText(_generatedEwbNumber!, style: KTTextStyles.h1.copyWith(color: KTColors.primaryDark)),
              ),
              const SizedBox(height: 16),
              Text("Valid until: $_ewbValidUntil", style: KTTextStyles.h3.copyWith(color: KTColors.info)), // Valid until (date + time, large)
              const SizedBox(height: 48),
              ElevatedButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _generatedEwbNumber!)); // "Copy EWB number" button
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied to clipboard')));
                },
                icon: const Icon(Icons.copy),
                label: const Text("Copy EWB Number"),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => Share.share('EWB Number: $_generatedEwbNumber\nValid till: $_ewbValidUntil'), // "Share" button (share text with EWB details)
                icon: const Icon(Icons.share),
                label: const Text("Share Details"),
              ),
              const SizedBox(height: 32),
              TextButton( // "Back to home"
                onPressed: () => context.go('/associate/home'),
                child: const Text("Back to home"),
              )
            ],
          ),
        ),
      ),
    );
  }
}