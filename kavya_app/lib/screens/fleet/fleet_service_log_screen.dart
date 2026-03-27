import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetServiceLogScreen extends ConsumerStatefulWidget {
  const FleetServiceLogScreen({super.key});

  @override
  ConsumerState<FleetServiceLogScreen> createState() => _FleetServiceLogScreenState();
}

class _FleetServiceLogScreenState extends ConsumerState<FleetServiceLogScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serviceTypeCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _costCtrl = TextEditingController();
  final _odometerCtrl = TextEditingController();

  String? _selectedVehicleId;
  DateTime _serviceDate = DateTime.now();
  bool _submitting = false;

  // Vehicles list loaded from GET /fleet/vehicles
  final _vehiclesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
    final api = ref.read(apiServiceProvider);
    final response = await api.get('/fleet/vehicles');
    if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
    if (response is List) return response;
    return [];
  });

  @override
  void dispose() {
    _serviceTypeCtrl.dispose();
    _descriptionCtrl.dispose();
    _costCtrl.dispose();
    _odometerCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _serviceDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _serviceDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedVehicleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a vehicle'), backgroundColor: KTColors.danger),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/service/logs', data: {
        'vehicle_id': int.parse(_selectedVehicleId!),
        'service_type': _serviceTypeCtrl.text.trim(),
        'description': _descriptionCtrl.text.trim(),
        'cost_paise': (double.tryParse(_costCtrl.text) ?? 0).toInt(),
        'service_date': _serviceDate.toIso8601String().split('T').first,
        'odometer_km': int.tryParse(_odometerCtrl.text) ?? 0,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Service log saved'), backgroundColor: KTColors.success),
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
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(_vehiclesProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: KTColors.textHeading),
          onPressed: () => context.pop(),
        ),
        title: Text('New Service Log', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Vehicle dropdown
            Text('VEHICLE', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            vehiclesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Failed to load vehicles: $e',
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.danger)),
              data: (vehicles) => DropdownButtonFormField<String>(
                initialValue: _selectedVehicleId,
                dropdownColor: KTColors.surface,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                decoration: _inputDecoration('Select vehicle'),
                items: vehicles.map<DropdownMenuItem<String>>((v) {
                  final vMap = v as Map<String, dynamic>;
                  return DropdownMenuItem(
                    value: '${vMap['id']}',
                    child: Text(vMap['registration_number']?.toString() ?? '${vMap['id']}'),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedVehicleId = val),
              ),
            ),
            const SizedBox(height: 14),

            Text('SERVICE TYPE', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _serviceTypeCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              decoration: _inputDecoration('e.g. Oil Change, Brake Pad'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 14),

            Text('DESCRIPTION', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descriptionCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              decoration: _inputDecoration('Describe the service performed'),
              maxLines: 3,
            ),
            const SizedBox(height: 14),

            Text('COST (PAISE)', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _costCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              decoration: _inputDecoration('Enter cost in paise (₹1 = 100 paise)'),
              keyboardType: TextInputType.number,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 14),

            Text('SERVICE DATE', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, color: KTColors.textMuted, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      _serviceDate.toIso8601String().split('T').first,
                      style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),

            Text('ODOMETER (KM)', style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _odometerCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              decoration: _inputDecoration('Current odometer reading in km'),
              keyboardType: TextInputType.number,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 24),

            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.fleetAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save Service Log',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: KTColors.textMuted),
        filled: true,
        fillColor: KTColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.fleetAccent),
        ),
      );
}
