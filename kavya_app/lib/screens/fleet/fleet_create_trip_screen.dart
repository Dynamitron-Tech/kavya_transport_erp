import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetCreateTripScreen extends ConsumerStatefulWidget {
  const FleetCreateTripScreen({super.key});

  @override
  ConsumerState<FleetCreateTripScreen> createState() =>
      _FleetCreateTripScreenState();
}

class _FleetCreateTripScreenState
    extends ConsumerState<FleetCreateTripScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;
  bool _loading = true;

  final _originCtrl = TextEditingController();
  final _destinationCtrl = TextEditingController();

  String _tripNumber = '';
  DateTime _tripDate = DateTime.now();

  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _drivers = [];
  int? _selectedVehicleId;
  int? _selectedDriverId;

  @override
  void initState() {
    super.initState();
    _loadLookups();
  }

  Future<void> _loadLookups() async {
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.get('/trips/next-trip-number'),
        api.get('/vehicles', queryParameters: {'status': 'available', 'limit': 100}),
        api.get('/drivers', queryParameters: {'status': 'available', 'limit': 100}),
      ]);
      final nextNum = (results[0] is Map)
          ? ((results[0]['data']?['trip_number'] ?? results[0]['trip_number']) as String? ?? '')
          : '';
      final vPayload = (results[1] is Map && results[1]['data'] != null) ? results[1]['data'] : results[1];
      final dPayload = (results[2] is Map && results[2]['data'] != null) ? results[2]['data'] : results[2];
      if (mounted) {
        setState(() {
          _tripNumber = nextNum;
          _vehicles = (vPayload is List) ? List<Map<String, dynamic>>.from(vPayload) : [];
          _drivers = (dPayload is List) ? List<Map<String, dynamic>>.from(dPayload) : [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not load form data: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _originCtrl.dispose();
    _destinationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _tripDate,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (picked != null) setState(() => _tripDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedVehicleId == null || _selectedDriverId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a vehicle and driver')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/trips', data: {
        'vehicle_id': _selectedVehicleId,
        'driver_id': _selectedDriverId,
        'origin': _originCtrl.text.trim(),
        'destination': _destinationCtrl.text.trim(),
        'trip_date': _tripDate.toIso8601String().split('T').first,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Trip created successfully')),
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
        title: Text('Create Trip',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _sectionLabel('Trip Number'),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.borderColor),
              ),
              child: Row(
                children: [
                  const Icon(Icons.tag, size: 18, color: KTColors.fleetAccent),
                  const SizedBox(width: 10),
                  Text(
                    _tripNumber.isNotEmpty ? _tripNumber : 'Generating...',
                    style: KTTextStyles.body.copyWith(
                      color: _tripNumber.isNotEmpty ? KTColors.textHeading : KTColors.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _sectionLabel('Route'),
            const SizedBox(height: 10),
            _field('Origin *', _originCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            _field('Destination *', _destinationCtrl,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 16),
            _sectionLabel('Schedule'),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border:
                      Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  mainAxisAlignment:
                      MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${_tripDate.year}-${_tripDate.month.toString().padLeft(2, '0')}-${_tripDate.day.toString().padLeft(2, '0')}',
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading),
                    ),
                    const Icon(Icons.calendar_today,
                        size: 18,
                        color: KTColors.fleetAccent),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _sectionLabel('Assignment'),
            const SizedBox(height: 10),
            // Vehicle picker
            DropdownButtonFormField<int>(
              initialValue: _selectedVehicleId,
              dropdownColor: KTColors.surface,
              style: KTTextStyles.body
                  .copyWith(color: KTColors.textHeading),
              hint: Text('Select Vehicle',
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.textMuted)),
              decoration: _dropDecor('Vehicle *'),
              items: _vehicles.map((v) {
                final reg = v['registration_number'] ??
                    v['reg_number'] ??
                    '#${v['id']}';
                final make = v['make'] ?? '';
                return DropdownMenuItem<int>(
                  value: v['id'] as int?,
                  child: Text('$reg${make.isNotEmpty ? ' ($make)' : ''}'),
                );
              }).toList(),
              onChanged: (v) =>
                  setState(() => _selectedVehicleId = v),
              validator: (v) =>
                  v == null ? 'Select a vehicle' : null,
            ),
            const SizedBox(height: 12),
            // Driver picker
            DropdownButtonFormField<int>(
              initialValue: _selectedDriverId,
              dropdownColor: KTColors.surface,
              style: KTTextStyles.body
                  .copyWith(color: KTColors.textHeading),
              hint: Text('Select Driver',
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.textMuted)),
              decoration: _dropDecor('Driver *'),
              items: _drivers.map((d) {
                final name =
                    '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'
                        .trim();
                return DropdownMenuItem<int>(
                  value: d['id'] as int?,
                  child: Text(
                      name.isNotEmpty ? name : 'Driver #${d['id']}'),
                );
              }).toList(),
              onChanged: (v) =>
                  setState(() => _selectedDriverId = v),
              validator: (v) =>
                  v == null ? 'Select a driver' : null,
            ),
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
                            strokeWidth: 2,
                            color: KTColors.surface))
                    : Text('Create Trip',
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
            color: KTColors.fleetAccent,
            decoration: TextDecoration.none));
  }

  InputDecoration _dropDecor(String label) {
    return InputDecoration(
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
    );
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
        style: KTTextStyles.body
            .copyWith(color: KTColors.textHeading),
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
}
