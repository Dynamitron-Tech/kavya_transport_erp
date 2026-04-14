import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ────────────────────────────────────────────────────────────────

/// Fetches all market trips and deduplicates by driver_phone
/// to produce a list of unique market drivers with usage stats.
final marketDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res =
      await api.get('/market-trips', queryParameters: {'limit': 500});
  List<dynamic> trips = [];
  if (res is Map<String, dynamic>) {
    final data = res['data'];
    if (data is List) trips = data;
  }

  // Group by driver_phone (fall back to driver_name for phoneless entries)
  final Map<String, Map<String, dynamic>> driverMap = {};
  for (final t in trips) {
    final trip = t as Map<String, dynamic>;
    final phone = (trip['driver_phone'] as String?)?.trim() ?? '';
    final name = (trip['driver_name'] as String?)?.trim() ?? '';
    if (phone.isEmpty && name.isEmpty) continue;

    // Use phone as key if available, otherwise name
    final key = phone.isNotEmpty ? phone : name;
    if (!driverMap.containsKey(key)) {
      driverMap[key] = {
        'driver_name': name.isNotEmpty ? name : 'Unknown Driver',
        'driver_phone': phone,
        'driver_license': trip['driver_license'] ?? '',
        'vehicle_registration': trip['vehicle_registration'] ?? '',
        'trip_count': 0,
        'statuses': <String>{},
      };
    }
    final d = driverMap[key]!;
    d['trip_count'] = (d['trip_count'] as int) + 1;
    final statuses = d['statuses'] as Set<String>;
    if (trip['status'] != null) statuses.add(trip['status'].toString());

    // Keep most recent license / vehicle info
    if ((trip['driver_license'] as String?)?.isNotEmpty == true) {
      d['driver_license'] = trip['driver_license'];
    }
    if ((trip['vehicle_registration'] as String?)?.isNotEmpty == true) {
      d['vehicle_registration'] = trip['vehicle_registration'];
    }
  }

  final result = driverMap.values.map((d) {
    final statuses = d['statuses'] as Set<String>;
    d['status_summary'] = statuses.join(', ');
    d.remove('statuses');
    return d;
  }).toList();

  // Sort by trip count descending, then name
  result.sort((a, b) {
    final cmp =
        (b['trip_count'] as int).compareTo(a['trip_count'] as int);
    if (cmp != 0) return cmp;
    return (a['driver_name'] as String)
        .compareTo(b['driver_name'] as String);
  });
  return result;
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class FleetMarketDriversScreen extends ConsumerWidget {
  const FleetMarketDriversScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driversAsync = ref.watch(marketDriversProvider);
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
          'Market Drivers',
          style: KTTextStyles.h3.copyWith(
            color: KTColors.textHeading,
            decoration: TextDecoration.none,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            color: KTColors.textMuted,
            onPressed: () => ref.invalidate(marketDriversProvider),
          ),
        ],
      ),
      body: driversAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: KTColors.fleetAccent)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 40),
              const SizedBox(height: 10),
              Text(
                'Failed to load market drivers',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none,
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(marketDriversProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (drivers) {
          if (drivers.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person_off_outlined,
                    size: 56,
                    color: KTColors.textMuted.withValues(alpha: 0.35),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'No Market Drivers',
                    style: KTTextStyles.h3.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Drivers will appear once market trips are created.',
                    textAlign: TextAlign.center,
                    style: KTTextStyles.bodySmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ],
              ),
            );
          }

          final totalTrips = drivers.fold<int>(
              0, (sum, d) => sum + (d['trip_count'] as int));

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
                        'Drivers', '${drivers.length}', KTColors.success),
                    const SizedBox(width: 8),
                    _StatChip(
                        'Total Trips', '$totalTrips', KTColors.warning),
                  ],
                ),
              ),
              // ── Driver list ───────────────────────────────────────────
              Expanded(
                child: RefreshIndicator(
                  color: KTColors.fleetAccent,
                  onRefresh: () async =>
                      ref.invalidate(marketDriversProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: drivers.length,
                    itemBuilder: (context, i) =>
                        _DriverCard(driver: drivers[i]),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

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
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: KTTextStyles.body.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: KTTextStyles.caption.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}

class _DriverCard extends StatelessWidget {
  final Map<String, dynamic> driver;
  const _DriverCard({required this.driver});

  @override
  Widget build(BuildContext context) {
    final name = driver['driver_name'] as String? ?? 'Unknown Driver';
    final phone = driver['driver_phone'] as String? ?? '';
    final license = driver['driver_license'] as String? ?? '';
    final vehicle = driver['vehicle_registration'] as String? ?? '';
    final tripCount = driver['trip_count'] as int? ?? 0;

    final initials = name
        .split(' ')
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          // ── Avatar ───────────────────────────────────────────────
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: KTColors.success.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials.isNotEmpty ? initials : '?',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.success,
                  fontWeight: FontWeight.w700,
                  decoration: TextDecoration.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // ── Details ──────────────────────────────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.none,
                  ),
                ),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(Icons.phone_outlined,
                          size: 12, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        phone,
                        style: KTTextStyles.caption.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ],
                  ),
                ],
                if (license.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.credit_card_outlined,
                          size: 12, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        license,
                        style: KTTextStyles.caption.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ],
                  ),
                ],
                if (vehicle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.directions_car_outlined,
                          size: 12, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        vehicle,
                        style: KTTextStyles.caption.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // ── Trip count badge ─────────────────────────────────────
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: KTColors.fleetAccent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: KTColors.fleetAccent.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '$tripCount trip${tripCount == 1 ? '' : 's'}',
                  style: KTTextStyles.caption.copyWith(
                    color: KTColors.fleetAccent,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
