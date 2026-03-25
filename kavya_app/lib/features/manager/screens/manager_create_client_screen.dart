import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/manager_providers.dart';

class ManagerCreateClientScreen extends ConsumerStatefulWidget {
  const ManagerCreateClientScreen({super.key});

  @override
  ConsumerState<ManagerCreateClientScreen> createState() => _ManagerCreateClientScreenState();
}

class _ManagerCreateClientScreenState extends ConsumerState<ManagerCreateClientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _gstinCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _creditLimitCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _gstinCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _creditLimitCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/clients', data: {
        'name': _nameCtrl.text.trim(),
        'gstin': _gstinCtrl.text.trim().isEmpty ? null : _gstinCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
        'credit_limit': double.tryParse(_creditLimitCtrl.text.trim()) ?? 0,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Client created successfully'), backgroundColor: KTColors.success),
        );
        ref.invalidate(managerClientListProvider);
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create client. Please try again.'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.close, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Add Client', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field('Company name *', _nameCtrl, required: true),
            const SizedBox(height: 16),
            _field('GSTIN', _gstinCtrl),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _field('Email', _emailCtrl, inputType: TextInputType.emailAddress)),
              const SizedBox(width: 12),
              Expanded(child: _field('Phone', _phoneCtrl, inputType: TextInputType.phone)),
            ]),
            const SizedBox(height: 16),
            _field('Address', _addressCtrl, maxLines: 2),
            const SizedBox(height: 16),
            _field('Credit limit (₹)', _creditLimitCtrl, inputType: TextInputType.number),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.managerAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Create Client'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String hint, TextEditingController ctrl, {bool required = false, TextInputType? inputType, int maxLines = 1}) {
    return TextFormField(
      controller: ctrl,
      keyboardType: inputType,
      maxLines: maxLines,
      style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
      validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: KTColors.textMuted),
        filled: true,
        fillColor: KTColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}
