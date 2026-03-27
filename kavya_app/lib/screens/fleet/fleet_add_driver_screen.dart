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
  final _emailCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _salaryCtrl = TextEditingController();

  String _designation = 'driver';
  String _salaryType = 'monthly';
  String _licenseType = 'hmv';

  static const _designations = ['driver', 'senior_driver', 'helper'];
  static const _salaryTypes = ['monthly', 'per_trip', 'per_km'];
  static const _licenseTypes = ['lmv', 'hmv', 'hgmv', 'transport'];

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _licenseCtrl.dispose();
    _salaryCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/drivers', data: {
        'first_name': _firstNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isNotEmpty
            ? _emailCtrl.text.trim()
            : null,
        'designation': _designation,
        'salary_type': _salaryType,
        'base_salary': double.tryParse(_salaryCtrl.text.trim()),
        'license_number': _licenseCtrl.text.trim().isNotEmpty
            ? _licenseCtrl.text.trim()
            : null,
        'license_type': _licenseType,
      });
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
            _field('Email', _emailCtrl,
                keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 16),
            _sectionLabel('Employment'),
            const SizedBox(height: 10),
            _dropDown('Designation', _designation, _designations,
                (v) => setState(() => _designation = v!)),
            _dropDown('Salary Type', _salaryType, _salaryTypes,
                (v) => setState(() => _salaryType = v!)),
            _field('Base Salary (₹)', _salaryCtrl,
                keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            _sectionLabel('License'),
            const SizedBox(height: 10),
            _field('License Number', _licenseCtrl),
            _dropDown('License Type', _licenseType, _licenseTypes,
                (v) => setState(() => _licenseType = v!)),
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
}
