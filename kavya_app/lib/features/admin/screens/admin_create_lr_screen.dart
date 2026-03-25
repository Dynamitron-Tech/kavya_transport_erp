import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

class AdminCreateLRScreen extends ConsumerStatefulWidget {
  const AdminCreateLRScreen({super.key});

  @override
  ConsumerState<AdminCreateLRScreen> createState() => _AdminCreateLRScreenState();
}

class _AdminCreateLRScreenState extends ConsumerState<AdminCreateLRScreen> {
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

  List<dynamic> _jobs = [];
  dynamic _selectedJob;
  bool _loadingJobs = true;
  bool _isSubmitting = false;
  bool _autoGenerateEwb = true;

  static final _gstinRegex = RegExp(
    r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$',
  );

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

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

  Future<void> _loadJobs() async {
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get('/jobs', queryParameters: {'status': 'approved', 'limit': 100});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _jobs = list as List; _loadingJobs = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingJobs = false);
    }
  }

  String? _validateGstin(String? v) {
    if (v == null || v.isEmpty) return 'Required';
    if (!_gstinRegex.hasMatch(v.trim().toUpperCase())) return 'Invalid GSTIN format';
    return null;
  }

  Future<void> _submit() async {
    if (_selectedJob == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a job'), backgroundColor: KTColors.danger),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    try {
      final api = ref.read(apiServiceProvider);
      final lrData = {
        'job_id': _selectedJob['id'],
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

      final lrResponse = await api.post('/lr', data: lrData);
      final lrId = lrResponse['data']?['id'] ?? lrResponse['id'];
      final lrNumber = lrResponse['data']?['lr_number'] ?? lrResponse['lr_number'] ?? '';

      if (_autoGenerateEwb && lrId != null) {
        await api.post('/eway-bills', data: {'lr_id': lrId});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_autoGenerateEwb
                ? 'LR${lrNumber.isNotEmpty ? ' $lrNumber' : ''} created + EWB generated'
                : 'LR${lrNumber.isNotEmpty ? ' $lrNumber' : ''} created'),
            backgroundColor: KTColors.success,
          ),
        );
        context.pop();
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
        elevation: 0,
        leading: const BackButton(color: KTColors.textHeading),
        title: Text('Create LR', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: KTColors.borderColor),
        ),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Info banner ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: KTColors.info.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.info.withOpacity(0.4)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: KTColors.info, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'If freight > ₹50,000 or distance > 50 km, EWB is mandatory.',
                        style: TextStyle(color: KTColors.info, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Job selector ─────────────────────────────────────────
              _SectionHeader('Select Job'),
              _loadingJobs
                  ? const Center(child: CircularProgressIndicator())
                  : DropdownButtonFormField<dynamic>(
                      value: _selectedJob,
                      decoration: _inputDecoration('Job *'),
                      items: _jobs.map((j) {
                        final jobNumber = j['job_number'] ?? j['id'].toString();
                        final origin = j['origin'] ?? '';
                        final dest = j['destination'] ?? '';
                        return DropdownMenuItem(
                          value: j,
                          child: Text('$jobNumber${origin.isNotEmpty ? ' · $origin → $dest' : ''}',
                              overflow: TextOverflow.ellipsis),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedJob = val;
                          if (val != null) {
                            _fromCityCtrl.text = val['origin'] ?? '';
                            _toCityCtrl.text = val['destination'] ?? '';
                          }
                        });
                      },
                      hint: const Text('Select approved job'),
                    ),
              const SizedBox(height: 20),

              // ── Consignor ────────────────────────────────────────────
              _SectionHeader('Consignor Details'),
              _buildField('Consignor Name *', _consignorNameCtrl, 'Sender company name'),
              const SizedBox(height: 12),
              _buildGstinField('Consignor GSTIN *', _consignorGstinCtrl),
              const SizedBox(height: 20),

              // ── Consignee ────────────────────────────────────────────
              _SectionHeader('Consignee Details'),
              _buildField('Consignee Name *', _consigneeNameCtrl, 'Receiver company name'),
              const SizedBox(height: 12),
              _buildGstinField('Consignee GSTIN *', _consigneeGstinCtrl),
              const SizedBox(height: 20),

              // ── Route ────────────────────────────────────────────────
              _SectionHeader('Route'),
              Row(children: [
                Expanded(child: _buildField('From City *', _fromCityCtrl, 'Origin')),
                const SizedBox(width: 12),
                Expanded(child: _buildField('To City *', _toCityCtrl, 'Destination')),
              ]),
              const SizedBox(height: 20),

              // ── Cargo ────────────────────────────────────────────────
              _SectionHeader('Cargo'),
              _buildField('Commodity *', _commodityCtrl, 'Description of goods'),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _buildNumField('Weight (kg) *', _weightCtrl)),
                const SizedBox(width: 12),
                Expanded(child: _buildNumField('Freight (₹) *', _freightCtrl)),
              ]),
              const SizedBox(height: 12),
              _buildField('Remarks (optional)', _remarksCtrl, 'Any special instructions', required: false),
              const SizedBox(height: 20),

              // ── EWB toggle ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Also generate EWB',
                      style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                  subtitle: Text('Auto-creates an e-Way Bill for this LR',
                      style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                  value: _autoGenerateEwb,
                  activeColor: KTColors.primary,
                  onChanged: (v) => setState(() => _autoGenerateEwb = v),
                ),
              ),
              const SizedBox(height: 28),

              // ── Submit button ────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Create LR', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) => InputDecoration(
        labelText: label,
        filled: true,
        fillColor: KTColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.primary, width: 1.5)),
      );

  Widget _buildField(String label, TextEditingController ctrl, String hint,
      {bool required = true}) {
    return TextFormField(
      controller: ctrl,
      decoration: _inputDecoration(label),
      validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
    );
  }

  Widget _buildGstinField(String label, TextEditingController ctrl) {
    return TextFormField(
      controller: ctrl,
      decoration: _inputDecoration(label),
      textCapitalization: TextCapitalization.characters,
      validator: _validateGstin,
    );
  }

  Widget _buildNumField(String label, TextEditingController ctrl) {
    return TextFormField(
      controller: ctrl,
      decoration: _inputDecoration(label),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(text,
          style: KTTextStyles.label.copyWith(
              color: KTColors.textMuted, letterSpacing: 0.5)),
    );
  }
}
