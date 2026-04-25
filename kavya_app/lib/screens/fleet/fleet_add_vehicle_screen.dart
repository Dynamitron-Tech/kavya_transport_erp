import 'dart:io';
import 'package:file_picker/file_picker.dart';
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

  String _vehicleType = 'flatbed_truck';
  String _vehicleSizeClass = 'hcv';
  String _axleWheelType = '10w';
  String _ownershipType = 'owned';
  String _fuelType = 'diesel';

  final Map<String, File?> _docFiles = {
    'rc_book': null,
    'insurance': null,
    'pollution_certificate': null,
    'fitness_certificate': null,
    'permit': null,
  };

  final Map<String, DateTime?> _docExpiry = {
    'rc_book': null,
    'insurance': null,
    'pollution_certificate': null,
    'fitness_certificate': null,
    'permit': null,
  };

  static const _docMeta = <String, _DocMeta>{
    'rc_book': _DocMeta('RC Book', Icons.menu_book_outlined),
    'insurance': _DocMeta('Insurance', Icons.shield_outlined),
    'pollution_certificate': _DocMeta('Pollution Certificate', Icons.eco_outlined),
    'fitness_certificate': _DocMeta('Fitness Certificate', Icons.health_and_safety_outlined),
    'permit': _DocMeta('Permit', Icons.badge_outlined),
  };

  static const Map<String, String> _vehicleTypeLabels = {
    'flatbed_truck': 'Flatbed Truck',
    'container_truck': 'Container Truck',
    'tipper_truck': 'Tipper Truck',
    'tanker_generic': 'Tanker (Generic)',
    'refrigerated_truck': 'Refrigerated Truck',
    'car_carrier': 'Car Carrier',
    'tractor_head': 'Tractor Head',
  };
  static const Map<String, String> _vehicleSizeClassLabels = {
    'mini_pickup': 'Mini / Pickup Truck',
    'lcv': 'LCV (Light Commercial Vehicle)',
    'mcv': 'MCV (Medium Commercial Vehicle)',
    'hcv': 'HCV (Heavy Commercial Vehicle)',
    'trailer_articulated': 'Trailer (Articulated)',
  };
  static const Map<String, String> _axleWheelTypeLabels = {
    '4w': '4W  - 2 Front + 2 Rear (Single Axle)',
    '6w': '6W  - 2 Front + 4 Rear (Single Axle)',
    '10w': '10W - 2 Front + 8 Rear (Dual Axle)',
    '12w': '12W - 4 Front + 8 Rear (Double Steering)',
    '14w': '14W - 6 Front + 8 Rear (Lift Axle)',
    'tr_6w': 'TR-6W  - Tractor Head (Single Axle)',
    'tr_10w': 'TR-10W - Tractor Head (Dual Axle)',
  };
  static const _ownershipTypes = ['owned', 'leased', 'attached', 'market'];
  static const _fuelTypes = ['diesel', 'petrol', 'cng', 'electric', 'lpg'];

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
      final resp = await api.post('/vehicles', data: {
        'registration_number': _regCtrl.text.trim(),
        'make': _makeCtrl.text.trim(),
        'model': _modelCtrl.text.trim(),
        'year_of_manufacture':
            int.tryParse(_yearCtrl.text.trim()) ?? DateTime.now().year,
        'vehicle_type': _vehicleType,
        'vehicle_size_class': _vehicleSizeClass,
        'axle_wheel_type': _axleWheelType,
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
      });

      // Upload any selected documents to the new vehicle
      final vehicleId = resp?['data']?['id'] as int?;
      if (vehicleId != null) {
        for (final entry in _docFiles.entries) {
          final file = entry.value;
          if (file != null) {
            try {
              final expiry = _docExpiry[entry.key];
              await api.uploadVehicleDocument(
                vehicleId, file, entry.key,
                expiryDate: expiry?.toIso8601String().split('T').first,
              );
            } catch (_) {
              // Document upload is non-critical; vehicle is already created
            }
          }
        }
      }

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
            _dropDownWithLabels('Vehicle Size/Class', _vehicleSizeClass, _vehicleSizeClassLabels,
                (v) => setState(() => _vehicleSizeClass = v!)),
            _dropDownWithLabels('Vehicle Type', _vehicleType, _vehicleTypeLabels,
                (v) => setState(() => _vehicleType = v!)),
            _dropDownWithLabels('Axle/Wheel Type', _axleWheelType, _axleWheelTypeLabels,
                (v) => setState(() => _axleWheelType = v!)),
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
            const SizedBox(height: 16),
            _sectionLabel('Documents (Optional)'),
            const SizedBox(height: 4),
            Text(
              'Uploaded documents will be visible in the driver app when this vehicle is allocated.',
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

  Future<void> _pickExpiryDate(String type) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _docExpiry[type] ?? DateTime.now().add(const Duration(days: 365)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 10)),
    );
    if (picked != null) setState(() => _docExpiry[type] = picked);
  }

  Widget _buildDocTile(String type, _DocMeta meta) {
    final picked = _docFiles[type];
    final fileName = picked?.path.split('/').last;
    final expiry = _docExpiry[type];
    final expiryText = expiry != null
        ? '${expiry.day.toString().padLeft(2, '0')}/${expiry.month.toString().padLeft(2, '0')}/${expiry.year}'
        : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          children: [
            ListTile(
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
                      onPressed: () => setState(() {
                        _docFiles[type] = null;
                        _docExpiry[type] = null;
                      }),
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
            if (picked != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: GestureDetector(
                  onTap: () => _pickExpiryDate(type),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: KTColors.lightBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: KTColors.borderColor),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_today, size: 16, color: KTColors.fleetAccent),
                        const SizedBox(width: 8),
                        Text(
                          expiryText != null ? 'Expires: $expiryText' : 'Set Expiry Date',
                          style: KTTextStyles.label.copyWith(
                            color: expiryText != null ? KTColors.textHeading : KTColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _dropDownWithLabels(String label, String current,
      Map<String, String> options, ValueChanged<String?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: current,
        dropdownColor: KTColors.surface,
        style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
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
        items: options.entries
            .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
            .toList(),
        onChanged: onChanged,
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

class _DocMeta {
  final String label;
  final IconData icon;
  const _DocMeta(this.label, this.icon);
}
