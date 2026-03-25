import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final branchTripsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, date) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/trips/');
    final payload = res['data'] ?? res;
    final List<dynamic> rawList = payload is List ? payload : [];
    final allTrips = rawList.cast<Map<String, dynamic>>();
    if (date == 'this_week') {
      return allTrips;
    }
    // 'today' — filter client-side by scheduled_date
    final todayStr = DateTime.now().toIso8601String().split('T').first;
    return allTrips
        .where((t) => (t['scheduled_date'] as String? ?? '').startsWith(todayStr))
        .toList();
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class BranchTripsScreen extends ConsumerStatefulWidget {
  const BranchTripsScreen({super.key});

  @override
  ConsumerState<BranchTripsScreen> createState() => _BranchTripsScreenState();
}

class _BranchTripsScreenState extends ConsumerState<BranchTripsScreen> {
  String _dateFilter = 'today';
  static const _dateOptions = ['today', 'this_week'];
  static const _dateLabels = ['Today', 'This Week'];

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(branchTripsProvider(_dateFilter));

    return Column(
      children: [
        // ─── Date filter ─────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Row(
            children: List.generate(_dateOptions.length, (i) {
              final opt = _dateOptions[i];
              final label = _dateLabels[i];
              final selected = _dateFilter == opt;
              return Padding(
                padding: EdgeInsets.only(right: i < _dateOptions.length - 1 ? 8 : 0),
                child: GestureDetector(
                  onTap: () => setState(() => _dateFilter = opt),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? KTColors.navy700 : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: selected ? KTColors.amber500 : KTColors.navy700),
                    ),
                    child: Text(
                      label,
                      style: KTTextStyles.label.copyWith(
                        color: selected ? KTColors.amber500 : KTColors.darkTextSecondary,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        // ─── Trip List ────────────────────────────────────────────
        Expanded(
          child: tripsAsync.when(
            loading: () => ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: 5,
              itemBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KTLoadingShimmer(type: ShimmerType.card),
              ),
            ),
            error: (e, _) => Center(
              child: Text('Failed to load trips: $e',
                  style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            ),
            data: (trips) {
              if (trips.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.local_shipping_outlined, color: KTColors.darkTextSecondary, size: 56),
                      const SizedBox(height: 16),
                      Text('No Trips Found', style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                color: KTColors.amber500,
                onRefresh: () async => ref.invalidate(branchTripsProvider(_dateFilter)),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: trips.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _tripCard(trips[i]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _tripCard(Map<String, dynamic> trip) {
    final tripNo = trip['trip_number']?.toString() ?? '#${trip['id']}';
    final origin = trip['origin']?.toString() ?? '—';
    final dest = trip['destination']?.toString() ?? '—';
    final driver = '${trip['driver_first_name'] ?? ''} ${trip['driver_last_name'] ?? ''}'.trim();
    final vehicle = trip['vehicle_registration']?.toString() ?? '—';
    final status = trip['status']?.toString() ?? 'planned';
    final isDelayed = trip['is_delayed'] == true;

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'in_transit': statusColor = KTColors.info; statusLabel = 'In Transit'; break;
      case 'completed': statusColor = KTColors.success; statusLabel = 'Completed'; break;
      case 'cancelled': statusColor = KTColors.danger; statusLabel = 'Cancelled'; break;
      default: statusColor = KTColors.darkTextSecondary; statusLabel = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.navy800,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDelayed ? KTColors.amber500.withOpacity(0.5) : KTColors.navy700,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(tripNo, style: KTTextStyles.mono.copyWith(color: KTColors.amber500)),
              KTStatusBadge(label: statusLabel, color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text('$origin → $dest',
              style: KTTextStyles.body.copyWith(color: KTColors.darkTextPrimary),
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.person_outline, size: 13, color: KTColors.darkTextSecondary),
              const SizedBox(width: 4),
              Text(driver.isNotEmpty ? driver : '—',
                  style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
              const SizedBox(width: 12),
              const Icon(Icons.local_shipping_outlined, size: 13, color: KTColors.darkTextSecondary),
              const SizedBox(width: 4),
              Text(vehicle, style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}
