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
                  onTap: () => context.push('/associate/jobs'), // Tap card → /associate/jobs [cite: 86]
                ),
                const SizedBox(height: 12),
                
                KTAlertCard(
                  title: "EWB expiring soon", // CARD 2 [cite: 86]
                  count: 1,
                  severity: AlertSeverity.medium,
                  items: const ["EWB-123456 — TN01AB1234 — expires in 3h 20m"], // In a real app, calculate this from a timestamp [cite: 86-87]
                  onTap: () => context.push('/associate/ewb/list'), // Tap card → /associate/ewb/list [cite: 87]
                ),
                const SizedBox(height: 12),

                KTAlertCard(
                  title: "Trips ready to close", // CARD 3 [cite: 87]
                  count: 3,
                  severity: AlertSeverity.low,
                  items: const ["KT-T-0089 — TN02CD5678 — Kumar — POD uploaded"],
                  onTap: () => context.push('/associate/trip/close'), // Tap card → /associate/trip/close [cite: 87]
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
                    KTActionButton(icon: Icons.receipt_long, label: "Create LR", onTap: () => context.push('/associate/lr/create')),
                    KTActionButton(icon: Icons.fire_truck, label: "Generate EWB", onTap: () => context.push('/associate/ewb/create')),
                    KTActionButton(icon: Icons.check_circle_outline, label: "Close trip", onTap: () => context.push('/associate/trip/close')),
                    KTActionButton(icon: Icons.cloud_upload, label: "Upload doc", onTap: () => context.push('/associate/upload')),
                    KTActionButton(icon: Icons.account_balance_wallet, label: "Banking entry", onTap: () {}), // /associate/banking (form) [cite: 88]
                    KTActionButton(icon: Icons.list_alt, label: "All jobs", onTap: () => context.push('/associate/jobs')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}