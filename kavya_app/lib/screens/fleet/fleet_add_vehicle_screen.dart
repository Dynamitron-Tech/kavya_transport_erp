import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetAddVehicleScreen extends ConsumerStatefulWidget {
  const FleetAddVehicleScreen({super.key});

  @override
  ConsumerState<FleetAddVehicleScreen> createState() =>
      _FleetAddVehicleScreenState();
}

class _FleetAddVehicleScreenState
    extends ConsumerState<FleetAddVehicleScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  final _regCtrl = TextEditingController();
  final _makeCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  final _chassisCtrl = TextEditingController();
  final _engineCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _odometerCtrl = TextEditingController();
  final _tankCapCtrl = TextEditingController();
  final _mileageCtrl = TextEditingController();

  String _vehicleType = 'truck';
  String _ownershipType = 'owned';
  String _fuelType = 'diesel';

  static const _vehicleTypes = [
    'truck', 'trailer', 'tanker', 'container', 'lcv', 'mini_truck',
  ];
  static const _ownershipTypes = ['owned', 'leased', 'attached', 'market'];
  static const _fuelTypes = ['diesel', 'petrol', 'cng', 'electric'];

  @override
  void dispose() {
    _regCtrl.dispose();
    _makeCtrl.dispose();
    _modelCtrl.dispose();
    _yearCtrl.dispose();
    _chassisCtrl.dispose();
    _engineCtrl.dispose();
    _capacityCtrl.dispose();
    _odometerCtrl.dispose();
    _tankCapCtrl.dispose();
    _mileageCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/vehicles', data: {
        'registration_number': _regCtrl.text.trim(),
        'make': _makeCtrl.text.trim(),
        'model': _modelCtrl.text.trim(),
        'year_of_manufacture':
            int.tryParse(_yearCtrl.text.trim()) ?? DateTime.now().year,
        'vehicle_type': _vehicleType,
        'ownership_type': _ownershipType,
        'fuel_type': _fuelType,
        'chassis_number': _chassisCtrl.text.trim().isNotEmpty
            ? _chassisCtrl.text.trim()
            : null,
        'engine_number': _engineCtrl.text.trim().isNotEmpty
            ? _engineCtrl.text.trim()
            : null,
        'capacity_tons':
            double.tryParse(_capacityCtrl.text.trim()),
        'odometer_reading':
            int.tryParse(_odometerCtrl.text.trim()) ?? 0,
        'fuel_tank_capacity':
            double.tryParse(_tankCapCtrl.text.trim()),
        'mileage_per_litre':
            double.tryParse(_mileageCtrl.text.trim()),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vehicle added successfully')),
        );
        context.pop(true); // signal success
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
        title: Text('Add Vehicle',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _sectionLabel('Basic Information'),
            const SizedBox(height: 10),
            _field('Registration Number *', _regCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            _field('Make', _makeCtrl),
            _field('Model', _modelCtrl),
            _field('Year', _yearCtrl,
                keyboardType: TextInputType.number),
            _dropDown('Vehicle Type', _vehicleType, _vehicleTypes,
                (v) => setState(() => _vehicleType = v!)),
            _dropDown('Ownership', _ownershipType, _ownershipTypes,
                (v) => setState(() => _ownershipType = v!)),
            const SizedBox(height: 16),
            _sectionLabel('Engine & Capacity'),
            const SizedBox(height: 10),
            _field('Chassis Number', _chassisCtrl),
            _field('Engine Number', _engineCtrl),
            _field('Capacity (tons)', _capacityCtrl,
                keyboardType: TextInputType.number),
            _field('Odometer Reading (km)', _odometerCtrl,
                keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            _sectionLabel('Fuel'),
            const SizedBox(height: 10),
            _dropDown('Fuel Type', _fuelType, _fuelTypes,
                (v) => setState(() => _fuelType = v!)),
            _field('Tank Capacity (L)', _tankCapCtrl,
                keyboardType: TextInputType.number),
            _field('Mileage (km/L)', _mileageCtrl,
                keyboardType: TextInputType.number),
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
                    : Text('Add Vehicle',
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
