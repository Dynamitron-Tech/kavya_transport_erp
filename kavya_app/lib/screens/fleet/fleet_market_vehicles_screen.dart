import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';
import 'fleet_vehicle_fuel_history_screen.dart';

/// Fetches all vehicles with ownership_type=MARKET from the vehicles table.
final marketVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/vehicles', queryParameters: {
    'ownership_type': 'MARKET',
    'limit': 500,
  });
  List<dynamic> items = [];
  if (res is Map<String, dynamic>) {
    final data = res['data'];
    if (data is Map) {
      items = (data['items'] as List?) ?? [];
    } else if (data is List) {
      items = data;
    }
  }
  return items.map((v) {
    final m = v as Map<String, dynamic>;
    return {
      'vehicle_registration': m['registration_number'] ?? '',
      'vehicle_type': m['vehicle_type'] ?? '',
      'vehicle_make': m['make'] ?? '',
      'vehicle_model': m['model'] ?? '',
      'fuel_type': m['fuel_type'] ?? '',
      'owner_name': m['owner_name'] ?? '',
      'owner_phone': m['owner_phone'] ?? '',
      'chassis_number': m['chassis_number'] ?? '',
      'driver_name': (m['assigned_driver'] as Map?)?['name'] ?? '',
      'driver_phone': '',
      'driver_license': '',
      'status': m['status'] ?? '',
      'trip_count': 0,
      'total_client_revenue': 0.0,
      'total_contractor_cost': 0.0,
      'status_summary': m['status'] ?? '',
      'id': m['id'] as int? ?? 0,
    };
  }).toList();
});

class FleetMarketVehiclesScreen extends ConsumerWidget {
  const FleetMarketVehiclesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehiclesAsync = ref.watch(marketVehiclesProvider);
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          color: KTColors.textHeading,
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Market Vehicles',
          style: KTTextStyles.h3.copyWith(
            color: KTColors.textHeading,
            decoration: TextDecoration.none,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            color: KTColors.textMuted,
            onPressed: () => ref.invalidate(marketVehiclesProvider),
          ),
        ],
      ),
      body: vehiclesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 40),
              const SizedBox(height: 10),
              Text(
                'Failed to load market vehicles',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
        ),
        data: (vehicles) {
          final availableCount = vehicles
              .where((v) => (v['status'] as String?) == 'AVAILABLE')
              .length;
          final uniqueOwners = vehicles
              .map((v) => v['owner_name'] as String?)
              .where((o) => o != null && o.isNotEmpty)
              .toSet()
              .length;

          return Column(
            children: [
              // ── Summary strip ─────────────────────────────────────────
              Container(
                color: KTColors.surface,
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    _StatChip(
                        'Vehicles', '${vehicles.length}', KTColors.info),
                    const SizedBox(width: 8),
                    _StatChip('Available', '$availableCount', KTColors.success),
                    const SizedBox(width: 8),
                    _StatChip('Owners', '$uniqueOwners', KTColors.warning),
                  ],
                ),
              ),
              const Divider(height: 1, color: KTColors.borderColor),
              // ── Vehicle list ──────────────────────────────────────────
              Expanded(
                child: vehicles.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.local_shipping_rounded,
                                color: KTColors.textMuted
                                    .withValues(alpha: 0.4),
                                size: 48),
                            const SizedBox(height: 12),
                            Text(
                              'No market vehicles found',
                              style: KTTextStyles.body.copyWith(
                                color: KTColors.textMuted,
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: vehicles.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 10),
                        itemBuilder: (_, i) =>
                            _MarketVehicleCard(vehicle: vehicles[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Market Vehicle Card ───────────────────────────────────────────────────────
class _MarketVehicleCard extends StatefulWidget {
  final Map<String, dynamic> vehicle;
  const _MarketVehicleCard({required this.vehicle});

  @override
  State<_MarketVehicleCard> createState() => _MarketVehicleCardState();
}

class _MarketVehicleCardState extends State<_MarketVehicleCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final v = widget.vehicle;
    final reg = (v['vehicle_registration'] as String?) ?? '—';
    final make = (v['vehicle_make'] as String?) ?? '';
    final model = (v['vehicle_model'] as String?) ?? '';
    final type = (v['vehicle_type'] as String?) ?? '';
    final fuel = (v['fuel_type'] as String?) ?? '';
    final driverName = (v['driver_name'] as String?) ?? '';
    final ownerName = (v['owner_name'] as String?) ?? '';
    final ownerPhone = (v['owner_phone'] as String?) ?? '';
    final status = (v['status'] as String?) ?? '';
    final chassis = (v['chassis_number'] as String?) ?? '';

    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: KTColors.warning.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.local_shipping_rounded,
                        color: KTColors.warning, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          reg,
                          style: KTTextStyles.label.copyWith(
                            color: KTColors.textHeading,
                            fontWeight: FontWeight.w700,
                            decoration: TextDecoration.none,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          [
                            if (make.isNotEmpty) make,
                            if (model.isNotEmpty) model,
                            if (type.isNotEmpty) type,
                          ].join(' · ').isNotEmpty
                              ? [
                                  if (make.isNotEmpty) make,
                                  if (model.isNotEmpty) model,
                                  if (type.isNotEmpty) type,
                                ].join(' · ')
                              : 'Unknown type',
                          style: KTTextStyles.bodySmall.copyWith(
                            color: KTColors.textMuted,
                            decoration: TextDecoration.none,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Status badge
                  if (status.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: status == 'AVAILABLE'
                            ? KTColors.success.withValues(alpha: 0.12)
                            : KTColors.warning.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        status,
                        style: KTTextStyles.labelSmall.copyWith(
                          color: status == 'AVAILABLE'
                              ? KTColors.success
                              : KTColors.warning,
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ),
                  const SizedBox(width: 6),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: KTColors.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          // Owner summary (always visible)
          if (ownerName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(
                children: [
                  const Icon(Icons.person_outline_rounded,
                      size: 14, color: KTColors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      ownerPhone.isNotEmpty
                          ? '$ownerName · $ownerPhone'
                          : ownerName,
                      style: KTTextStyles.bodySmall.copyWith(
                        color: KTColors.textMuted,
                        decoration: TextDecoration.none,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          // Expanded details
          if (_expanded) ...[
            const Divider(height: 1, color: KTColors.borderColor),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (fuel.isNotEmpty) _DetailRow('Fuel Type', fuel),
                  if (driverName.isNotEmpty)
                    _DetailRow('Driver', driverName),
                  if (ownerName.isNotEmpty)
                    _DetailRow('Owner', ownerName),
                  if (ownerPhone.isNotEmpty)
                    _DetailRow('Owner Phone', ownerPhone),
                  if (chassis.isNotEmpty)
                    _DetailRow('Chassis No.', chassis),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        final vehicleId = (widget.vehicle['id'] as int?) ?? 0;
                        final registration = (widget.vehicle['vehicle_registration'] as String?) ?? '';
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => FleetVehicleFuelHistoryScreen(
                              vehicleId: vehicleId,
                              registrationNumber: registration,
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.history_rounded, size: 16),
                      label: const Text('History'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: KTColors.primary,
                        side: const BorderSide(color: KTColors.primary),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        textStyle: KTTextStyles.label.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: KTTextStyles.label.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: KTTextStyles.labelSmall.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: KTTextStyles.bodySmall.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: KTTextStyles.bodySmall.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
