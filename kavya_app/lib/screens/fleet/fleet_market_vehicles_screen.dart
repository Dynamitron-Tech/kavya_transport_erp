import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

/// Fetches all market trips and deduplicates by vehicle_registration
/// to produce a list of unique market vehicles with usage stats.
final marketVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res =
      await api.get('/market-trips', queryParameters: {'limit': 500});
  List<dynamic> trips = [];
  if (res is Map<String, dynamic>) {
    final data = res['data'];
    if (data is List) trips = data;
  }

  // Group by vehicle_registration
  final Map<String, Map<String, dynamic>> vehicleMap = {};
  for (final t in trips) {
    final trip = t as Map<String, dynamic>;
    final reg = (trip['vehicle_registration'] as String?) ?? 'UNKNOWN';
    if (!vehicleMap.containsKey(reg)) {
      vehicleMap[reg] = {
        'vehicle_registration': reg,
        'vehicle_type': trip['vehicle_type'] ?? '',
        'vehicle_make': trip['vehicle_make'] ?? '',
        'vehicle_model': trip['vehicle_model'] ?? '',
        'fuel_type': trip['fuel_type'] ?? '',
        'owner_name': trip['owner_name'] ?? '',
        'chassis_number': trip['chassis_number'] ?? '',
        'driver_name': trip['driver_name'] ?? '',
        'driver_phone': trip['driver_phone'] ?? '',
        'driver_license': trip['driver_license'] ?? '',
        'trip_count': 0,
        'total_client_revenue': 0.0,
        'total_contractor_cost': 0.0,
        'statuses': <String>{},
      };
    }
    final v = vehicleMap[reg]!;
    v['trip_count'] = (v['trip_count'] as int) + 1;
    v['total_client_revenue'] = (v['total_client_revenue'] as double) +
        _parseAmount(trip['client_rate']);
    v['total_contractor_cost'] = (v['total_contractor_cost'] as double) +
        _parseAmount(trip['contractor_rate']);
    final statuses = v['statuses'] as Set<String>;
    if (trip['status'] != null) statuses.add(trip['status'].toString());

    // Update driver info to latest
    if ((trip['driver_name'] as String?)?.isNotEmpty == true) {
      v['driver_name'] = trip['driver_name'];
      v['driver_phone'] = trip['driver_phone'] ?? '';
    }
  }

  // Convert sets to strings for display and sort by trip count desc
  final result = vehicleMap.values.map((v) {
    final statuses = v['statuses'] as Set<String>;
    v['status_summary'] = statuses.join(', ');
    v.remove('statuses');
    return v;
  }).toList();

  result.sort((a, b) =>
      (b['trip_count'] as int).compareTo(a['trip_count'] as int));
  return result;
});

double _parseAmount(dynamic val) {
  if (val == null) return 0;
  if (val is num) return val.toDouble();
  return double.tryParse(val.toString()) ?? 0;
}

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
          final totalTrips = vehicles.fold<int>(
              0, (sum, v) => sum + (v['trip_count'] as int));
          final totalRevenue = vehicles.fold<double>(
              0.0, (sum, v) => sum + (v['total_client_revenue'] as double));

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
                    _StatChip('Total Trips', '$totalTrips', KTColors.warning),
                    const SizedBox(width: 8),
                    _StatChip(
                      'Revenue',
                      _formatAmt(totalRevenue),
                      KTColors.success,
                    ),
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

  static String _formatAmt(double amt) {
    if (amt >= 10000000) return '₹${(amt / 10000000).toStringAsFixed(1)}Cr';
    if (amt >= 100000) return '₹${(amt / 100000).toStringAsFixed(1)}L';
    if (amt >= 1000) return '₹${(amt / 1000).toStringAsFixed(1)}k';
    return '₹${amt.toStringAsFixed(0)}';
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
    final driverName = (v['driver_name'] as String?) ?? '—';
    final driverPhone = (v['driver_phone'] as String?) ?? '';
    final ownerName = (v['owner_name'] as String?) ?? '';
    final tripCount = (v['trip_count'] as int?) ?? 0;
    final revenue = (v['total_client_revenue'] as double?) ?? 0.0;
    final cost = (v['total_contractor_cost'] as double?) ?? 0.0;
    final margin = revenue - cost;
    final chassis = (v['chassis_number'] as String?) ?? '';
    final dl = (v['driver_license'] as String?) ?? '';

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
                  // Trip count badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: KTColors.info.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$tripCount trip${tripCount == 1 ? '' : 's'}',
                      style: KTTextStyles.labelSmall.copyWith(
                        color: KTColors.info,
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
          // Revenue summary (always visible)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Row(
              children: [
                _AmountBadge(
                    'Revenue', _fmtAmt(revenue), KTColors.primary),
                const SizedBox(width: 8),
                _AmountBadge('Cost', _fmtAmt(cost), KTColors.warning),
                const SizedBox(width: 8),
                _AmountBadge(
                  'Margin',
                  _fmtAmt(margin),
                  margin >= 0 ? KTColors.success : KTColors.danger,
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
                  _DetailRow('Driver', driverName),
                  if (driverPhone.isNotEmpty)
                    _DetailRow('Driver Phone', driverPhone),
                  if (dl.isNotEmpty) _DetailRow('DL Number', dl),
                  if (ownerName.isNotEmpty)
                    _DetailRow('Owner', ownerName),
                  if (chassis.isNotEmpty)
                    _DetailRow('Chassis No.', chassis),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _fmtAmt(double amt) {
    if (amt >= 100000) return '₹${(amt / 100000).toStringAsFixed(1)}L';
    if (amt >= 1000) return '₹${(amt / 1000).toStringAsFixed(1)}k';
    return '₹${amt.toStringAsFixed(0)}';
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

class _AmountBadge extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _AmountBadge(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.none,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
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
