import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/notification_bell_widget.dart';
import '../../providers/auth_provider.dart';
import 'pa_providers.dart';

const _kPaAccent = KTColors.paAccent;

class PADashboardScreen extends ConsumerStatefulWidget {
  const PADashboardScreen({super.key});

  @override
  ConsumerState<PADashboardScreen> createState() => _PADashboardScreenState();
}

class _PADashboardScreenState extends ConsumerState<PADashboardScreen> {
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _countdownTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(paDashboardStatsProvider);
    final actionsAsync = ref.watch(paPriorityActionsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: RefreshIndicator(
        color: _kPaAccent,
        backgroundColor: KTColors.surface,
        onRefresh: () async {
          ref.invalidate(paDashboardStatsProvider);
          ref.invalidate(paPriorityActionsProvider);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── Collapsible header ──────────────────────────────────────
            SliverAppBar(
              expandedHeight: 130,
              pinned: true,
              backgroundColor: KTColors.surface,
              surfaceTintColor: Colors.transparent,
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.pin,
                background: _PAHeaderBanner(),
              ),
              actions: [
                const NotificationBellWidget(),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: KTColors.textMuted),
                  color: KTColors.surface,
                  onSelected: (v) {
                    if (v == 'logout') ref.read(authProvider.notifier).logout();
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'logout',
                      child: Row(children: [
                        const Icon(Icons.logout, color: KTColors.danger, size: 18),
                        const SizedBox(width: 10),
                        Text('Logout',
                            style: KTTextStyles.body.copyWith(color: KTColors.danger)),
                      ]),
                    ),
                  ],
                ),
              ],
            ),

            // ── KPI Horizontal Scroll ───────────────────────────────────
            SliverToBoxAdapter(
              child: statsAsync.when(
                loading: () => const SizedBox(
                    height: 130,
                    child: KTLoadingShimmer(type: ShimmerType.card)),
                error: (e, _) => KTErrorState(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(paDashboardStatsProvider)),
                data: (stats) => _KPIScrollRow(stats: stats),
              ),
            ),

            // ── EWB Urgent Banner ───────────────────────────────────────
            SliverToBoxAdapter(
              child: statsAsync.maybeWhen(
                data: (stats) {
                  final ewbExpiring = stats['ewb_expiring'] ?? 0;
                  if (ewbExpiring == 0) return const SizedBox.shrink();
                  final h = (stats['hours_until_expiry'] as num?)?.toInt() ?? 0;
                  return GestureDetector(
                    onTap: () => context.go('/pa/ewb'),
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                      padding:
                          const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: KTColors.danger.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: KTColors.danger),
                      ),
                      child: Row(children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: KTColors.danger, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '$ewbExpiring EWB${ewbExpiring > 1 ? 's' : ''} '
                            'expiring ${h > 0 ? 'in ${h}h' : 'soon'} — action needed',
                            style: KTTextStyles.bodySmall
                                .copyWith(color: KTColors.danger),
                          ),
                        ),
                        const Icon(Icons.chevron_right,
                            color: KTColors.danger, size: 18),
                      ]),
                    ),
                  );
                },
                orElse: () => const SizedBox.shrink(),
              ),
            ),

            // ── Priority Actions header ─────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: Row(children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: _kPaAccent,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('Priority Actions',
                      style: KTTextStyles.h3
                          .copyWith(color: KTColors.textHeading)),
                ]),
              ),
            ),

            // ── Priority Actions list ───────────────────────────────────
            actionsAsync.when(
              loading: () => const SliverToBoxAdapter(
                  child: KTLoadingShimmer(type: ShimmerType.list)),
              error: (e, _) => SliverToBoxAdapter(
                child: KTErrorState(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(paPriorityActionsProvider)),
              ),
              data: (actions) {
                if (actions.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Column(children: [
                          Icon(Icons.check_circle_outline,
                              size: 52,
                              color: KTColors.success.withValues(alpha: 0.55)),
                          const SizedBox(height: 12),
                          Text('All caught up!',
                              style: KTTextStyles.body
                                  .copyWith(color: KTColors.textMuted)),
                        ]),
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: actions.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 0),
                    itemBuilder: (context, i) {
                      final a = Map<String, dynamic>.from(actions[i] as Map);
                      return _TimelineActionCard(
                          action: a, isLast: i == actions.length - 1);
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header Banner ─────────────────────────────────────────────────────────────

class _PAHeaderBanner extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec'
    ];
    final weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    final dateStr =
        '${weekdays[now.weekday - 1]} ${now.day} ${months[now.month - 1]} ${now.year}';

    final user = ref.watch(authProvider).user;
    final firstName = (user?.name ?? '').split(' ').first;
    final greeting = firstName.isNotEmpty ? 'Welcome, $firstName 👋' : 'Welcome 👋';

    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        border: Border(
          bottom: BorderSide(color: _kPaAccent.withValues(alpha: 0.4), width: 1.5),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 52, 16, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(greeting,
                    style: KTTextStyles.bodySmall.copyWith(
                        color: KTColors.textMuted,
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Row(children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                        color: _kPaAccent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text('PROJECT ASSOCIATE',
                      style: KTTextStyles.caption.copyWith(
                          color: _kPaAccent,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8)),
                ]),
                const SizedBox(height: 4),
                Text('Operations Hub',
                    style: KTTextStyles.h1
                        .copyWith(color: KTColors.textHeading)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(dateStr,
                  style: KTTextStyles.caption
                      .copyWith(color: KTColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── KPI Scroll Row ────────────────────────────────────────────────────────────

class _KPIScrollRow extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _KPIScrollRow({required this.stats});

  @override
  Widget build(BuildContext context) {
    final kpis = [
      (
        '${stats['jobs_awaiting_lr'] ?? 0}',
        'Jobs\nAwaiting LR',
        KTColors.warning,
        Icons.work_outline,
        () => context.go('/pa/jobs'),
      ),
      (
        '${stats['ewb_expiring'] ?? 0}',
        'EWB\nExpiring',
        KTColors.danger,
        Icons.timer_outlined,
        () => context.go('/pa/ewb'),
      ),
      (
        '${stats['trips_in_transit'] ?? 0}',
        'Trips\nIn Transit',
        KTColors.info,
        Icons.local_shipping_outlined,
        null,
      ),
      (
        '${stats['pods_pending'] ?? 0}',
        'PODs\nPending',
        KTColors.success,
        Icons.inventory_2_outlined,
        null,
      ),
    ];

    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        itemCount: kpis.length,
        itemBuilder: (context, i) {
          final k = kpis[i];
          return GestureDetector(
            onTap: k.$5 as VoidCallback?,
            child: Container(
              width: 118,
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: (k.$3 as Color).withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(k.$4 as IconData, color: k.$3 as Color, size: 20),
                  const Spacer(),
                  Text(
                    k.$1 as String,
                    style: KTTextStyles.kpiNumber.copyWith(
                        color: KTColors.textHeading, fontSize: 26),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    k.$2 as String,
                    style: KTTextStyles.caption.copyWith(color: k.$3 as Color),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Timeline Action Card ──────────────────────────────────────────────────────

class _TimelineActionCard extends StatelessWidget {
  final Map<String, dynamic> action;
  final bool isLast;
  const _TimelineActionCard({required this.action, required this.isLast});

  String _statusLabel(String s) {
    switch (s) {
      case 'POD_UPLOADED': return 'POD Uploaded';
      case 'EWB_EXPIRING': return 'EWB Expiring';
      case 'VEHICLE_ASSIGNED': return 'Vehicle Assigned';
      case 'LR_CREATED': return 'LR Created';
      default: return s;
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'POD_UPLOADED': return KTColors.success;
      case 'EWB_EXPIRING': return KTColors.danger;
      case 'VEHICLE_ASSIGNED': return KTColors.warning;
      default: return KTColors.info;
    }
  }

  void _navigate(BuildContext context) {
    final jobId = action['job_id'];
    final tripId = action['trip_id'];
    final ewbId = action['ewb_id'];
    final status = action['status'] as String?;
    if (status == 'EWB_EXPIRING' && ewbId != null) {
      context.push('/pa/ewb/$ewbId');
    } else if (status == 'POD_UPLOADED' && tripId != null) {
      context.push('/pa/trips/$tripId/close');
    } else if (jobId != null) {
      context.push('/pa/jobs/$jobId');
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = (action['status'] as String?) ?? '';
    final color = _statusColor(status);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline rail
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: color.withValues(alpha: 0.45), blurRadius: 5)
                    ],
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                        width: 1.5,
                        color: KTColors.borderColor),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Card
          Expanded(
            child: GestureDetector(
              onTap: () => _navigate(context),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                _statusLabel(status),
                                style: TextStyle(
                                    color: color,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                action['job_number'] ?? '',
                                style: KTTextStyles.bodySmall.copyWith(
                                    color: KTColors.textMuted),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ]),
                          const SizedBox(height: 5),
                          Text(
                            action['client_name'] ?? action['lr_number'] ?? '',
                            style: KTTextStyles.body.copyWith(
                                color: KTColors.textHeading,
                                fontWeight: FontWeight.w600),
                          ),
                          if ((action['origin'] as String?)?.isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                '${action['origin']} → ${action['destination'] ?? ''}',
                                style: KTTextStyles.caption.copyWith(
                                    color: KTColors.textMuted),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        color: KTColors.textMuted, size: 18),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}


