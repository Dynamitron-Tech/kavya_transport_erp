import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final fleetVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fleet/vehicles');
  final payload = res['data'] ?? res;
  if (payload is List) return payload.cast<Map<String, dynamic>>();
  return [];
});

class FleetVehiclesScreen extends ConsumerStatefulWidget {
  const FleetVehiclesScreen({super.key});

  @override
  ConsumerState<FleetVehiclesScreen> createState() => _FleetVehiclesScreenState();
}

class _FleetVehiclesScreenState extends ConsumerState<FleetVehiclesScreen> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  String _statusFilter = 'All';
  static const _filters = ['All', 'Available', 'On Trip', 'Maintenance', 'Inactive'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(fleetVehiclesProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Text('Fleet Vehicles', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: KTColors.fleetAccent),
            onPressed: () async {
              final result = await context.push('/fleet/vehicle/add');
              if (result == true) ref.invalidate(fleetVehiclesProvider);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── Search ────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search by reg. no., driver, or model…',
                hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                prefixIcon: const Icon(Icons.search, color: KTColors.fleetAccent),
                filled: true,
                fillColor: KTColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
            ),
          ),

          // ─── Status Filter Chips ───────────────────────────────
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _filters[i];
                final selected = _statusFilter == f;
                return FilterChip(
                  label: Text(f),
                  selected: selected,
                  onSelected: (_) => setState(() => _statusFilter = f),
                  labelStyle: KTTextStyles.label.copyWith(
                    color: selected ? Colors.white : KTColors.textMuted,
                  ),
                  selectedColor: KTColors.fleetAccent,
                  backgroundColor: KTColors.surface,
                  side: BorderSide(color: selected ? KTColors.fleetAccent : KTColors.borderColor),
                  showCheckmark: false,
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ─── Vehicle List ─────────────────────────────────────
          Expanded(
            child: vehiclesAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: KTColors.fleetAccent),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
                    const SizedBox(height: 12),
                    Text('Failed to load vehicles',
                        style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(fleetVehiclesProvider),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: KTColors.fleetAccent,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (allVehicles) {
                final vehicles = _applyFilters(allVehicles);
                if (vehicles.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.directions_car_outlined,
                            size: 56, color: KTColors.textMuted),
                        const SizedBox(height: 12),
                        Text('No vehicles found',
                            style: KTTextStyles.h3.copyWith(color: KTColors.textMuted)),
                        const SizedBox(height: 4),
                        Text('Try adjusting the search or filter',
                            style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: KTColors.fleetAccent,
                  onRefresh: () async => ref.invalidate(fleetVehiclesProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: vehicles.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _vehicleCard(context, vehicles[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> vehicles) {
    var list = vehicles;
    if (_searchQuery.isNotEmpty) {
      list = list.where((v) {
        final reg = (v['registration_number'] ?? v['reg_number'] ?? '').toString().toLowerCase();
        final make = (v['make'] ?? '').toString().toLowerCase();
        final model = (v['model'] ?? '').toString().toLowerCase();
        return reg.contains(_searchQuery) || make.contains(_searchQuery) || model.contains(_searchQuery);
      }).toList();
    }
    if (_statusFilter != 'All') {
      final target = _statusFilter.toLowerCase().replaceAll(' ', '_');
      list = list.where((v) => (v['status'] ?? '').toString().toLowerCase() == target).toList();
    }
    return list;
  }

  Widget _vehicleCard(BuildContext context, Map<String, dynamic> vehicle) {
    final id = vehicle['id'];
    final regNumber = (vehicle['registration_number'] ?? vehicle['reg_number'] ?? '—').toString();
    final make = (vehicle['make'] ?? '').toString();
    final model = (vehicle['model'] ?? '').toString();
    final year = vehicle['year_of_manufacture']?.toString() ?? '';
    final modelStr = [make, model, if (year.isNotEmpty) '($year)'].where((s) => s.isNotEmpty).join(' ');
    final status = (vehicle['status'] ?? 'available').toString().toLowerCase();
    final fuelType = (vehicle['fuel_type'] ?? '—').toString();
    final odometer = (vehicle['odometer_reading'] as num?)?.toInt() ?? 0;
    final statusColor = _getStatusColor(status);

    return GestureDetector(
      onTap: () async {
        final result = await context.push('/fleet/vehicle/$id/edit');
        if (result == true) ref.invalidate(fleetVehiclesProvider);
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row: reg number + status badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        regNumber,
                        style: KTTextStyles.h3.copyWith(
                          color: KTColors.fleetAccent,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        modelStr.isNotEmpty ? modelStr : '—',
                        style: KTTextStyles.bodySmall.copyWith(
                          color: KTColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    status.replaceAll('_', ' ').toUpperCase(),
                    style: KTTextStyles.label.copyWith(
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Info row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _infoColumn('Fuel', fuelType),
                  _infoColumn('Odometer', '${(odometer / 1000).toStringAsFixed(1)}k km'),
                  _infoColumn('Type', (vehicle['vehicle_type'] ?? '—').toString()),
                ],
              ),
            ),
            const SizedBox(height: 10),
            // Footer: actions
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _actionBtn(context, Icons.edit_outlined, 'Edit', KTColors.fleetAccent, () async {
                  final result = await context.push('/fleet/vehicle/$id/edit');
                  if (result == true) ref.invalidate(fleetVehiclesProvider);
                }),
                const SizedBox(width: 8),
                _actionBtn(context, Icons.my_location, 'Track', KTColors.info, () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('GPS tracking coming soon')),
                  );
                }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionBtn(
    BuildContext context,
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(label, style: KTTextStyles.label.copyWith(color: color)),
          ],
        ),
      ),
    );
  }

  Widget _infoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: KTTextStyles.bodySmall.copyWith(
            color: KTColors.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: KTTextStyles.bodySmall.copyWith(
            fontWeight: FontWeight.w600,
            color: KTColors.textHeading,
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'available':
        return KTColors.success;
      case 'on_trip':
        return KTColors.info;
      case 'maintenance':
        return KTColors.warning;
      case 'breakdown':
        return KTColors.danger;
      case 'inactive':
        return KTColors.danger;
      default:
        return KTColors.textMuted;
    }
  }
}
