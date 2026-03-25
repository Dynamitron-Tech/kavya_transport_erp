import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/auth_provider.dart';
import '../../providers/fleet_dashboard_provider.dart';

final fleetHomeStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/fleet/dashboard');
  // Backend returns: { data: { fleet_summary: {...}, active_trips: [...], ... } }
  final payload = response['data'] ?? response;
  if (payload is Map<String, dynamic>) {
    final summary = (payload['fleet_summary'] as Map<String, dynamic>?) ?? {};
    if (summary.isNotEmpty) return summary;
    return payload;
  }
  return {};
});

class FleetHomeScreen extends ConsumerWidget {
  const FleetHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final statsAsync = ref.watch(fleetHomeStatsProvider);
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Fleet Dashboard',
              style: KTTextStyles.h3.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none,
              ),
            ),
            Text(
              user?.fullName != null
                  ? 'Welcome back, ${user!.fullName}'
                  : 'Manage vehicles & operations',
              style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: KTColors.textHeading),
            color: KTColors.surface,
            elevation: 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: KTColors.borderColor),
            ),
            onSelected: (value) {
              if (value == 'profile') {
                context.push('/fleet/profile');
              } else if (value == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    const Icon(Icons.person_outline_rounded,
                        color: KTColors.textMuted, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'My Profile',
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 1),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    const Icon(Icons.logout_rounded,
                        color: KTColors.danger, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.danger,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: DefaultTextStyle(
        style: const TextStyle(decoration: TextDecoration.none),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Section 1: Fleet Overview ───────────────────────────────
              _Section(
                title: 'Fleet Overview',
                icon: Icons.directions_car_outlined,
                child: statsAsync.when(
                  loading: () => const KTLoadingShimmer(type: ShimmerType.card),
                  error: (_, __) => GridView.count(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    shrinkWrap: true,
                    childAspectRatio: 1.55,
                    physics: const NeverScrollableScrollPhysics(),
                    children: const [
                      _StatTile('Total Vehicles', '--', Icons.directions_car_filled, KTColors.primary),
                      _StatTile('On Trip', '--', Icons.check_circle_outline, KTColors.success),
                      _StatTile('Maintenance Due', '--', Icons.build_circle_outlined, KTColors.warning),
                      _StatTile('Drivers on Duty', '--', Icons.people_alt_outlined, KTColors.info),
                    ],
                  ),
                  data: (data) => GridView.count(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    shrinkWrap: true,
                    childAspectRatio: 1.55,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _StatTile('Total Vehicles', '${data['total_vehicles'] ?? 0}',
                          Icons.directions_car_filled, KTColors.primary),
                      _StatTile('On Trip', '${data['on_trip'] ?? 0}',
                          Icons.check_circle_outline, KTColors.success),
                      _StatTile('Maintenance Due', '${data['maintenance'] ?? 0}',
                          Icons.build_circle_outlined, KTColors.warning),
                      _StatTile('Available', '${data['available'] ?? 0}',
                          Icons.people_alt_outlined, KTColors.info),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ─── Section 2: Trip Status ──────────────────────────────────
              _Section(
                title: 'Trip Status',
                icon: Icons.local_shipping_outlined,
                child: statsAsync.when(
                  loading: () => const KTLoadingShimmer(type: ShimmerType.card),
                  error: (_, __) => const Row(
                    children: [
                      Expanded(child: _TripTile('In Progress', '--', Icons.local_shipping, KTColors.warning)),
                      SizedBox(width: 10),
                      Expanded(child: _TripTile('Available', '--', Icons.check_circle, KTColors.success)),
                    ],
                  ),
                  data: (data) => Row(
                    children: [
                      Expanded(
                        child: _TripTile('In Progress', '${data['on_trip'] ?? 0}',
                            Icons.local_shipping, KTColors.warning),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _TripTile('Available', '${data['available'] ?? 0}',
                            Icons.check_circle, KTColors.success),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ─── Section 3: Quick Actions ────────────────────────────────
              _Section(
                title: 'Quick Actions',
                icon: Icons.grid_view_rounded,
                child: GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  shrinkWrap: true,
                  childAspectRatio: 1.4,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _ActionTile(
                      context: context,
                      label: 'Vehicles',
                      icon: Icons.directions_car_filled,
                      color: KTColors.primary,
                      onTap: () => context.push('/fleet/vehicles'),
                    ),
                    _ActionTile(
                      context: context,
                      label: 'Drivers',
                      icon: Icons.people_alt_rounded,
                      color: KTColors.success,
                      onTap: () => context.push('/fleet/drivers'),
                    ),
                    _ActionTile(
                      context: context,
                      label: 'Trips',
                      icon: Icons.route_rounded,
                      color: KTColors.info,
                      onTap: () => context.push('/fleet/trips'),
                    ),
                    _ActionTile(
                      context: context,
                      label: 'Analytics',
                      icon: Icons.analytics_rounded,
                      color: KTColors.warning,
                      onTap: () => context.push('/fleet/analytics'),
                    ),
                    _ActionTile(
                      context: context,
                      label: 'Live Map',
                      icon: Icons.location_on_rounded,
                      color: KTColors.success,
                      onTap: () => context.push('/fleet/map'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // ─── Section 4: Recent Activity ──────────────────────────────
              _Section(
                title: 'Recent Activity',
                icon: Icons.history_rounded,
                child: Column(
                  children: const [
                    _ActivityRow(
                      title: 'Vehicle Maintenance',
                      subtitle: 'MH-01-AB-1234 scheduled for service',
                      time: '2h ago',
                      icon: Icons.build_circle_rounded,
                      color: KTColors.warning,
                    ),
                    SizedBox(height: 10),
                    _ActivityRow(
                      title: 'Trip Completed',
                      subtitle: 'T-45821: Mumbai → Delhi completed',
                      time: '4h ago',
                      icon: Icons.check_circle_rounded,
                      color: KTColors.success,
                    ),
                    SizedBox(height: 10),
                    _ActivityRow(
                      title: 'Vehicle Assignment',
                      subtitle: 'Driver assigned to MH-01-AB-5678',
                      time: '6h ago',
                      icon: Icons.assignment_ind_rounded,
                      color: KTColors.primary,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Section Panel ─────────────────────────────────────────────────────────────
class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _Section({required this.title, required this.icon, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: KTColors.fleetAccent, size: 15),
              const SizedBox(width: 7),
              Text(
                title,
                style: KTTextStyles.h3.copyWith(
                  color: KTColors.textHeading,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(color: KTColors.borderColor, height: 1, thickness: 1),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────
class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatTile(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value,
                  style: KTTextStyles.h2.copyWith(
                    color: color,
                    height: 1.1,
                    decoration: TextDecoration.none,
                  ),
                ),
                Text(
                  label,
                  style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Trip Status Tile ──────────────────────────────────────────────────────────
class _TripTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _TripTile(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 15),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: KTTextStyles.h1.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Quick Action Tile ─────────────────────────────────────────────────────────
class _ActionTile extends StatelessWidget {
  final BuildContext context;
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    required this.context,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext ctx) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: KTTextStyles.label.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.none,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Activity Row ──────────────────────────────────────────────────────────────
class _ActivityRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final String time;
  final IconData icon;
  final Color color;

  const _ActivityRow({
    required this.title,
    required this.subtitle,
    required this.time,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: KTTextStyles.body.copyWith(
                  color: KTColors.textHeading,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.none,
                ),
              ),
              Text(
                subtitle,
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
        const SizedBox(width: 8),
        Text(
          time,
          style: KTTextStyles.labelSmall.copyWith(
            color: KTColors.textMuted,
            decoration: TextDecoration.none,
          ),
        ),
      ],
    );
  }
}
