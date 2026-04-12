import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Data models ──────────────────────────────────────────────────────────────

class _VehicleAssignment {
  final int vehicleId;
  final String registration;
  final String vehicleType;
  final String status;
  final int? defaultDriverId;
  final String? driverName;
  final String? driverPhone;
  final String? licenseNumber;

  const _VehicleAssignment({
    required this.vehicleId,
    required this.registration,
    required this.vehicleType,
    required this.status,
    this.defaultDriverId,
    this.driverName,
    this.driverPhone,
    this.licenseNumber,
  });

  factory _VehicleAssignment.fromJson(Map<String, dynamic> j) {
    final d = j['driver'] as Map<String, dynamic>?;
    return _VehicleAssignment(
      vehicleId: (j['vehicle_id'] as num).toInt(),
      registration: (j['registration_number'] ?? '').toString(),
      vehicleType: (j['vehicle_type'] ?? '').toString(),
      status: (j['status'] ?? '').toString(),
      defaultDriverId: j['default_driver_id'] != null
          ? (j['default_driver_id'] as num).toInt()
          : null,
      driverName: d?['name']?.toString(),
      driverPhone: d?['phone']?.toString(),
      licenseNumber: d?['license_number']?.toString(),
    );
  }

  _VehicleAssignment copyWith({int? defaultDriverId, String? driverName, String? driverPhone, String? licenseNumber}) =>
      _VehicleAssignment(
        vehicleId: vehicleId,
        registration: registration,
        vehicleType: vehicleType,
        status: status,
        defaultDriverId: defaultDriverId,
        driverName: driverName,
        driverPhone: driverPhone,
        licenseNumber: licenseNumber,
      );
}

class _DriverOption {
  final int id;
  final String name;
  final String? phone;
  final String? status;

  const _DriverOption({required this.id, required this.name, this.phone, this.status});

  factory _DriverOption.fromJson(Map<String, dynamic> j) => _DriverOption(
        id: (j['id'] as num).toInt(),
        name: ('${j['first_name'] ?? j['name'] ?? ''} ${j['last_name'] ?? ''}'.trim()),
        phone: j['phone']?.toString(),
        status: j['status']?.toString(),
      );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

class FleetAssignDriverScreen extends ConsumerStatefulWidget {
  const FleetAssignDriverScreen({super.key});

  @override
  ConsumerState<FleetAssignDriverScreen> createState() => _FleetAssignDriverScreenState();
}

class _FleetAssignDriverScreenState extends ConsumerState<FleetAssignDriverScreen> {
  bool _loading = true;
  String? _error;
  List<_VehicleAssignment> _assignments = [];
  List<_DriverOption> _drivers = [];

  // Track which vehicle row is currently being edited
  int? _editingVehicleId;
  int? _editingSelectedDriverId; // null = unassign

  final _searchCtrl = TextEditingController();
  String _search = '';

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiServiceProvider);
      final rawAssign = await api.get('/fleet/vehicle-assignments') as Map<String, dynamic>;
      final rawDrivers = await api.get('/drivers', queryParameters: {'limit': 200}) as Map<String, dynamic>;

      final assignList = (rawAssign['data'] ?? rawAssign) as List<dynamic>;
      final driverList = (() {
        final d = rawDrivers['data'] ?? rawDrivers;
        if (d is Map) return (d['items'] ?? d['results'] ?? []) as List<dynamic>;
        return d as List<dynamic>;
      })();

      setState(() {
        _assignments = assignList
            .map((e) => _VehicleAssignment.fromJson(e as Map<String, dynamic>))
            .toList();
        _drivers = driverList
            .map((e) => _DriverOption.fromJson(e as Map<String, dynamic>))
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _saveAssignment(int vehicleId, int? driverId) async {
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post(
        '/fleet/vehicles/$vehicleId/assign-driver',
        data: {'driver_id': driverId},
      );

      // Update local state
      final driver = driverId != null
          ? _drivers.firstWhere((d) => d.id == driverId, orElse: () => _DriverOption(id: 0, name: ''))
          : null;

      setState(() {
        _assignments = _assignments.map((a) {
          if (a.vehicleId == vehicleId) {
            return a.copyWith(
              defaultDriverId: driverId,
              driverName: driver?.name,
              driverPhone: driver?.phone,
              licenseNumber: null,
            );
          }
          return a;
        }).toList();
        _editingVehicleId = null;
        _editingSelectedDriverId = null;
        _saving = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(driverId != null ? 'Driver assigned successfully' : 'Driver unassigned'),
          backgroundColor: driverId != null ? KTColors.success : KTColors.warning,
        ));
      }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: KTColors.danger,
        ));
      }
    }
  }

  List<_VehicleAssignment> get _filtered {
    if (_search.isEmpty) return _assignments;
    final q = _search.toLowerCase();
    return _assignments.where((a) =>
        a.registration.toLowerCase().contains(q) ||
        (a.driverName ?? '').toLowerCase().contains(q)).toList();
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE': return KTColors.success;
      case 'ON_TRIP': return KTColors.info;
      case 'MAINTENANCE': return KTColors.warning;
      default: return KTColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final assigned = _assignments.where((a) => a.defaultDriverId != null).length;
    final unassigned = _assignments.length - assigned;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Assign Drivers', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading, decoration: TextDecoration.none)),
            Text('Assign default drivers to vehicles', style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: KTColors.textMuted),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KTColors.primary))
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    // Stats bar
                    _buildStatsBar(assigned, unassigned),
                    // Search
                    _buildSearch(),
                    // List
                    Expanded(child: _buildList()),
                  ],
                ),
    );
  }

  Widget _buildError() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded, size: 48, color: KTColors.danger.withOpacity(0.6)),
              const SizedBox(height: 12),
              Text('Failed to load', style: KTTextStyles.body.copyWith(color: KTColors.textHeading, decoration: TextDecoration.none)),
              const SizedBox(height: 4),
              Text(_error!, style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary, foregroundColor: Colors.white),
              ),
            ],
          ),
        ),
      );

  Widget _buildStatsBar(int assigned, int unassigned) => Container(
        color: KTColors.surface,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Row(
          children: [
            Expanded(child: _statChip('Total', '${_assignments.length}', KTColors.primary)),
            const SizedBox(width: 10),
            Expanded(child: _statChip('Assigned', '$assigned', KTColors.success)),
            const SizedBox(width: 10),
            Expanded(child: _statChip('Unassigned', '$unassigned', KTColors.warning)),
          ],
        ),
      );

  Widget _statChip(String label, String value, Color color) => Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Text(value, style: KTTextStyles.h3.copyWith(color: color, decoration: TextDecoration.none)),
            const SizedBox(height: 2),
            Text(label, style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
          ],
        ),
      );

  Widget _buildSearch() => Container(
        color: KTColors.surface,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: TextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() => _search = v),
          style: KTTextStyles.body.copyWith(color: KTColors.textHeading, decoration: TextDecoration.none),
          decoration: InputDecoration(
            hintText: 'Search vehicle or driver…',
            hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
            prefixIcon: const Icon(Icons.search_rounded, size: 18, color: KTColors.textMuted),
            suffixIcon: _search.isNotEmpty
                ? IconButton(icon: const Icon(Icons.close_rounded, size: 16), onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); })
                : null,
            filled: true,
            fillColor: KTColors.lightBg,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: KTColors.borderColor)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: KTColors.borderColor)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: KTColors.primary, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
      );

  Widget _buildList() {
    final items = _filtered;
    if (items.isEmpty) {
      return Center(
        child: Text('No vehicles found', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) => _buildCard(items[i]),
    );
  }

  Widget _buildCard(_VehicleAssignment v) {
    final isEditing = _editingVehicleId == v.vehicleId;

    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isEditing ? KTColors.primary.withOpacity(0.4) : KTColors.borderColor,
          width: isEditing ? 1.5 : 1,
        ),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Vehicle row ──────────────────────────────────────────
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: KTColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.local_shipping_rounded, size: 18, color: KTColors.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        v.registration,
                        style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.none,
                        ),
                      ),
                      Text(
                        v.vehicleType.replaceAll('_', ' '),
                        style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(v.status).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    v.status.toUpperCase(),
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(v.status), decoration: TextDecoration.none),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),
            const Divider(height: 1, color: KTColors.borderColor),
            const SizedBox(height: 12),

            // ── Driver section ───────────────────────────────────────
            if (!isEditing) ...[
              _buildDriverReadOnly(v),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      _editingVehicleId = v.vehicleId;
                      _editingSelectedDriverId = v.defaultDriverId;
                    });
                  },
                  icon: Icon(
                    v.defaultDriverId != null ? Icons.edit_rounded : Icons.person_add_rounded,
                    size: 16,
                  ),
                  label: Text(v.defaultDriverId != null ? 'Change Driver' : 'Assign Driver'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: KTColors.primary,
                    side: const BorderSide(color: KTColors.primary),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ] else ...[
              _buildDriverEdit(v),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDriverReadOnly(_VehicleAssignment v) {
    if (v.defaultDriverId == null) {
      return Row(
        children: [
          const Icon(Icons.person_off_outlined, size: 16, color: KTColors.textMuted),
          const SizedBox(width: 6),
          Text(
            'No driver assigned',
            style: KTTextStyles.body.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      );
    }
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: KTColors.success.withOpacity(0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: KTColors.success.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.person_rounded, size: 16, color: KTColors.success),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  v.driverName ?? 'Unknown Driver',
                  style: KTTextStyles.body.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600, decoration: TextDecoration.none),
                ),
                if (v.driverPhone != null)
                  Text(v.driverPhone!, style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: KTColors.success.withOpacity(0.15),
              borderRadius: BorderRadius.circular(5),
            ),
            child: Text('Assigned', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: KTColors.success, decoration: TextDecoration.none)),
          ),
        ],
      ),
    );
  }

  Widget _buildDriverEdit(_VehicleAssignment v) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Select Driver', style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600, decoration: TextDecoration.none)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          decoration: BoxDecoration(
            border: Border.all(color: KTColors.primary.withOpacity(0.4)),
            borderRadius: BorderRadius.circular(8),
            color: KTColors.lightBg,
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<int?>(
              isExpanded: true,
              value: _editingSelectedDriverId,
              hint: Text('Unassigned', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading, decoration: TextDecoration.none),
              dropdownColor: KTColors.surface,
              items: [
                DropdownMenuItem<int?>(
                  value: null,
                  child: Text('— Remove assignment —', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
                ),
                ..._drivers.map((d) => DropdownMenuItem<int?>(
                      value: d.id,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(d.name, style: KTTextStyles.body.copyWith(color: KTColors.textHeading, decoration: TextDecoration.none)),
                          if (d.phone != null)
                            Text(d.phone!, style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
                        ],
                      ),
                    )),
              ],
              onChanged: (val) => setState(() => _editingSelectedDriverId = val),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _saving ? null : () => setState(() { _editingVehicleId = null; _editingSelectedDriverId = null; }),
                style: OutlinedButton.styleFrom(
                  foregroundColor: KTColors.textMuted,
                  side: const BorderSide(color: KTColors.borderColor),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: _saving ? null : () => _saveAssignment(v.vehicleId, _editingSelectedDriverId),
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _saving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
