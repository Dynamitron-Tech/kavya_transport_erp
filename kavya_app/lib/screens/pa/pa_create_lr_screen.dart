import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

class PACreateLRScreen extends ConsumerStatefulWidget {
  final int jobId;
  const PACreateLRScreen({super.key, required this.jobId});

  @override
  ConsumerState<PACreateLRScreen> createState() => _PACreateLRScreenState();
}

class _PACreateLRScreenState extends ConsumerState<PACreateLRScreen> {
  final _formKey = GlobalKey<FormState>();
  final _consignorNameCtrl = TextEditingController();
  final _consignorGstinCtrl = TextEditingController();
  final _consigneeNameCtrl = TextEditingController();
  final _consigneeGstinCtrl = TextEditingController();
  final _fromCityCtrl = TextEditingController();
  final _toCityCtrl = TextEditingController();
  final _commodityCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _freightCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();

  bool _isSubmitting = false;
  bool _autoGenerateEwb = true;

  static final _gstinRegex = RegExp(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$');

  @override
  void dispose() {
    for (final c in [
      _consignorNameCtrl, _consignorGstinCtrl, _consigneeNameCtrl,
      _consigneeGstinCtrl, _fromCityCtrl, _toCityCtrl,
      _commodityCtrl, _weightCtrl, _freightCtrl, _remarksCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _validateGstin(String? v) {
    if (v == null || v.isEmpty) return 'Required';
    if (!_gstinRegex.hasMatch(v.trim().toUpperCase())) return 'Invalid GSTIN format';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    try {
      final api = ref.read(apiServiceProvider);
      final lrData = {
        'job_id': widget.jobId,
        'consignor_name': _consignorNameCtrl.text.trim(),
        'consignor_gstin': _consignorGstinCtrl.text.trim().toUpperCase(),
        'consignee_name': _consigneeNameCtrl.text.trim(),
        'consignee_gstin': _consigneeGstinCtrl.text.trim().toUpperCase(),
        'from_city': _fromCityCtrl.text.trim(),
        'to_city': _toCityCtrl.text.trim(),
        'commodity_description': _commodityCtrl.text.trim(),
        'total_weight_kg': double.tryParse(_weightCtrl.text) ?? 0,
        'freight_amount': double.tryParse(_freightCtrl.text) ?? 0,
        'remarks': _remarksCtrl.text.trim(),
      };

      await api.post('/lr', data: lrData);

      if (mounted) {
        if (_autoGenerateEwb) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('LR created — open EWBs to generate the e-way bill'),
              backgroundColor: KTColors.success,
            ),
          );
          context.push('/pa/ewbs');
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('LR created'),
              backgroundColor: KTColors.success,
            ),
          );
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('Create LR', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        leading: const BackButton(color: KTColors.textHeading),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── EWB auto-detect banner ──────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: KTColors.info.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.info.withOpacity(0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: KTColors.info, size: 18),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'If freight > ₹50,000 or distance > 50 km, EWB is mandatory.',
                        style: TextStyle(color: KTColors.info, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Consignor Section ───────────────────────────────────
              _SectionHeader('Consignor Details'),
              _FormField('Consignor Name', _consignorNameCtrl, 'Sender company name'),
              _GstinField('Consignor GSTIN', _consignorGstinCtrl, _validateGstin),
              const SizedBox(height: 16),

              // ── Consignee Section ───────────────────────────────────
              _SectionHeader('Consignee Details'),
              _FormField('Consignee Name', _consigneeNameCtrl, 'Receiver company name'),
              _GstinField('Consignee GSTIN', _consigneeGstinCtrl, _validateGstin),
              const SizedBox(height: 16),

              // ── Route ───────────────────────────────────────────────
              _SectionHeader('Route'),
              Row(children: [
                Expanded(child: _FormField('From City', _fromCityCtrl, 'Origin', maxLines: 1)),
                const SizedBox(width: 12),
                Expanded(child: _FormField('To City', _toCityCtrl, 'Destination', maxLines: 1)),
              ]),
              const SizedBox(height: 16),

              // ── Cargo ───────────────────────────────────────────────
              _SectionHeader('Cargo'),
              _FormField('Commodity', _commodityCtrl, 'Description of goods'),
              Row(children: [
                Expanded(child: _NumField('Weight (kg)', _weightCtrl)),
                const SizedBox(width: 12),
                Expanded(child: _NumField('Freight (₹)', _freightCtrl)),
              ]),
              const SizedBox(height: 8),
              _FormField('Remarks (optional)', _remarksCtrl, 'Any special instructions', required: false),
              const SizedBox(height: 16),

              // ── EWB toggle ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Also generate EWB',
                    style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                  ),
                  subtitle: Text(
                    'Auto-creates an e-Way Bill for this LR',
                    style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
                  ),
                  value: _autoGenerateEwb,
                  activeThumbColor: KTColors.paAccent,
                  onChanged: (v) => setState(() => _autoGenerateEwb = v),
                ),
              ),
              const SizedBox(height: 24),

              // ── Submit ───────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.paAccent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          _autoGenerateEwb ? 'Save LR + Generate EWB' : 'Save LR',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Shared form helpers ──────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(
          title,
          style: KTTextStyles.h3.copyWith(color: KTColors.textHeading),
        ),
      );
}

class _FormField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final bool required;
  final int maxLines;

  const _FormField(this.label, this.controller, this.hint,
      {this.required = true, this.maxLines = 1});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        style: const TextStyle(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 12),
          labelStyle: const TextStyle(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
        ),
        validator: required
            ? (v) => (v == null || v.trim().isEmpty) ? '$label is required' : null
            : null,
      ),
    );
  }
}

class _GstinField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? Function(String?) validator;

  const _GstinField(this.label, this.controller, this.validator);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        textCapitalization: TextCapitalization.characters,
        style: const TextStyle(color: KTColors.textHeading, letterSpacing: 1.2),
        maxLength: 15,
        decoration: InputDecoration(
          labelText: label,
          hintText: '22AAAAA0000A1Z5',
          counterText: '',
          hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 12),
          labelStyle: const TextStyle(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
        ),
        validator: validator,
      ),
    );
  }
}

class _NumField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  const _NumField(this.label, this.controller);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        style: const TextStyle(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
        ),
        validator: (v) {
          if (v == null || v.trim().isEmpty) return '$label is required';
          if (double.tryParse(v.trim()) == null) return 'Enter a valid number';
          return null;
        },
      ),
    );
  }
}
