import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetAddDriverScreen extends ConsumerStatefulWidget {
  const FleetAddDriverScreen({super.key});

  @override
  ConsumerState<FleetAddDriverScreen> createState() =>
      _FleetAddDriverScreenState();
}

class _FleetAddDriverScreenState
    extends ConsumerState<FleetAddDriverScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();

  String _licenseType = 'hmv';

  static const _licenseTypes = ['lmv', 'hmv', 'hgmv', 'transport'];

  final Map<String, File?> _docFiles = {
    'driving_license': null,
    'pan_card': null,
    'aadhaar_card': null,
    'bank_passbook': null,
    'driver_photo': null,
    'driver_fingerprint': null,
  };

  static const _docMeta = <String, _DocMeta>{
    'driving_license': _DocMeta('License', Icons.credit_card_outlined),
    'pan_card': _DocMeta('PAN Card', Icons.badge_outlined),
    'aadhaar_card': _DocMeta('Aadhaar', Icons.fingerprint),
    'bank_passbook': _DocMeta('Bank Passbook', Icons.account_balance_outlined),
    'driver_photo': _DocMeta('Driver Photo', Icons.person_outline),
    'driver_fingerprint': _DocMeta('Driver Fingerprint', Icons.fingerprint),
  };

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _licenseCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDocument(String type) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (result != null && result.files.single.path != null) {
      setState(() => _docFiles[type] = File(result.files.single.path!));
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      final resp = await api.post('/drivers', data: {
        'first_name': _firstNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'license_number': _licenseCtrl.text.trim().isNotEmpty
            ? _licenseCtrl.text.trim()
            : null,
        'license_type': _licenseType,
      });

      // Upload any selected documents to the new driver's record
      final driverId = resp?['data']?['id'] as int?;
      if (driverId != null) {
        for (final entry in _docFiles.entries) {
          final file = entry.value;
          if (file != null) {
            try {
              await api.uploadDriverDocumentForFleet(driverId, file, entry.key);
            } catch (_) {
              // Document upload is non-critical; driver is already created
            }
          }
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Driver added successfully')),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('Add Driver',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _sectionLabel('Personal'),
            const SizedBox(height: 10),
            _field('First Name *', _firstNameCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            _field('Last Name *', _lastNameCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            _field('Phone *', _phoneCtrl,
                keyboardType: TextInputType.phone,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 16),
            _sectionLabel('License'),
            const SizedBox(height: 10),
            _field('License Number', _licenseCtrl),
            _dropDown('License Type', _licenseType, _licenseTypes,
                (v) => setState(() => _licenseType = v!)),
            const SizedBox(height: 16),
            _sectionLabel('Documents (Optional)'),
            const SizedBox(height: 4),
            Text(
              'Uploaded documents are stored against this driver record.',
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted),
            ),
            const SizedBox(height: 10),
            ..._docMeta.entries.map((e) => _buildDocTile(e.key, e.value)),
            const SizedBox(height: 24),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _saving ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.fleetAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text('Add Driver',
                        style: KTTextStyles.body.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(text,
        style: KTTextStyles.h3.copyWith(
            color: KTColors.fleetAccent, decoration: TextDecoration.none));
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType keyboardType = TextInputType.text,
      String? Function(String?)? validator}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboardType,
        validator: validator,
        style:
            KTTextStyles.body.copyWith(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: KTTextStyles.label
              .copyWith(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.fleetAccent),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.danger),
          ),
        ),
      ),
    );
  }

  Widget _dropDown(String label, String current,
      List<String> options, ValueChanged<String?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: current,
        dropdownColor: KTColors.surface,
        style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          labelStyle:
              KTTextStyles.label.copyWith(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.fleetAccent),
          ),
        ),
        items: options
            .map((o) => DropdownMenuItem(
                value: o,
                child: Text(o.replaceAll('_', ' ').toUpperCase())))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildDocTile(String type, _DocMeta meta) {
    final picked = _docFiles[type];
    final fileName = picked?.path.split('/').last;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: ListTile(
          leading: Icon(meta.icon,
              color: picked != null ? KTColors.fleetAccent : KTColors.textMuted,
              size: 22),
          title: Text(meta.label,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
          subtitle: picked != null
              ? Text(fileName ?? 'File selected',
                  style: KTTextStyles.label
                      .copyWith(color: KTColors.fleetAccent),
                  overflow: TextOverflow.ellipsis)
              : Text('PDF, JPG or PNG',
                  style: KTTextStyles.label
                      .copyWith(color: KTColors.textMuted)),
          trailing: picked != null
              ? IconButton(
                  icon: const Icon(Icons.close, size: 18,
                      color: KTColors.textMuted),
                  onPressed: () => setState(() => _docFiles[type] = null),
                )
              : TextButton(
                  onPressed: () => _pickDocument(type),
                  child: Text('Browse',
                      style: KTTextStyles.label.copyWith(
                          color: KTColors.fleetAccent,
                          fontWeight: FontWeight.w600)),
                ),
          onTap: picked == null ? () => _pickDocument(type) : null,
        ),
      ),
    );
  }
}

class _DocMeta {
  final String label;
  final IconData icon;
  const _DocMeta(this.label, this.icon);
}
