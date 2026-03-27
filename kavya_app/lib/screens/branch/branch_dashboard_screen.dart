import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_alert_card.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final branchDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/dashboard/branch');
  return (res['data'] ?? res) as Map<String, dynamic>;
});

final branchActiveTripsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/trips/', queryParameters: {'limit': 5});
  final payload = res['data'] ?? res;
  final List<dynamic> rawList = payload is List ? payload : [];
  final todayStr = DateTime.now().toIso8601String().split('T').first;
  return rawList
      .cast<Map<String, dynamic>>()
      .where((t) => (t['scheduled_date'] as String? ?? '').startsWith(todayStr))
      .toList();
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class BranchDashboardScreen extends ConsumerWidget {
  const BranchDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(branchDashboardProvider);
    final tripsAsync = ref.watch(branchActiveTripsProvider);

    return RefreshIndicator(
      color: KTColors.amber500,
      onRefresh: () async {
        ref.invalidate(branchDashboardProvider);
        ref.invalidate(branchActiveTripsProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── KPI Cards ────────────────────────────────────────────
          dashAsync.when(
            loading: () => Column(
              children: List.generate(
                2,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: KTLoadingShimmer(type: ShimmerType.card),
                ),
              ),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (data) => Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: KTStatCard(
                        title: 'Active Trips',
                        value: '${data['active_trips'] ?? 0}',
                        color: KTColors.info,
                        icon: Icons.local_shipping,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: KTStatCard(
                        title: 'Drivers On Duty',
                        value: '${data['drivers_on_duty'] ?? 0}',
                        color: KTColors.success,
                        icon: Icons.person,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: KTStatCard(
                        title: 'Revenue Today',
                        value: '₹${((data['revenue_today_paise'] as num? ?? 0).toInt() / 100).toStringAsFixed(0)}',
                        color: KTColors.amber500,
                        icon: Icons.currency_rupee,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: KTStatCard(
                        title: 'Pending LRs',
                        value: '${data['pending_lrs'] ?? 0}',
                        color: KTColors.warning,
                        icon: Icons.receipt_long,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Today's Active Trips ─────────────────────────────────
          Text("Today's Active Trips", style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
          const SizedBox(height: 12),
          tripsAsync.when(
            loading: () => KTLoadingShimmer(type: ShimmerType.card),
            error: (_, __) => const SizedBox.shrink(),
            data: (trips) {
              if (trips.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: KTColors.navy800,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.navy700),
                  ),
                  child: Text('No active trips today.',
                      style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary)),
                );
              }
              return Column(
                children: trips.map((t) {
                  final tripNo = t['trip_number']?.toString() ?? '#${t['id']}';
                  final origin = t['origin']?.toString() ?? '—';
                  final dest = t['destination']?.toString() ?? '—';
                  final status = t['status']?.toString() ?? '—';
                  return GestureDetector(
                    onTap: () => context.push('/fleet/trips'),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: KTColors.navy800,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: KTColors.navy700),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.local_shipping, size: 18, color: KTColors.amber500),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(tripNo, style: KTTextStyles.mono.copyWith(color: KTColors.amber500)),
                                Text('$origin → $dest',
                                    style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary),
                                    overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: KTColors.info.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              status.replaceAll('_', ' ').toUpperCase(),
                              style: KTTextStyles.caption.copyWith(color: KTColors.info, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
          const SizedBox(height: 24),

          // ─── Alerts ───────────────────────────────────────────────
          dashAsync.maybeWhen(
            data: (data) {
              final alerts = (data['alerts'] as List?)?.cast<Map<String, dynamic>>() ?? [];
              if (alerts.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Alerts', style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
                  const SizedBox(height: 12),
                  ...alerts.map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: KTAlertCard(
                      title: a['title']?.toString() ?? 'Alert',
                      count: 1,
                      severity: AlertSeverity.medium,
                      items: [a['message']?.toString() ?? ''],
                      onTap: () {},
                    ),
                  )),
                ],
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
