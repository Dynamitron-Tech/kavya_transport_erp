import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final fleetAnalyticsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fleet/dashboard');
  final payload = res['data'] ?? res;
  return (payload is Map<String, dynamic>) ? payload : <String, dynamic>{};
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class FleetAnalyticsScreen extends ConsumerWidget {
  const FleetAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analyticsAsync = ref.watch(fleetAnalyticsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('Fleet Analytics',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: DefaultTextStyle(
        style: const TextStyle(decoration: TextDecoration.none),
        child: analyticsAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.fleetAccent),
          ),
          error: (e, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
                const SizedBox(height: 12),
                Text('Failed to load analytics',
                    style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(fleetAnalyticsProvider),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.fleetAccent,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (data) => _buildContent(context, ref, data),
        ),
      ),
    );
  }

  Widget _buildContent(
      BuildContext context, WidgetRef ref, Map<String, dynamic> data) {
    // Extract data with safe defaults — backend returns fleet_summary + active_trips
    final vehicleSummary =
        (data['fleet_summary'] as Map<String, dynamic>?) ?? {};
    final activeTrips =
        (data['active_trips'] as List?) ?? [];
    final totalVehicles = vehicleSummary['total_vehicles'] ?? 0;
    final availableVehicles = vehicleSummary['available'] ?? 0;
    final onTripVehicles = vehicleSummary['on_trip'] ?? 0;
    final maintenanceVehicles = vehicleSummary['maintenance'] ?? 0;
    final totalTrips = activeTrips.length;
    final activeTripsCount = activeTrips.where((t) {
      final s = (t is Map ? t['status']?.toString().toUpperCase() : '') ?? '';
      return s == 'STARTED' || s == 'IN_TRANSIT' || s == 'LOADING' || s == 'UNLOADING';
    }).length;
    final completedTrips = activeTrips.where((t) {
      final s = (t is Map ? t['status']?.toString().toUpperCase() : '') ?? '';
      return s == 'COMPLETED';
    }).length;

    final utilization = totalVehicles > 0
        ? ((onTripVehicles / totalVehicles) * 100).round()
        : 0;

    return RefreshIndicator(
      color: KTColors.fleetAccent,
      onRefresh: () async => ref.invalidate(fleetAnalyticsProvider),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Performance Metrics ─────────────────────────────
            _Section(
              icon: Icons.track_changes,
              title: 'Performance Metrics',
              child: GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.6,
                children: [
                  _MetricTile(
                      label: 'Total Vehicles',
                      value: '$totalVehicles',
                      color: KTColors.info),
                  _MetricTile(
                      label: 'Available',
                      value: '$availableVehicles',
                      color: KTColors.success),
                  _MetricTile(
                      label: 'On Trip',
                      value: '$onTripVehicles',
                      color: KTColors.fleetAccent),
                  _MetricTile(
                      label: 'Utilization',
                      value: '$utilization%',
                      color: KTColors.primary),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ─── Trip Summary ────────────────────────────────────
            _Section(
              icon: Icons.local_shipping_outlined,
              title: 'Trip Summary',
              child: GridView.count(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.2,
                children: [
                  _MetricTile(
                      label: 'Total',
                      value: '$totalTrips',
                      color: KTColors.info),
                  _MetricTile(
                      label: 'Active',
                      value: '$activeTripsCount',
                      color: KTColors.fleetAccent),
                  _MetricTile(
                      label: 'Completed',
                      value: '$completedTrips',
                      color: KTColors.success),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ─── Vehicle Utilization Chart ───────────────────────
            _Section(
              icon: Icons.bar_chart,
              title: 'Vehicle Status Breakdown',
              child: SizedBox(
                height: 200,
                child: BarChart(
                  _vehicleStatusBarData(
                    available: availableVehicles,
                    onTrip: onTripVehicles,
                    maintenance: maintenanceVehicles,
                    inactive: (vehicleSummary['inactive'] ?? 0) as int,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // ─── Fleet Status ────────────────────────────────────
            _Section(
              icon: Icons.directions_car,
              title: 'Maintenance',
              child: Column(
                children: [
                  _StatusRow(
                      'In Maintenance', '$maintenanceVehicles', KTColors.warning),
                  const SizedBox(height: 8),
                  _StatusRow('Breakdown',
                      '${vehicleSummary['breakdown'] ?? 0}', KTColors.danger),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  BarChartData _vehicleStatusBarData({
    required int available,
    required int onTrip,
    required int maintenance,
    required int inactive,
  }) {
    final labels = ['Available', 'On Trip', 'Maint.', 'Inactive'];
    final values = [
      available.toDouble(),
      onTrip.toDouble(),
      maintenance.toDouble(),
      inactive.toDouble(),
    ];
    final colors = [
      KTColors.success,
      KTColors.info,
      KTColors.warning,
      KTColors.danger,
    ];

    return BarChartData(
      barTouchData: BarTouchData(enabled: false),
      titlesData: FlTitlesData(
        show: true,
        rightTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (double value, TitleMeta meta) {
              final idx = value.toInt();
              if (idx < 0 || idx >= labels.length) {
                return const SizedBox.shrink();
              }
              return SideTitleWidget(
                meta: meta,
                child: Text(labels[idx],
                    style: const TextStyle(
                        fontSize: 10,
                        color: KTColors.textMuted)),
              );
            },
          ),
        ),
      ),
      barGroups: List.generate(values.length, (i) {
        return BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: values[i],
              color: colors[i],
              width: 28,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(4)),
            ),
          ],
        );
      }),
      borderData: FlBorderData(show: false),
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        horizontalInterval: 1,
        getDrawingHorizontalLine: (_) =>
            FlLine(color: KTColors.borderColor, strokeWidth: 1),
      ),
    );
  }
}

// ─── Private Widgets ────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  const _Section(
      {required this.icon, required this.title, required this.child});
  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
            child: Row(
              children: [
                Icon(icon, color: KTColors.fleetAccent, size: 18),
                const SizedBox(width: 8),
                Text(title,
                    style: KTTextStyles.h3.copyWith(
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none)),
              ],
            ),
          ),
          const Divider(color: KTColors.borderColor, height: 20),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile(
      {required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value,
              style: KTTextStyles.h2.copyWith(
                  color: color, decoration: TextDecoration.none)),
          const SizedBox(height: 4),
          Text(label,
              style: KTTextStyles.label.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(label,
                style: KTTextStyles.body.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none)),
          ],
        ),
        Text(value,
            style: KTTextStyles.body.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.none)),
      ],
    );
  }
}
