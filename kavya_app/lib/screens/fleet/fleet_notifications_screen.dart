import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/services/fcm_service.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ─────────────────────────────────────────────────────────────────

final _fleetSosAlertsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fleet/sos-alerts?limit=30');
  final data = (res is Map) ? res['data'] : res;
  if (data is List) return data.cast<Map<String, dynamic>>();
  return [];
});

final _tankLowAlertsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/my-notifications', queryParameters: {
    'event_type': 'TANK_LOW_LEVEL',
    'limit': 50,
  });
  final data = (res is Map) ? res['data'] : res;
  if (data is List) return data.cast<Map<String, dynamic>>();
  return [];
});

/// Badge count for the fleet AppBar bell icon.
final fleetNotificationCountProvider =
    FutureProvider.autoDispose<int>((ref) async {
  final sos = await ref.watch(_fleetSosAlertsProvider.future);
  final tanks = await ref.watch(_tankLowAlertsProvider.future);
  return sos.length + tanks.where((n) => n['is_read'] == false).length;
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class FleetNotificationsScreen extends ConsumerWidget {
  const FleetNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sosAsync = ref.watch(_fleetSosAlertsProvider);
    final tankAsync = ref.watch(_tankLowAlertsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(color: KTColors.textHeading),
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 17,
            color: KTColors.textHeading,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded, color: KTColors.textHeading),
            onPressed: () {
              ref.invalidate(_fleetSosAlertsProvider);
              ref.invalidate(_tankLowAlertsProvider);
              ref.read(unreadNotificationCountProvider.notifier).state = 0;
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_fleetSosAlertsProvider);
          ref.invalidate(_tankLowAlertsProvider);
          ref.read(unreadNotificationCountProvider.notifier).state = 0;
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            // ── SOS Emergency Alerts ─────────────────────────────────────
            _SectionHeader(
              icon: Icons.emergency_rounded,
              label: 'SOS Emergency Alerts',
              color: KTColors.danger,
              asyncValue: sosAsync,
            ),
            const SizedBox(height: 8),
            sosAsync.when(
              loading: () => const _LoadingShimmer(count: 3),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (alerts) {
                if (alerts.isEmpty) {
                  return const _EmptyTile(
                    message: 'No SOS alerts. All drivers are safe.',
                    icon: Icons.check_circle_outline,
                    color: KTColors.success,
                  );
                }
                return Column(
                  children: alerts.map((a) => _SosAlertCard(alert: a)).toList(),
                );
              },
            ),

            // ── Tank Low Level Alerts ─────────────────────────────────────
            const SizedBox(height: 20),
            _SectionHeader(
              icon: Icons.local_gas_station_rounded,
              label: 'Tank Low Level Alerts',
              color: KTColors.warning,
              asyncValue: tankAsync,
              countFn: (list) => list
                  .where((n) => (n)['is_read'] == false)
                  .length,
            ),
            const SizedBox(height: 8),
            tankAsync.when(
              loading: () => const _LoadingShimmer(count: 2),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (alerts) {
                if (alerts.isEmpty) {
                  return const _EmptyTile(
                    message: 'All tanks are sufficiently stocked.',
                    icon: Icons.water_drop_outlined,
                    color: KTColors.success,
                  );
                }
                return Column(
                  children: alerts
                      .map((a) => _TankLowAlertCard(alert: a))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader<T> extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final AsyncValue<List<T>> asyncValue;
  final int Function(List<T>)? countFn;

  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.color,
    required this.asyncValue,
    this.countFn,
  });

  @override
  Widget build(BuildContext context) {
    final items = asyncValue.valueOrNull ?? [];
    final count = countFn != null ? countFn!(items) : items.length;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: KTTextStyles.label.copyWith(
              color: KTColors.textHeading,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (count > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── SOS Alert Card ────────────────────────────────────────────────────────────

class _SosAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  const _SosAlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final driverName = alert['driver_name'] ?? 'Unknown';
    final tripNumber = alert['trip_number'] ?? 'N/A';
    final origin = alert['origin'] ?? '';
    final destination = alert['destination'] ?? '';
    final vehicleReg = alert['vehicle_registration'] ?? '';
    final locationName = alert['location_name'] ?? '';
    final ecName = alert['emergency_contact_name'];
    final ecPhone = alert['emergency_contact_phone'];
    final triggeredAt = alert['triggered_at'];

    String timeAgo = '';
    if (triggeredAt != null) {
      try {
        final dt = DateTime.parse(triggeredAt).toLocal();
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 60) {
          timeAgo = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          timeAgo = '${diff.inHours}h ago';
        } else {
          timeAgo = '${diff.inDays}d ago';
        }
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.danger.withValues(alpha: 0.4), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: KTColors.danger.withValues(alpha: 0.08),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: KTColors.danger.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.emergency_rounded,
                      color: KTColors.danger, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SOS — $driverName',
                        style: KTTextStyles.label.copyWith(
                          color: KTColors.danger,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'Trip $tripNumber',
                        style: KTTextStyles.labelSmall
                            .copyWith(color: KTColors.textMuted),
                      ),
                    ],
                  ),
                ),
                if (timeAgo.isNotEmpty)
                  Text(
                    timeAgo,
                    style: KTTextStyles.labelSmall
                        .copyWith(color: KTColors.textMuted),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            // Emergency message banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: KTColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'Driver $driverName in trip $tripNumber is in Emergency!',
                style: KTTextStyles.labelSmall.copyWith(
                  color: KTColors.danger,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Details
            if (origin.isNotEmpty || destination.isNotEmpty)
              _infoRow(Icons.route_outlined, 'Route',
                  '$origin → $destination'),
            if (vehicleReg.isNotEmpty)
              _infoRow(Icons.directions_car_outlined, 'Vehicle', vehicleReg),
            if (locationName.isNotEmpty)
              _infoRow(Icons.location_on_outlined, 'Location', locationName),
            if (ecName != null && ecName.toString().isNotEmpty)
              _infoRow(Icons.phone_in_talk_outlined, 'Emergency Contact',
                  '$ecName: $ecPhone'),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 13, color: KTColors.textMuted),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: KTTextStyles.labelSmall
                .copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600),
          ),
          Expanded(
            child: Text(
              value,
              style: KTTextStyles.labelSmall.copyWith(color: KTColors.textHeading),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tank Low Alert Card ───────────────────────────────────────────────────────

class _TankLowAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  const _TankLowAlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final data = alert['data'] as Map<String, dynamic>? ?? {};
    final tankName = data['tank_name'] as String? ?? alert['title'] as String? ?? 'Unknown Tank';
    final branchName = data['branch_name'] as String?;
    final currentStock = data['current_stock_litres'];
    final capacity = data['capacity_litres'];
    final createdAt = alert['created_at'] as String?;
    final isRead = alert['is_read'] as bool? ?? true;

    String timeAgo = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 60) {
          timeAgo = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          timeAgo = '${diff.inHours}h ago';
        } else {
          timeAgo = '${diff.inDays}d ago';
        }
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: KTColors.warning.withValues(alpha: 0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: KTColors.warning.withValues(alpha: 0.08),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: KTColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.local_gas_station_rounded,
                      color: KTColors.warning, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$tankName is Low',
                        style: KTTextStyles.label.copyWith(
                          color: KTColors.warning,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (branchName != null)
                        Text(
                          branchName,
                          style: KTTextStyles.labelSmall
                              .copyWith(color: KTColors.textMuted),
                        ),
                      if (currentStock != null && capacity != null)
                        Text(
                          '${currentStock.toStringAsFixed(0)}L / ${capacity.toStringAsFixed(0)}L remaining',
                          style: KTTextStyles.labelSmall
                              .copyWith(color: KTColors.textMuted),
                        ),
                    ],
                  ),
                ),
                Row(
                  children: [
                    if (!isRead)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(right: 6),
                        decoration: const BoxDecoration(
                          color: KTColors.warning,
                          shape: BoxShape.circle,
                        ),
                      ),
                    if (timeAgo.isNotEmpty)
                      Text(
                        timeAgo,
                        style: KTTextStyles.labelSmall
                            .copyWith(color: KTColors.textMuted),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Alert banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: KTColors.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                branchName != null
                    ? '$tankName of the Branch: $branchName is low. Please Initiate Refill!'
                    : '$tankName is low. Please Initiate Refill!',
                style: KTTextStyles.labelSmall.copyWith(
                  color: KTColors.warning,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Loading Shimmer ───────────────────────────────────────────────────────────

class _LoadingShimmer extends StatelessWidget {
  final int count;
  const _LoadingShimmer({required this.count});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 90,
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

// ─── Error Tile ────────────────────────────────────────────────────────────────

class _ErrorTile extends StatelessWidget {
  final String message;
  const _ErrorTile({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.danger.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: KTColors.danger, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: KTTextStyles.labelSmall.copyWith(color: KTColors.danger),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty Tile ────────────────────────────────────────────────────────────────

class _EmptyTile extends StatelessWidget {
  final String message;
  final IconData icon;
  final Color color;
  const _EmptyTile({
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.color = KTColors.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style:
                  KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
