import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ─────────────────────────────────────────────────────────────

final _vehicleFuelLogsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, vehicleId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/vehicles/$vehicleId/fuel-logs');
    if (res is Map<String, dynamic>) {
      final data = res['data'];
      if (data is Map<String, dynamic>) return data;
    }
    return {'items': [], 'summary': null};
  },
);

final _vehicleTripsMileageProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, vehicleId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/vehicles/$vehicleId/trips-mileage');
    if (res is Map<String, dynamic>) {
      final data = res['data'];
      if (data is Map<String, dynamic>) return data;
    }
    return {'items': [], 'summary': null};
  },
);

// ─── Screen ────────────────────────────────────────────────────────────────

class FleetVehicleMileageScreen extends ConsumerWidget {
  final int vehicleId;
  final String registrationNumber;

  const FleetVehicleMileageScreen({
    super.key,
    required this.vehicleId,
    required this.registrationNumber,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: KTColors.lightBg,
        appBar: AppBar(
          backgroundColor: KTColors.surface,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: KTColors.textHeading,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mileage Details',
                  style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
              Text(
                registrationNumber,
                style: KTTextStyles.label.copyWith(color: KTColors.textMuted),
              ),
            ],
          ),
          bottom: TabBar(
            labelColor: KTColors.fleetAccent,
            unselectedLabelColor: KTColors.textMuted,
            indicatorColor: KTColors.fleetAccent,
            indicatorSize: TabBarIndicatorSize.label,
            labelStyle: KTTextStyles.body.copyWith(fontWeight: FontWeight.w600),
            tabs: const [
              Tab(text: 'Standard'),
              Tab(text: 'Trips'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _StandardMileageTab(vehicleId: vehicleId, ref: ref),
            _TripsMileageTab(vehicleId: vehicleId, ref: ref),
          ],
        ),
      ),
    );
  }
}

// ─── Standard (fill-up) tab ────────────────────────────────────────────────

class _StandardMileageTab extends ConsumerWidget {
  final int vehicleId;
  final WidgetRef ref;

  const _StandardMileageTab({required this.vehicleId, required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(_vehicleFuelLogsProvider(vehicleId));

    return dataAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
            const SizedBox(height: 12),
            Text('Failed to load fuel logs', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(_vehicleFuelLogsProvider(vehicleId)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (data) {
        final items = (data['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        final summary = data['summary'] as Map<String, dynamic>?;

        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.local_gas_station_outlined,
                    size: 60, color: KTColors.textMuted.withOpacity(0.4)),
                const SizedBox(height: 16),
                Text('No fuel fill-up records yet',
                    style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                const SizedBox(height: 4),
                Text('Drivers log fill-ups from the Driver app.',
                    style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_vehicleFuelLogsProvider(vehicleId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (summary != null) _StandardSummaryCard(summary: summary),
              const SizedBox(height: 16),
              ...items.map((log) => _FuelLogCard(log: log)),
            ],
          ),
        );
      },
    );
  }
}

class _StandardSummaryCard extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _StandardSummaryCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final avg = summary['avg_km_per_litre'];
    final totalFills = summary['total_fills'] ?? 0;
    final totalLitres = summary['total_litres'] ?? 0.0;
    final good = summary['good_count'] ?? 0;
    final medium = summary['medium_count'] ?? 0;
    final bad = summary['bad_count'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0EA5E9).withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_gas_station, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text('Standard Mileage Summary',
                  style: KTTextStyles.body.copyWith(
                      color: Colors.white70, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Avg Mileage',
                  value: avg != null ? '${avg.toStringAsFixed(1)} km/L' : '--',
                  icon: Icons.speed,
                ),
              ),
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Total Fills',
                  value: '$totalFills',
                  icon: Icons.local_gas_station_outlined,
                ),
              ),
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Total Litres',
                  value: '${(totalLitres as num).toStringAsFixed(0)} L',
                  icon: Icons.water_drop_outlined,
                ),
              ),
            ],
          ),
          if ((good as int) + (medium as int) + (bad as int) > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _RatingBadge(label: 'Good', count: good, color: KTColors.success),
                const SizedBox(width: 8),
                _RatingBadge(label: 'Average', count: medium, color: KTColors.warning),
                const SizedBox(width: 8),
                _RatingBadge(label: 'Poor', count: bad, color: KTColors.danger),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SummaryStatWhite extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _SummaryStatWhite(
      {required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: Colors.white70, size: 18),
        const SizedBox(height: 4),
        Text(value,
            style: KTTextStyles.body.copyWith(
                color: Colors.white, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label,
            style: KTTextStyles.label.copyWith(color: Colors.white60)),
      ],
    );
  }
}

class _RatingBadge extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _RatingBadge(
      {required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
              width: 6,
              height: 6,
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text('$count $label',
              style: KTTextStyles.label.copyWith(color: Colors.white)),
        ],
      ),
    );
  }
}

class _FuelLogCard extends StatelessWidget {
  final Map<String, dynamic> log;
  const _FuelLogCard({required this.log});

  Color _ratingColor(String? rating) {
    switch (rating) {
      case 'good':
        return KTColors.success;
      case 'medium':
        return KTColors.warning;
      case 'bad':
        return KTColors.danger;
      default:
        return KTColors.textMuted;
    }
  }

  String _ratingLabel(String? rating) {
    switch (rating) {
      case 'good':
        return 'Good';
      case 'medium':
        return 'Average';
      case 'bad':
        return 'Poor';
      default:
        return '--';
    }
  }

  @override
  Widget build(BuildContext context) {
    final fillDate = log['fill_date'] ?? '';
    final dateLabel = fillDate.isNotEmpty
        ? fillDate.toString().substring(0, 10)
        : '--';
    final odometer = log['odometer_km'];
    final litresFilled = log['litres_filled'];
    final kmPerLitre = log['km_per_litre'];
    final kmSince = log['km_since_last_fill'];
    final rating = log['mileage_rating'] as String?;
    final driverName = log['driver_name'] ?? '';
    final pumpName = log['pump_name'] ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: KTColors.fleetAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.local_gas_station,
                    size: 18, color: KTColors.fleetAccent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dateLabel,
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w600),
                    ),
                    if (driverName.isNotEmpty)
                      Text(
                        driverName,
                        style: KTTextStyles.label
                            .copyWith(color: KTColors.textMuted),
                      ),
                  ],
                ),
              ),
              if (rating != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _ratingColor(rating).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _ratingLabel(rating),
                    style: KTTextStyles.label.copyWith(
                        color: _ratingColor(rating),
                        fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _LogStat(
                      label: 'Odometer',
                      value: odometer != null
                          ? '${(odometer as num).toStringAsFixed(0)} km'
                          : '--')),
              Expanded(
                  child: _LogStat(
                      label: 'Filled',
                      value: litresFilled != null
                          ? '${(litresFilled as num).toStringAsFixed(1)} L'
                          : '--')),
              Expanded(
                  child: _LogStat(
                      label: 'Mileage',
                      value: kmPerLitre != null
                          ? '${(kmPerLitre as num).toStringAsFixed(1)} km/L'
                          : '--',
                      highlight: kmPerLitre != null)),
              Expanded(
                  child: _LogStat(
                      label: 'km Since',
                      value: kmSince != null
                          ? '${(kmSince as num).toStringAsFixed(0)} km'
                          : '--')),
            ],
          ),
          if (pumpName.toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on_outlined,
                    size: 14, color: KTColors.textMuted),
                const SizedBox(width: 4),
                Text(pumpName.toString(),
                    style: KTTextStyles.label
                        .copyWith(color: KTColors.textMuted)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _LogStat extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  const _LogStat(
      {required this.label, required this.value, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: KTTextStyles.body.copyWith(
            color:
                highlight ? KTColors.fleetAccent : KTColors.textHeading,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 2),
        Text(label,
            style: KTTextStyles.label.copyWith(
                color: KTColors.textMuted, fontSize: 11)),
      ],
    );
  }
}

// ─── Trips Mileage Tab ─────────────────────────────────────────────────────

class _TripsMileageTab extends ConsumerWidget {
  final int vehicleId;
  final WidgetRef ref;

  const _TripsMileageTab({required this.vehicleId, required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(_vehicleTripsMileageProvider(vehicleId));

    return dataAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
            const SizedBox(height: 12),
            Text('Failed to load trip mileage',
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(_vehicleTripsMileageProvider(vehicleId)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (data) {
        final items = (data['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        final summary = data['summary'] as Map<String, dynamic>?;

        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.route_outlined,
                    size: 60, color: KTColors.textMuted.withOpacity(0.4)),
                const SizedBox(height: 16),
                Text('No trips with odometer data yet',
                    style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                const SizedBox(height: 4),
                Text('Trips need start & end odometer readings.',
                    style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(_vehicleTripsMileageProvider(vehicleId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (summary != null) _TripsSummaryCard(summary: summary),
              const SizedBox(height: 16),
              ...items.map((trip) => _TripMileageCard(trip: trip)),
            ],
          ),
        );
      },
    );
  }
}

class _TripsSummaryCard extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _TripsSummaryCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final avg = summary['avg_km_per_litre'];
    final totalTrips = summary['total_trips'] ?? 0;
    final totalKm = summary['total_distance_km'] ?? 0.0;
    final totalLitres = summary['total_fuel_litres'] ?? 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF10B981), Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.route, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text('Trip-based Mileage Summary',
                  style: KTTextStyles.body.copyWith(
                      color: Colors.white70, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Avg Mileage',
                  value: avg != null ? '${(avg as num).toStringAsFixed(1)} km/L' : '--',
                  icon: Icons.speed,
                ),
              ),
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Trips',
                  value: '$totalTrips',
                  icon: Icons.local_shipping_outlined,
                ),
              ),
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Distance',
                  value: '${(totalKm as num).toStringAsFixed(0)} km',
                  icon: Icons.straighten,
                ),
              ),
              Expanded(
                child: _SummaryStatWhite(
                  label: 'Fuel',
                  value: '${(totalLitres as num).toStringAsFixed(0)} L',
                  icon: Icons.water_drop_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TripMileageCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripMileageCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final tripNumber = trip['trip_number'] ?? '--';
    final origin = trip['origin'] ?? '';
    final destination = trip['destination'] ?? '';
    final tripDate = (trip['trip_date'] ?? '').toString();
    final dateLabel =
        tripDate.length >= 10 ? tripDate.substring(0, 10) : tripDate;
    final driverName = trip['driver_name'] ?? '';
    final distanceKm = trip['distance_km'];
    final totalFuel = trip['total_fuel_litres'];
    final kmPerLitre = trip['km_per_litre'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: KTColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.local_shipping_outlined,
                    size: 18, color: KTColors.success),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tripNumber.toString(),
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w600),
                    ),
                    Text(
                      dateLabel.isNotEmpty ? dateLabel : '--',
                      style: KTTextStyles.label
                          .copyWith(color: KTColors.textMuted),
                    ),
                  ],
                ),
              ),
              if (kmPerLitre != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: KTColors.fleetAccent.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${(kmPerLitre as num).toStringAsFixed(1)} km/L',
                    style: KTTextStyles.body.copyWith(
                        color: KTColors.fleetAccent,
                        fontWeight: FontWeight.w700),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: KTColors.textMuted.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'No fuel data',
                    style: KTTextStyles.label
                        .copyWith(color: KTColors.textMuted),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (origin.isNotEmpty && destination.isNotEmpty)
            Row(
              children: [
                const Icon(Icons.trending_flat,
                    size: 14, color: KTColors.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    '$origin → $destination',
                    style: KTTextStyles.label
                        .copyWith(color: KTColors.textMuted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: _LogStat(
                      label: 'Distance',
                      value: distanceKm != null
                          ? '${(distanceKm as num).toStringAsFixed(0)} km'
                          : '--')),
              Expanded(
                  child: _LogStat(
                      label: 'Fuel Used',
                      value: (totalFuel != null &&
                              (totalFuel as num) > 0)
                          ? '${totalFuel.toStringAsFixed(1)} L'
                          : '--')),
              Expanded(
                  child: _LogStat(
                      label: 'Mileage',
                      value: kmPerLitre != null
                          ? '${(kmPerLitre as num).toStringAsFixed(1)} km/L'
                          : '--',
                      highlight: kmPerLitre != null)),
              Expanded(
                  child: _LogStat(
                      label: 'Driver',
                      value: driverName.toString().isNotEmpty
                          ? driverName.toString().split(' ').first
                          : '--')),
            ],
          ),
        ],
      ),
    );
  }
}
