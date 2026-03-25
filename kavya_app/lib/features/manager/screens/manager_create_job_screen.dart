import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/manager_providers.dart';

String _toTitleCase(String s) =>
    s.split(' ').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase()).join(' ');

double _safeD(dynamic v) {
  if (v == null) return 0.0;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0.0;
}

String _fmtAmount(dynamic v) {
  final val = _safeD(v);
  if (val >= 100000) return '₹${(val / 100000).toStringAsFixed(1)}L';
  if (val >= 1000) return '₹${(val / 1000).toStringAsFixed(0)}K';
  return '₹${val.toStringAsFixed(0)}';
}

class ManagerCreateJobScreen extends ConsumerStatefulWidget {
  const ManagerCreateJobScreen({super.key});

  @override
  ConsumerState<ManagerCreateJobScreen> createState() => _ManagerCreateJobScreenState();
}

class _ManagerCreateJobScreenState extends ConsumerState<ManagerCreateJobScreen> {
  final _formKey = GlobalKey<FormState>();
  final _originCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  final _materialCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _freightCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  String? _selectedClientId;
  Map<String, dynamic>? _selectedClient;
  String _vehicleType = 'open';
  String _paymentTerms = 'to_pay';
  DateTime _pickupDate = DateTime.now().add(const Duration(days: 1));
  bool _submitting = false;

  @override
  void dispose() {
    _originCtrl.dispose();
    _destCtrl.dispose();
    _materialCtrl.dispose();
    _weightCtrl.dispose();
    _freightCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit({bool draft = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final body = {
        'client_id': _selectedClientId,
        'origin_city': _toTitleCase(_originCtrl.text.trim()),
        'destination_city': _toTitleCase(_destCtrl.text.trim()),
        'material_type': _materialCtrl.text.trim(),
        'quantity': double.tryParse(_weightCtrl.text.trim()) ?? 0,
        'total_amount': double.tryParse(_freightCtrl.text.trim()) ?? 0,
        'vehicle_type_required': _vehicleType,
        'pickup_date': _pickupDate.toIso8601String().split('T').first,
        'payment_terms': _paymentTerms,
        'notes': _notesCtrl.text.trim(),
        'status': draft ? 'DRAFT' : 'PENDING_APPROVAL',
      };
      await api.post('/jobs', data: body);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(draft ? 'Job saved as draft' : 'Job created successfully'),
            backgroundColor: KTColors.success,
          ),
        );
        ref.invalidate(managerJobListProvider);
        ref.invalidate(managerUnassignedJobsProvider);
        ref.invalidate(managerDashboardStatsProvider);
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create job. Please try again.'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clientsAsync = ref.watch(managerClientListProvider);

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
                    icon: const Icon(Icons.close_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.pop(),
                  ),
                  Expanded(
                    child: Text('Create Job', style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
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
            // ── Client Dropdown ────────────────────────
            _label('Client'),
            clientsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const Text('Could not load clients', style: TextStyle(color: KTColors.danger)),
              data: (clients) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: KTColors.borderColor)),
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedClientId,
                  dropdownColor: KTColors.surface,
                  decoration: const InputDecoration(border: InputBorder.none),
                  hint: Text('Select client', style: TextStyle(color: KTColors.textMuted)),
                  style: KTTextStyles.body.copyWith(color: KTColors.textBody),
                  validator: (v) => v == null ? 'Required' : null,
                  items: clients.map<DropdownMenuItem<String>>((c) {
                    final m = c as Map<String, dynamic>;
                    return DropdownMenuItem(value: m['id']?.toString(), child: Text(m['name'] ?? ''));
                  }).toList(),
                  onChanged: (v) {
                    setState(() {
                      _selectedClientId = v;
                      _selectedClient = v == null
                          ? null
                          : clients
                              .whereType<Map>()
                              .cast<Map<String, dynamic>>()
                              .firstWhere((c) => c['id']?.toString() == v,
                                  orElse: () => {});
                    });
                  },
                ),
              ),
            ),
            if (_selectedClient != null && _selectedClient!.isNotEmpty) ...[  
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: KTColors.lightBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: KTColors.success.withValues(alpha: 0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('GSTIN: ', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                      Text(
                        (_selectedClient!['gstin'] as String?)?.isNotEmpty == true
                            ? _selectedClient!['gstin'] as String
                            : 'Not set',
                        style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading),
                      ),
                    ]),
                    const SizedBox(height: 2),
                    Row(children: [
                      Text('Credit limit: ', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                      Text(
                        _fmtAmount((_selectedClient!['credit_limit'])),
                        style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading),
                      ),
                      const SizedBox(width: 12),
                      Text('Outstanding: ', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                      Text(
                        _fmtAmount((_selectedClient!['outstanding_amount'])),
                        style: KTTextStyles.bodySmall.copyWith(
                          color: _safeD(_selectedClient!['outstanding_amount']) > 0
                              ? KTColors.danger : KTColors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ]),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // ── Origin / Destination ───────────────────
            Row(
              children: [
                Expanded(child: _textField('Pickup city', _originCtrl, required: true)),
                const SizedBox(width: 12),
                Expanded(child: _textField('Delivery city', _destCtrl, required: true)),
              ],
            ),
            const SizedBox(height: 16),

            // ── Material & Weight ──────────────────────
            Row(
              children: [
                Expanded(child: _textField('Material', _materialCtrl)),
                const SizedBox(width: 12),
                Expanded(child: _textField('Weight (tons)', _weightCtrl, inputType: TextInputType.number)),
              ],
            ),
            const SizedBox(height: 16),

            // ── Vehicle type ───────────────────────────
            _label('Vehicle type'),
            Row(
              children: ['open', 'closed', 'trailer', 'tanker'].map((t) {
                final sel = t == _vehicleType;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(t[0].toUpperCase() + t.substring(1)),
                    selected: sel,
                    selectedColor: KTColors.managerAccent,
                    backgroundColor: KTColors.lightBg,
                    labelStyle: TextStyle(color: sel ? Colors.white : KTColors.textMuted),
                    onSelected: (_) => setState(() => _vehicleType = t),
                    side: BorderSide.none,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // ── Freight ────────────────────────────────
            _textField('Freight amount (₹)', _freightCtrl, inputType: TextInputType.number, required: true),
            const SizedBox(height: 16),

            // ── Pickup date ────────────────────────────
            _label('Pickup date'),
            InkWell(
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _pickupDate,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 180)),
                );
                if (d != null) setState(() => _pickupDate = d);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: KTColors.borderColor)),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, color: KTColors.textMuted, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      '${_pickupDate.day}/${_pickupDate.month}/${_pickupDate.year}',
                      style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Payment Terms ──────────────────────────
            _label('Payment terms'),
            Row(
              children: ['to_pay', 'paid', 'to_be_billed'].map((t) {
                final sel = t == _paymentTerms;
                final label = t.replaceAll('_', ' ');
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(label[0].toUpperCase() + label.substring(1)),
                    selected: sel,
                    selectedColor: KTColors.managerAccent,
                    backgroundColor: KTColors.lightBg,
                    labelStyle: TextStyle(color: sel ? Colors.white : KTColors.textMuted),
                    onSelected: (_) => setState(() => _paymentTerms = t),
                    side: BorderSide.none,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // ── Notes ──────────────────────────────────
            _textField('Notes (optional)', _notesCtrl, maxLines: 3),
            const SizedBox(height: 24),

            // ── Actions ────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : () => _submit(draft: true),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: KTColors.borderColor),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text('Save Draft', style: TextStyle(color: KTColors.textMuted)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: KTColors.managerAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Create Job'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600)),
      );

  Widget _textField(String hint, TextEditingController ctrl, {bool required = false, TextInputType? inputType, int maxLines = 1}) {
    return TextFormField(
      controller: ctrl,
      keyboardType: inputType,
      maxLines: maxLines,
      style: KTTextStyles.body.copyWith(color: KTColors.textBody),
      validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: KTColors.textMuted),
        filled: true,
        fillColor: KTColors.lightBg,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}
