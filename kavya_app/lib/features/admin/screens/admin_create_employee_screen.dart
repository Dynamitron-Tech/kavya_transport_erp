import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/admin_providers.dart';

class AdminCreateEmployeeScreen extends ConsumerStatefulWidget {
  const AdminCreateEmployeeScreen({super.key});

  @override
  ConsumerState<AdminCreateEmployeeScreen> createState() =>
      _AdminCreateEmployeeScreenState();
}

class _AdminCreateEmployeeScreenState
    extends ConsumerState<AdminCreateEmployeeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _aadhaarCtrl = TextEditingController();

  String? _selectedRole;
  int? _selectedBranchId;
  DateTime? _licenseExpiry;
  bool _loading = false;
  bool _confirmTouched = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _licenseCtrl.dispose();
    _aadhaarCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final parts = _nameCtrl.text.trim().split(' ');
      final firstName = parts.first;
      final lastName = parts.length > 1 ? parts.sublist(1).join(' ') : '';

      await api.post('/users', data: {
        'first_name': firstName,
        'last_name': lastName,
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'role': _selectedRole,
        'branch_id': _selectedBranchId,
        'password': _passwordCtrl.text,
        if (_selectedRole == 'DRIVER') ...{
          'license_number': _licenseCtrl.text.trim(),
          'aadhaar_number': _aadhaarCtrl.text.replaceAll(' ', '').trim(),
          if (_licenseExpiry != null)
            'license_expiry': _licenseExpiry!.toIso8601String().split('T')[0],
        },
      });

      ref.invalidate(adminEmployeesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  'Employee created. Temporary password sent to ${_emailCtrl.text}')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final branches = ref.watch(adminBranchesProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: KTColors.borderColor)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Text('Create employee',
                        style: TextStyle(color: KTColors.textHeading, fontSize: 17, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field('Full name', _nameCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            _field('Email', _emailCtrl,
                keyboard: TextInputType.emailAddress,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  if (!v.contains('@')) return 'Invalid email';
                  return null;
                }),
            _field('Phone', _phoneCtrl,
                keyboard: TextInputType.phone,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  if (v.trim().length < 10) return 'Min 10 digits';
                  return null;
                }),

            // Role
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _selectedRole,
              decoration: _inputDecor('Role'),
              dropdownColor: KTColors.surface,
              style: const TextStyle(color: KTColors.textHeading),
              items: const [
                DropdownMenuItem(value: 'MANAGER', child: Text('Manager')),
                DropdownMenuItem(
                    value: 'PROJECT_ASSOCIATE',
                    child: Text('Project Associate')),
                DropdownMenuItem(
                    value: 'FLEET_MANAGER', child: Text('Fleet Manager')),
                DropdownMenuItem(
                    value: 'ACCOUNTANT', child: Text('Accountant')),
                DropdownMenuItem(value: 'DRIVER', child: Text('Driver')),
              ],
              onChanged: (v) => setState(() => _selectedRole = v),
              validator: (v) => v == null ? 'Required' : null,
            ),

            // Branch
            const SizedBox(height: 12),
            branches.when(
              data: (list) {
                if (list.isEmpty) {
                  return InputDecorator(
                    decoration: _inputDecor('Branch').copyWith(
                      errorText: 'No branches found. Add branches in Settings first.',
                    ),
                    child: const Text('—', style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
                  );
                }
                return DropdownButtonFormField<int>(
                  initialValue: _selectedBranchId,
                  decoration: _inputDecor('Branch'),
                  dropdownColor: KTColors.surface,
                  style: const TextStyle(color: KTColors.textHeading),
                  hint: const Text('Select branch', style: TextStyle(color: KTColors.textMuted)),
                  items: list.map<DropdownMenuItem<int>>((b) {
                    final m = b as Map<String, dynamic>;
                    final id = m['id'] is int
                        ? m['id'] as int
                        : int.tryParse(m['id']?.toString() ?? '') ?? 0;
                    return DropdownMenuItem(
                      value: id,
                      child: Text(m['name'] as String? ?? '—'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedBranchId = v),
                  validator: (v) => v == null ? 'Required' : null,
                );
              },
              loading: () => InputDecorator(
                decoration: _inputDecor('Branch'),
                child: const Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: KTColors.primary),
                    ),
                    SizedBox(width: 10),
                    Text('Loading branches...',
                        style: TextStyle(
                            color: KTColors.textMuted, fontSize: 14)),
                  ],
                ),
              ),
              error: (e, _) => InputDecorator(
                decoration: _inputDecor('Branch').copyWith(
                  errorText: 'Failed to load branches — tap to retry',
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.refresh, color: KTColors.primary, size: 20),
                    onPressed: () => ref.invalidate(adminBranchesProvider),
                  ),
                ),
                child: const Text('—', style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
              ),
            ),

            // Password
            _field('Password', _passwordCtrl,
                obscure: true,
                onChanged: (_) {
                  if (_confirmTouched) setState(() {});
                },
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (v.length < 8) return 'Passwords must be atleast 8 characters';
                  return null;
                }),

            // Confirm password with real-time match feedback
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _field(
                  'Confirm password',
                  _confirmCtrl,
                  obscure: true,
                  suffixIcon: _confirmTouched && _confirmCtrl.text.isNotEmpty
                      ? Icon(
                          _confirmCtrl.text == _passwordCtrl.text
                              ? Icons.check_circle_rounded
                              : Icons.cancel_rounded,
                          color: _confirmCtrl.text == _passwordCtrl.text
                              ? KTColors.success
                              : KTColors.danger,
                          size: 20,
                        )
                      : null,
                  onChanged: (_) => setState(() => _confirmTouched = true),
                  validator: (v) => v != _passwordCtrl.text
                      ? 'Passwords don\'t match'
                      : null,
                ),
                if (_confirmTouched && _confirmCtrl.text.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, top: 5),
                    child: Text(
                      _confirmCtrl.text == _passwordCtrl.text
                          ? 'Passwords match ✓'
                          : 'Passwords don\'t match',
                      style: TextStyle(
                        color: _confirmCtrl.text == _passwordCtrl.text
                            ? KTColors.success
                            : KTColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),

            // Driver-specific fields
            if (_selectedRole == 'DRIVER') ...[
              const SizedBox(height: 8),
              const Divider(color: KTColors.borderColor),
              const SizedBox(height: 4),
              const Text('Driver details',
                  style: TextStyle(
                      color: KTColors.textMuted, fontSize: 12)),
              _field('License number', _licenseCtrl,
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate:
                        DateTime.now().add(const Duration(days: 365)),
                    firstDate: DateTime.now(),
                    lastDate:
                        DateTime.now().add(const Duration(days: 365 * 10)),
                  );
                  if (picked != null) {
                    setState(() => _licenseExpiry = picked);
                  }
                },
                child: AbsorbPointer(
                  child: TextFormField(
                    style:
                        const TextStyle(color: KTColors.textHeading),
                    decoration: _inputDecor('License expiry').copyWith(
                      suffixIcon: const Icon(Icons.calendar_today,
                          color: KTColors.textMuted, size: 18),
                    ),
                    controller: TextEditingController(
                      text: _licenseExpiry != null
                          ? '${_licenseExpiry!.day}/${_licenseExpiry!.month}/${_licenseExpiry!.year}'
                          : '',
                    ),
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Required' : null,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: TextFormField(
                  controller: _aadhaarCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: KTColors.textHeading),
                  decoration: _inputDecor('Aadhaar number'),
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    _AadhaarFormatter(),
                  ],
                  validator: (v) {
                    final digits = (v ?? '').replaceAll(' ', '');
                    if (digits.isEmpty) return 'Aadhaar number is required';
                    if (digits.length != 12) return 'Enter a valid 12-digit Aadhaar number';
                    return null;
                  },
                ),
              ),
            ],

            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Create employee',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType? keyboard,
      bool obscure = false,
      String? Function(String?)? validator,
      void Function(String)? onChanged,
      Widget? suffixIcon}) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        obscureText: obscure,
        onChanged: onChanged,
        style: const TextStyle(color: KTColors.textHeading),
        decoration: suffixIcon != null
            ? _inputDecor(label).copyWith(suffixIcon: suffixIcon)
            : _inputDecor(label),
        validator: validator,
      ),
    );
  }

  InputDecoration _inputDecor(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: KTColors.textMuted),
        filled: true,
        fillColor: KTColors.lightBg,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none),
      );
}

/// Formats raw digits into "XXXX XXXX XXXX" as the user types.
class _AadhaarFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(' ', '');
    // cap at 12 digits
    final capped = digits.length > 12 ? digits.substring(0, 12) : digits;

    final buffer = StringBuffer();
    for (int i = 0; i < capped.length; i++) {
      if (i == 4 || i == 8) buffer.write(' ');
      buffer.write(capped[i]);
    }
    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
