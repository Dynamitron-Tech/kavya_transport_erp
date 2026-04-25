import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_alert_card.dart';
import '../../core/widgets/kt_action_button.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/associate_dashboard_provider.dart';
import '../../providers/auth_provider.dart';

class AssociateHomeScreen extends ConsumerStatefulWidget {
  const AssociateHomeScreen({super.key});

  @override
  ConsumerState<AssociateHomeScreen> createState() => _AssociateHomeScreenState();
}

class _AssociateHomeScreenState extends ConsumerState<AssociateHomeScreen> {
  Timer? _timer;
  
  @override
  void initState() {
    super.initState();
    // Live countdown timer (updates every minute) [cite: 87]
    _timer = Timer.periodic(const Duration(minutes: 1), (timer) {
      if (mounted) setState(() {}); 
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening"; // greeting changes by time of day [cite: 86]
  }

  @override
  Widget build(BuildContext context) {
    final dashboardState = ref.watch(associateDashboardProvider);
    final actionCenterState = ref.watch(paActionCenterProvider);
    final jobPipelineState = ref.watch(paJobPipelineProvider);
    final recentActivityState = ref.watch(paRecentActivityProvider);
    final userName = ref.watch(authProvider).user?.name ?? 'Associate';

    return Scaffold(
      appBar: AppBar(
        title: Text("${_getGreeting()}, $userName"), // [cite: 86]
        actions: [
          IconButton(
            icon: const Badge(child: Icon(Icons.notifications)),
            onPressed: () => context.push('/notifications'),
          )
        ],
      ),
      body: dashboardState.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.card), // [cite: 109-110]
        error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(associateDashboardProvider)), // [cite: 111-113]
        data: (data) => RefreshIndicator(
          color: KTColors.primary,
          onRefresh: () async => ref.invalidate(associateDashboardProvider), // [cite: 118]
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Section 1 — 3 urgent task cards [cite: 86]
                KTAlertCard(
                  title: "Jobs needing LR", // CARD 1 [cite: 86]
                  count: data['jobs_needing_lr_count'] ?? 2,
                  severity: (data['jobs_needing_lr_count'] ?? 2) > 0 ? AlertSeverity.high : AlertSeverity.low,
                  items: const ["KT-2026-0042 — Acme Corp (Chennai → Coimbatore)"],
                  onTap: () => context.push('/pa/jobs'), // → PA jobs list
                ),
                const SizedBox(height: 12),
                
                KTAlertCard(
                  title: "EWB expiring soon", // CARD 2 [cite: 86]
                  count: 1,
                  severity: AlertSeverity.medium,
                  items: const ["EWB-123456 — TN01AB1234 — expires in 3h 20m"], // In a real app, calculate this from a timestamp [cite: 86-87]
                  onTap: () => context.push('/pa/ewb'), // → PA EWB list
                ),
                const SizedBox(height: 12),

                KTAlertCard(
                  title: "Trips ready to close", // CARD 3 [cite: 87]
                  count: 3,
                  severity: AlertSeverity.low,
                  items: const ["KT-T-0089 — TN02CD5678 — Kumar — POD uploaded"],
                  onTap: () => context.push('/pa/jobs'), // → PA jobs to find trip
                ),
                const SizedBox(height: 24),

                // Section 2 — Today's stats (4 metric tiles in 2x2) [cite: 87]
                Text("Today's activity", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.5,
                  children: [
                    KTStatCard(title: "LRs created", value: "12", color: KTColors.info, icon: Icons.receipt), // [cite: 87-88]
                    KTStatCard(title: "EWBs generated", value: "8", color: KTColors.warning, icon: Icons.local_shipping), // [cite: 88]
                    KTStatCard(title: "Banking entries", value: "4", color: KTColors.success, icon: Icons.account_balance), // [cite: 88]
                    KTStatCard(title: "Docs to upload", value: "5", color: KTColors.danger, icon: Icons.upload_file), // [cite: 88]
                  ],
                ),
                const SizedBox(height: 24),

                // Section 3 — Quick action grid (3x2) [cite: 88]
                Text("Quick actions", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.0,
                  children: [
                    KTActionButton(icon: Icons.receipt_long, label: "Create LR", onTap: () => context.push('/pa/jobs')),
                    KTActionButton(icon: Icons.fire_truck, label: "Generate EWB", onTap: () => context.push('/pa/ewb')),
                    KTActionButton(icon: Icons.check_circle_outline, label: "Close trip", onTap: () => context.push('/pa/jobs')),
                    KTActionButton(icon: Icons.cloud_upload, label: "Upload doc", onTap: () => context.push('/pa/jobs')),
                    KTActionButton(icon: Icons.account_balance_wallet, label: "Banking entry", onTap: () => context.push('/pa/banking')),
                    KTActionButton(icon: Icons.list_alt, label: "All jobs", onTap: () => context.push('/pa/jobs')),
                  ],
                ),
                const SizedBox(height: 24),

                // Section 4 — Action Centre
                Text("Action centre", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                actionCenterState.when(
                  loading: () => const KTLoadingShimmer(type: ShimmerType.list),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (actions) => actions.isEmpty
                      ? Text('No pending actions', style: KTTextStyles.bodySmall)
                      : Column(
                          children: actions.map<Widget>((a) => Card(
                            child: ListTile(
                              title: Text(a['title']?.toString() ?? a['action_type']?.toString() ?? ''),
                              subtitle: Text(a['subtitle']?.toString() ?? a['entity']?.toString() ?? ''),
                              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                            ),
                          )).toList(),
                        ),
                ),
                const SizedBox(height: 24),

                // Section 5 — Job Pipeline
                Text("Job pipeline", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                jobPipelineState.when(
                  loading: () => const KTLoadingShimmer(type: ShimmerType.list),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (jobs) => jobs.isEmpty
                      ? Text('No active jobs', style: KTTextStyles.bodySmall)
                      : Column(
                          children: jobs.map<Widget>((j) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.local_shipping),
                              title: Text(j['job_number']?.toString() ?? j['id']?.toString() ?? ''),
                              subtitle: Text(j['status']?.toString() ?? ''),
                            ),
                          )).toList(),
                        ),
                ),
                const SizedBox(height: 24),

                // Section 6 — Recent Activity
                Text("Recent activity", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                recentActivityState.when(
                  loading: () => const KTLoadingShimmer(type: ShimmerType.list),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (items) => items.isEmpty
                      ? Text('No recent activity', style: KTTextStyles.bodySmall)
                      : Column(
                          children: items.take(5).map<Widget>((item) => ListTile(
                            leading: Icon(Icons.history, color: KTColors.primary),
                            title: Text(item['description']?.toString() ?? item['action']?.toString() ?? ''),
                            subtitle: Text(item['created_at']?.toString() ?? ''),
                          )).toList(),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}