import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../core/widgets/notification_bell_widget.dart';
import '../../../providers/auth_provider.dart';
import '../providers/manager_providers.dart';
import '../widgets/job_card_widget.dart';

class ManagerDashboardScreen extends ConsumerWidget {
  const ManagerDashboardScreen({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(managerDashboardStatsProvider);
    final sparkAsync = ref.watch(managerSparklineProvider);
    final jobsAsync = ref.watch(managerUnassignedJobsProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${_greeting()}, ${user?.name ?? 'Manager'}',
                style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.approval, color: KTColors.textMuted),
            onPressed: () => context.push('/manager/approvals'),
          ),
          const NotificationBellWidget(),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: KTColors.textMuted),
            color: KTColors.surface,
            onSelected: (v) { if (v == 'logout') ref.read(authProvider.notifier).logout(); },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'logout', child: Row(children: [
                const Icon(Icons.logout, color: KTColors.danger, size: 18),
                const SizedBox(width: 10),
                Text('Logout', style: KTTextStyles.body.copyWith(color: KTColors.danger)),
              ])),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        color: KTColors.managerAccent,
        backgroundColor: KTColors.surface,
        onRefresh: () async {
          ref.invalidate(managerDashboardStatsProvider);
          ref.invalidate(managerSparklineProvider);
          ref.invalidate(managerUnassignedJobsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // ── KPI Grid ───────────────────────────────
            statsAsync.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerDashboardStatsProvider)),
              data: (stats) => _KPIGrid(stats: stats),
            ),
            const SizedBox(height: 16),

            // ── Service alert ──────────────────────────
            statsAsync.whenData((stats) {
              final count = stats['overdue_service_count'] ?? 0;
              if (count > 0) {
                return Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: KTColors.managerAccentBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.managerAccent.withOpacity(0.4)),
                  ),
                  child: InkWell(
                    onTap: () => context.go('/manager/fleet'),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber, color: KTColors.warning, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${stats['overdue_service_vehicle'] ?? 'Vehicle'} overdue service',
                            style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: KTColors.managerAccent.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('Alert', style: TextStyle(color: KTColors.managerAccent, fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            }).value ?? const SizedBox.shrink(),

            // ── Sparkline ──────────────────────────────
            Text("TODAY'S OPERATIONS", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(height: 12),
            sparkAsync.when(
              loading: () => const SizedBox(height: 100, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
              error: (e, _) => const SizedBox.shrink(),
              data: (spark) => _SparklineChart(data: spark),
            ),
            const SizedBox(height: 20),

            // ── Unassigned Jobs ────────────────────────
            Text("JOBS NEEDING ASSIGNMENT", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(height: 12),
            jobsAsync.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list),
              error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerUnassignedJobsProvider)),
              data: (jobs) {
                if (jobs.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(24),
                    alignment: Alignment.center,
                    child: Column(
                      children: [
                        const Icon(Icons.check_circle_outline, color: KTColors.success, size: 40),
                        const SizedBox(height: 8),
                        Text('All jobs assigned — great work!', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }
                return Column(
                  children: jobs.map((j) => JobCardWidget(job: Map<String, dynamic>.from(j as Map), useLightTheme: true)).toList(),
                );
              },
            ),
            const SizedBox(height: 16),

            // ── Live Map button ───────────────────────
            GestureDetector(
              onTap: () => context.push('/fleet/map'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF0EA5E9), width: 1),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0EA5E9).withAlpha(26),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.location_on_rounded, color: Color(0xFF0EA5E9), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Text('Live Vehicle Tracking', style: KTTextStyles.body.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    const Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
                  ],
                ),
              ),
            ),

            // ── Create new job button ──────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/manager/jobs/create'),
                icon: const Icon(Icons.add),
                label: const Text('Create new job'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.managerAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _KPIGrid extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _KPIGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 2.0,
      children: [
        _KPICard(
          value: '${stats['active_trips'] ?? 0}',
          label: 'Active trips',
          borderColor: KTColors.info,
          onTap: () => context.go('/manager/fleet'),
        ),
        _KPICard(
          value: '${stats['pending_assignment'] ?? 0}',
          label: 'Pending assignment',
          borderColor: KTColors.managerAccent,
          onTap: () => context.go('/manager/jobs'),
        ),
        _KPICard(
          value: '₹${_fmtRev(stats['monthly_revenue'])}',
          label: 'This month revenue',
          borderColor: KTColors.success,
          onTap: () => context.go('/manager/reports'),
        ),
        _KPICard(
          value: '${stats['approvals_needed'] ?? 0}',
          label: 'Approvals needed',
          borderColor: KTColors.danger,
          onTap: () => context.push('/manager/approvals'),
        ),
      ],
    );
  }

  String _fmtRev(dynamic val) {
    final n = (val is num) ? val.toDouble() : 0.0;
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(0)}K';
    return n.toStringAsFixed(0);
  }
}

class _KPICard extends StatelessWidget {
  final String value;
  final String label;
  final Color borderColor;
  final VoidCallback onTap;
  const _KPICard({required this.value, required this.label, required this.borderColor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: borderColor),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(value, style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                      const SizedBox(height: 4),
                      Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SparklineChart extends StatelessWidget {
  final Map<String, dynamic> data;
  const _SparklineChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final days = (data['days'] as List<dynamic>?) ?? [];
    final pct = data['pct_change'] ?? 0;
    if (days.isEmpty) return const SizedBox.shrink();

    final maxAmount = days.fold<double>(1, (m, d) {
      final a = (d['amount'] as num?)?.toDouble() ?? 0;
      return a > m ? a : m;
    });

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text('Weekly revenue trend', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
              const Spacer(),
              Text(
                '${pct >= 0 ? '+' : ''}$pct% vs last week',
                style: TextStyle(
                  color: pct >= 0 ? KTColors.success : KTColors.danger,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 80,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: days.map((d) {
                final amount = (d['amount'] as num?)?.toDouble() ?? 0;
                final isToday = d['is_today'] == true;
                final heightFrac = maxAmount > 0 ? amount / maxAmount : 0.0;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: 50 * heightFrac + 4,
                          decoration: BoxDecoration(
                            color: isToday ? KTColors.managerAccent : KTColors.info,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          d['day'] ?? '',
                          style: TextStyle(
                            color: isToday ? KTColors.managerAccent : KTColors.textMuted,
                            fontSize: 10,
                            fontWeight: isToday ? FontWeight.w700 : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
