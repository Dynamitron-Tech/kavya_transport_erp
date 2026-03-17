import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';

class FleetHomeScreen extends ConsumerWidget {
  const FleetHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: Connect to actual fleet providers
    final totalVehicles = 24;
    final activeVehicles = 18;
    final maintenancePending = 3;
    final driversOnDuty = 16;
    final tripsInProgress = 12;
    final tripsCompleted = 156;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Header
          Text(
            'Fleet Management',
            style: KTTextStyles.h1,
          ),
          const SizedBox(height: 4),
          const Text(
            'Manage vehicles, drivers, and operations',
            style: TextStyle(color: KTColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),

          // Key Metrics Grid
          const SectionHeader(title: 'Fleet Overview'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              KtStatCard(
                label: 'Total Vehicles',
                value: '$totalVehicles',
                icon: Icons.directions_car,
                color: KTColors.primary,
              ),
              KtStatCard(
                label: 'Active Today',
                value: '$activeVehicles',
                icon: Icons.check_circle,
                color: KTColors.success,
              ),
              KtStatCard(
                label: 'Maintenance Due',
                value: '$maintenancePending',
                icon: Icons.build,
                color: KTColors.warning,
              ),
              KtStatCard(
                label: 'Drivers on Duty',
                value: '$driversOnDuty',
                icon: Icons.person,
                color: KTColors.info,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Trips Status
          const SectionHeader(title: 'Trip Status'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: KTColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.warning.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.local_shipping,
                            color: KTColors.warning,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'In Progress',
                            style: TextStyle(
                              fontSize: 11,
                              color: KTColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$tripsInProgress',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: KTColors.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.success.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.check_circle,
                            color: KTColors.success,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Completed',
                            style: TextStyle(
                              fontSize: 11,
                              color: KTColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$tripsCompleted',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Quick Actions
          const SectionHeader(title: 'Quick Actions'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _quickActionCard(
                context,
                'Vehicles',
                Icons.directions_car_filled,
                KTColors.primary,
                () => context.push('/fleet/vehicles'),
              ),
              _quickActionCard(
                context,
                'Drivers',
                Icons.people_alt,
                KTColors.success,
                () => context.push('/fleet/drivers'),
              ),
              _quickActionCard(
                context,
                'Trips',
                Icons.route,
                KTColors.info,
                () => context.push('/fleet/trips'),
              ),
              _quickActionCard(
                context,
                'Analytics',
                Icons.analytics,
                KTColors.warning,
                () => context.push('/fleet/analytics'),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Recent Activity
          const SectionHeader(title: 'Recent Activity'),
          const SizedBox(height: 12),
          _activityItem(
            'Vehicle Maintenance',
            'MH-01-AB-1234 scheduled for service',
            Icons.build,
            KTColors.warning,
          ),
          const SizedBox(height: 8),
          _activityItem(
            'Trip Completed',
            'T-45821: Mumbai → Delhi completed',
            Icons.check_circle,
            KTColors.success,
          ),
          const SizedBox(height: 8),
          _activityItem(
            'Vehicle Assignment',
            'Driver assigned to vehicle MH-01-AB-5678',
            Icons.assignment,
            KTColors.primary,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _quickActionCard(
    BuildContext context,
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _activityItem(
    String title,
    String subtitle,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: KTColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
        ],
      ),
    );
  }
}
