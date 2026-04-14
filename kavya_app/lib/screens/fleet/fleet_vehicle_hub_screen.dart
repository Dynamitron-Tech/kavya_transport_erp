import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';
import 'fleet_vehicle_documents_screen.dart';
import 'fleet_vehicle_mileage_screen.dart';
import 'fleet_vehicle_trip_history_screen.dart';

// ─── Provider ──────────────────────────────────────────────────────────────

final _vehicleHubProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/vehicles/$id');
    // Response is wrapped: {"success": true, "data": {...}}
    if (res is Map<String, dynamic>) {
      final inner = res['data'];
      if (inner is Map<String, dynamic>) return inner;
      return res;
    }
    return <String, dynamic>{};
  },
);

// ─── Screen ────────────────────────────────────────────────────────────────

class FleetVehicleHubScreen extends ConsumerWidget {
  final int vehicleId;
  const FleetVehicleHubScreen({super.key, required this.vehicleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleAsync = ref.watch(_vehicleHubProvider(vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: vehicleAsync.when(
          data: (v) => Text(
            (v['registration_number'] ?? v['reg_number'] ?? 'Vehicle').toString(),
            style: KTTextStyles.h2.copyWith(
              color: KTColors.fleetAccent,
              letterSpacing: 0.5,
            ),
          ),
          loading: () => Text('Vehicle', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
          error: (_, __) => Text('Vehicle', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        ),
      ),
      body: vehicleAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: KTColors.fleetAccent),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load vehicle',
                  style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(_vehicleHubProvider(vehicleId)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.fleetAccent,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (vehicle) => _HubBody(vehicle: vehicle, vehicleId: vehicleId),
      ),
    );
  }
}

// ─── Body ──────────────────────────────────────────────────────────────────

class _HubBody extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  final int vehicleId;
  const _HubBody({required this.vehicle, required this.vehicleId});

  @override
  Widget build(BuildContext context) {
    final status = (vehicle['status'] ?? 'available').toString().toLowerCase();
    final make = (vehicle['make'] ?? '').toString();
    final model = (vehicle['model'] ?? '').toString();
    final year = vehicle['year_of_manufacture']?.toString() ?? '';
    final modelStr = [make, model, if (year.isNotEmpty) '($year)'].where((s) => s.isNotEmpty).join(' ');
    final fuelType = (vehicle['fuel_type'] ?? '—').toString();
    final odometerRaw = vehicle['odometer_reading'];
    final odometer = (num.tryParse(odometerRaw?.toString() ?? '') ?? (odometerRaw as num? ?? 0)).toInt();
    final vehicleType = (vehicle['vehicle_type'] ?? '—').toString();
    final statusColor = _statusColor(status);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Vehicle Info Card ─────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: KTColors.fleetAccentBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.local_shipping_outlined,
                          color: KTColors.fleetAccent, size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            modelStr.isNotEmpty ? modelStr : '—',
                            style: KTTextStyles.body.copyWith(
                              color: KTColors.textHeading,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            vehicleType.toUpperCase(),
                            style: KTTextStyles.label.copyWith(color: KTColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusColor.withValues(alpha: 0.4)),
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
                const SizedBox(height: 14),
                const Divider(color: KTColors.borderColor, height: 1),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _statItem(Icons.local_gas_station_outlined, 'Fuel', fuelType),
                    _statItem(Icons.speed_outlined, 'Odometer',
                        '${(odometer / 1000).toStringAsFixed(1)}k km'),
                    _statItem(
                      Icons.inventory_2_outlined,
                      'Capacity',
                      '${vehicle['capacity_tons'] ?? '—'} T',
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),
          Text(
            'ACTIONS',
            style: KTTextStyles.label.copyWith(
              color: KTColors.textMuted,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),

          // ── Primary Action Cards ──────────────────────────────
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  icon: Icons.folder_open_outlined,
                  label: 'Documents',
                  subtitle: 'Licences, insurance\n& compliance docs',
                  color: KTColors.info,
                  bgColor: KTColors.infoBg,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FleetVehicleDocumentsScreen(
                        vehicleId: vehicleId,
                        registrationNumber: (vehicle['registration_number'] ?? '').toString(),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  icon: Icons.history_outlined,
                  label: 'Trip History',
                  subtitle: 'Past trips, routes\n& performance',
                  color: KTColors.success,
                  bgColor: KTColors.successBg,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FleetVehicleTripHistoryScreen(
                        vehicleId: vehicleId,
                        registrationNumber: (vehicle['registration_number'] ?? '').toString(),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ── Vehicle Details Button ────────────────────────────
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/fleet/vehicle/$vehicleId/edit'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(color: KTColors.fleetAccent, width: 1.5),
                foregroundColor: KTColors.fleetAccent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.tune_outlined, size: 20),
              label: Text(
                'Vehicle Details',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.fleetAccent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ── Mileage Details Button ────────────────────────────
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => FleetVehicleMileageScreen(
                    vehicleId: vehicleId,
                    registrationNumber:
                        (vehicle['registration_number'] ?? '').toString(),
                  ),
                ),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(color: Color(0xFF10B981), width: 1.5),
                foregroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.speed_outlined, size: 20),
              label: Text(
                'Mileage Details',
                style: KTTextStyles.body.copyWith(
                  color: const Color(0xFF10B981),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: KTColors.textMuted, size: 18),
        const SizedBox(height: 4),
        Text(value,
            style: KTTextStyles.body.copyWith(
                color: KTColors.textHeading, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(label,
            style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
      ],
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: KTTextStyles.body.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'available':
        return KTColors.success;
      case 'on_trip':
        return KTColors.info;
      case 'maintenance':
        return KTColors.warning;
      case 'breakdown':
        return KTColors.danger;
      default:
        return KTColors.textMuted;
    }
  }
}
