import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

class AdminCreateTripScreen extends ConsumerStatefulWidget {
  const AdminCreateTripScreen({super.key});

  @override
  ConsumerState<AdminCreateTripScreen> createState() => _AdminCreateTripScreenState();
}

class _AdminCreateTripScreenState extends ConsumerState<AdminCreateTripScreen> {
  final _driverAdvanceCtrl = TextEditingController();
  final _fuelAdvanceCtrl = TextEditingController();

  List<dynamic> _jobs = [];
  List<dynamic> _lrs = [];
  List<dynamic> _vehicles = [];
  List<dynamic> _drivers = [];

  dynamic _selectedJob;
  dynamic _selectedLR;
  dynamic _selectedVehicle;
  dynamic _selectedDriver;

  DateTime? _plannedDeparture;
  DateTime? _plannedArrival;

  bool _loadingJobs = true;
  bool _loadingVehicles = true;
  bool _loadingDrivers = true;
  bool _loadingLRs = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadDropdowns();
  }

  @override
  void dispose() {
    _driverAdvanceCtrl.dispose();
    _fuelAdvanceCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDropdowns() async {
    final api = ref.read(apiServiceProvider);
    await Future.wait([
      _loadJobs(api),
      _loadVehicles(api),
      _loadDrivers(api),
    ]);
  }

  Future<void> _loadJobs(dynamic api) async {
    try {
      final res = await api.get('/jobs', queryParameters: {'status': 'approved', 'limit': 100});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _jobs = list as List; _loadingJobs = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingJobs = false);
    }
  }

  Future<void> _loadVehicles(dynamic api) async {
    try {
      final res = await api.get('/vehicles', queryParameters: {'status': 'available', 'limit': 100});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _vehicles = list as List; _loadingVehicles = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingVehicles = false);
    }
  }

  Future<void> _loadDrivers(dynamic api) async {
    try {
      final res = await api.get('/drivers', queryParameters: {'status': 'available', 'limit': 100});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _drivers = list as List; _loadingDrivers = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingDrivers = false);
    }
  }

  Future<void> _loadLRsForJob(int jobId) async {
    setState(() { _loadingLRs = true; _selectedLR = null; _lrs = []; });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get('/lr', queryParameters: {'job_id': jobId, 'limit': 100});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _lrs = list as List; _loadingLRs = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingLRs = false);
    }
  }

  Future<void> _pickDatetime(bool isDeparture) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null || !mounted) return;
    final dt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() {
      if (isDeparture) _plannedDeparture = dt;
      else _plannedArrival = dt;
    });
  }

  String _fmtDt(DateTime? dt) {
    if (dt == null) return 'Tap to select';
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}  ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    if (_selectedJob == null || _selectedVehicle == null || _selectedDriver == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all required fields'), backgroundColor: KTColors.danger),
      );
      return;
    }
    if (_plannedDeparture == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select planned departure time'), backgroundColor: KTColors.danger),
      );
      return;
    }
    setState(() => _isSubmitting = true);

    try {
      final api = ref.read(apiServiceProvider);
      final body = <String, dynamic>{
        'job_id': _selectedJob['id'],
        'vehicle_id': _selectedVehicle['id'],
        'driver_id': _selectedDriver['id'],
        'planned_departure': _plannedDeparture!.toUtc().toIso8601String(),
        if (_plannedArrival != null)
          'planned_arrival': _plannedArrival!.toUtc().toIso8601String(),
        if (_selectedLR != null) 'lr_id': _selectedLR['id'],
        if (_driverAdvanceCtrl.text.isNotEmpty)
          'driver_advance': double.tryParse(_driverAdvanceCtrl.text) ?? 0,
        if (_fuelAdvanceCtrl.text.isNotEmpty)
          'fuel_advance': double.tryParse(_fuelAdvanceCtrl.text) ?? 0,
      };

      final res = await api.post('/trips', data: body);
      final tripId = res['data']?['id'] ?? res['id'];
      final tripNumber = res['data']?['trip_number'] ?? res['trip_number'] ?? '';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Trip${tripNumber.isNotEmpty ? ' $tripNumber' : ''} created'),
            backgroundColor: KTColors.success,
          ),
        );
        if (tripId != null) {
          context.go('/admin/trips/$tripId');
        } else {
          context.pop();
        }
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
    final loading = _loadingJobs || _loadingVehicles || _loadingDrivers;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        leading: const BackButton(color: KTColors.textHeading),
        title: Text('Create Trip', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: KTColors.borderColor),
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Job ────────────────────────────────────────────
                  _SectionHeader('Job *'),
                  DropdownButtonFormField<dynamic>(
                    value: _selectedJob,
                    decoration: _inputDecoration('Select approved job'),
                    items: _jobs.map((j) {
                      final num = j['job_number'] ?? j['id'].toString();
                      final origin = j['origin'] ?? '';
                      final dest = j['destination'] ?? '';
                      return DropdownMenuItem(
                        value: j,
                        child: Text('$num${origin.isNotEmpty ? ' · $origin → $dest' : ''}',
                            overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setState(() { _selectedJob = val; });
                      if (val != null) _loadLRsForJob(val['id'] as int);
                    },
                  ),
                  const SizedBox(height: 16),

                  // ── LR (optional) ─────────────────────────────────────
                  _SectionHeader('LR (optional)'),
                  if (_loadingLRs)
                    const LinearProgressIndicator()
                  else
                    DropdownButtonFormField<dynamic>(
                      value: _selectedLR,
                      decoration: _inputDecoration('Select LR (auto-loaded by job)'),
                      items: _lrs.map((lr) {
                        final num = lr['lr_number'] ?? lr['id'].toString();
                        return DropdownMenuItem(value: lr, child: Text(num));
                      }).toList(),
                      onChanged: _selectedJob == null ? null : (val) => setState(() => _selectedLR = val),
                    ),
                  const SizedBox(height: 16),

                  // ── Vehicle ────────────────────────────────────────────
                  _SectionHeader('Vehicle *'),
                  DropdownButtonFormField<dynamic>(
                    value: _selectedVehicle,
                    decoration: _inputDecoration('Select available vehicle'),
                    items: _vehicles.map((v) {
                      final reg = v['registration_number'] ?? v['vehicle_number'] ?? v['id'].toString();
                      final type = v['vehicle_type'] ?? '';
                      return DropdownMenuItem(
                        value: v,
                        child: Text('$reg${type.isNotEmpty ? ' · $type' : ''}'),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedVehicle = val),
                  ),
                  const SizedBox(height: 16),

                  // ── Driver ─────────────────────────────────────────────
                  _SectionHeader('Driver *'),
                  DropdownButtonFormField<dynamic>(
                    value: _selectedDriver,
                    decoration: _inputDecoration('Select available driver'),
                    items: _drivers.map((d) {
                      final name = d['name'] ?? d['full_name'] ?? d['id'].toString();
                      final phone = d['phone'] ?? d['mobile'] ?? '';
                      return DropdownMenuItem(
                        value: d,
                        child: Text('$name${phone.isNotEmpty ? ' · $phone' : ''}'),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedDriver = val),
                  ),
                  const SizedBox(height: 20),

                  // ── Dates ──────────────────────────────────────────────
                  _SectionHeader('Schedule'),
                  _DateTile(
                    label: 'Planned Departure *',
                    value: _fmtDt(_plannedDeparture),
                    onTap: () => _pickDatetime(true),
                    hasValue: _plannedDeparture != null,
                  ),
                  const SizedBox(height: 12),
                  _DateTile(
                    label: 'Planned Arrival (optional)',
                    value: _fmtDt(_plannedArrival),
                    onTap: () => _pickDatetime(false),
                    hasValue: _plannedArrival != null,
                  ),
                  const SizedBox(height: 20),

                  // ── Advances ───────────────────────────────────────────
                  _SectionHeader('Advances (optional)'),
                  Row(children: [
                    Expanded(child: _buildNumField('Driver Advance (₹)', _driverAdvanceCtrl)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildNumField('Fuel Advance (₹)', _fuelAdvanceCtrl)),
                  ]),
                  const SizedBox(height: 32),

                  // ── Submit ─────────────────────────────────────────────
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
                          : const Text('Create Trip',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: KTColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.primary, width: 1.5)),
      );

  Widget _buildNumField(String label, TextEditingController ctrl) {
    return TextFormField(
      controller: ctrl,
      decoration: _inputDecoration(label),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: KTTextStyles.label.copyWith(color: KTColors.textMuted, letterSpacing: 0.5)),
    );
  }
}

class _DateTile extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool hasValue;

  const _DateTile({
    required this.label,
    required this.value,
    required this.onTap,
    required this.hasValue,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Icon(Icons.schedule_rounded,
                color: hasValue ? KTColors.primary : KTColors.textMuted, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                  const SizedBox(height: 2),
                  Text(value,
                      style: KTTextStyles.body.copyWith(
                          color: hasValue ? KTColors.textHeading : KTColors.textMuted)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: KTColors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}
