import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

/// Provider to fetch a single vehicle's detail from backend
final _vehicleDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/vehicles/$id');
    if (res is Map<String, dynamic>) {
      final inner = res['data'];
      if (inner is Map<String, dynamic>) return inner;
      return res;
    }
    return <String, dynamic>{};
  },
);

class FleetEditVehicleScreen extends ConsumerStatefulWidget {
  final int vehicleId;
  const FleetEditVehicleScreen({super.key, required this.vehicleId});

  @override
  ConsumerState<FleetEditVehicleScreen> createState() =>
      _FleetEditVehicleScreenState();
}

class _FleetEditVehicleScreenState
    extends ConsumerState<FleetEditVehicleScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;
  bool _loaded = false;

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

  String _vehicleType = 'flatbed_truck';
  String _vehicleSizeClass = 'hcv';
  String _axleWheelType = '10w';
  String _ownershipType = 'owned';
  String _fuelType = 'diesel';
  String _status = 'available';

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
  static const _fuelTypes = ['diesel', 'petrol', 'cng', 'electric'];
  static const _statuses = [
    'available', 'on_trip', 'maintenance', 'breakdown', 'inactive',
  ];

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

  void _populateFields(Map<String, dynamic> v) {
    if (_loaded) return;
    _loaded = true;
    _regCtrl.text = v['registration_number']?.toString() ?? '';
    _makeCtrl.text = v['make']?.toString() ?? '';
    _modelCtrl.text = v['model']?.toString() ?? '';
    _yearCtrl.text = v['year_of_manufacture']?.toString() ?? '';
    _chassisCtrl.text = v['chassis_number']?.toString() ?? '';
    _engineCtrl.text = v['engine_number']?.toString() ?? '';
    _capacityCtrl.text = v['capacity_tons']?.toString() ?? '';
    // odometer_reading can come back as a String ("18500.00") — strip decimal
    final odomRaw = v['odometer_reading']?.toString() ?? '';
    final odomNum = num.tryParse(odomRaw);
    _odometerCtrl.text = odomNum != null ? odomNum.toInt().toString() : odomRaw;
    _tankCapCtrl.text = v['fuel_tank_capacity']?.toString() ?? '';
    _mileageCtrl.text = v['mileage_per_litre']?.toString() ?? '';

    // API returns values in uppercase; normalise to lowercase for matching
    final vType = (v['vehicle_type'] ?? '').toString().toLowerCase();
    final oType = (v['ownership_type'] ?? '').toString().toLowerCase();
    final fType = (v['fuel_type'] ?? '').toString().toLowerCase();
    final sType = (v['status'] ?? '').toString().toLowerCase();

    _vehicleType = _vehicleTypeLabels.containsKey(vType) ? vType : 'flatbed_truck';
    _vehicleSizeClass = _vehicleSizeClassLabels.containsKey((v['vehicle_size_class'] ?? '').toString().toLowerCase())
        ? (v['vehicle_size_class'] ?? '').toString().toLowerCase()
        : 'hcv';
    _axleWheelType = _axleWheelTypeLabels.containsKey((v['axle_wheel_type'] ?? '').toString().toLowerCase())
        ? (v['axle_wheel_type'] ?? '').toString().toLowerCase()
        : '10w';
    _ownershipType = _ownershipTypes.contains(oType) ? oType : 'owned';
    _fuelType = _fuelTypes.contains(fType) ? fType : 'diesel';
    _status = _statuses.contains(sType) ? sType : 'available';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.put('/vehicles/${widget.vehicleId}', data: {
        'registration_number': _regCtrl.text.trim(),
        'make': _makeCtrl.text.trim(),
        'model': _modelCtrl.text.trim(),
        'year_of_manufacture':
            int.tryParse(_yearCtrl.text.trim()) ?? DateTime.now().year,
        'vehicle_type': _vehicleType,
        'ownership_type': _ownershipType,
        'fuel_type': _fuelType,
        'status': _status,
        'chassis_number': _chassisCtrl.text.trim().isNotEmpty
            ? _chassisCtrl.text.trim()
            : null,
        'engine_number': _engineCtrl.text.trim().isNotEmpty
            ? _engineCtrl.text.trim()
            : null,
        'capacity_tons': double.tryParse(_capacityCtrl.text.trim()),
        'odometer_reading': int.tryParse(_odometerCtrl.text.trim()) ?? 0,
        'fuel_tank_capacity': double.tryParse(_tankCapCtrl.text.trim()),
        'mileage_per_litre': double.tryParse(_mileageCtrl.text.trim()),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vehicle updated successfully')),
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
    final vehicleAsync = ref.watch(_vehicleDetailProvider(widget.vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('Edit Vehicle',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: vehicleAsync.when(
        loading: () => const Center(
            child: KTLoadingShimmer(type: ShimmerType.card)),
        error: (e, _) => Center(
          child: Text('Error loading vehicle: $e',
              style: KTTextStyles.body
                  .copyWith(color: KTColors.textMuted)),
        ),
        data: (vehicle) {
          _populateFields(vehicle);
          return Form(
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
                _dropDown('Status', _status, _statuses,
                    (v) => setState(() => _status = v!)),
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
                        : Text('Save Changes',
                            style: KTTextStyles.body.copyWith(
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
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

  Widget _dropDown(String label, String current, List<String> options,
      ValueChanged<String?> onChanged) {
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
