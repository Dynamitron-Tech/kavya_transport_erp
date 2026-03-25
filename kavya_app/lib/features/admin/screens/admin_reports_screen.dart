import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

// ─── Period state ─────────────────────────────────────────────────────────────

final _adminReportPeriodProvider = StateProvider<String>((ref) => 'month');

final _adminReportDataProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, String>((ref, period) async {
  final api = ref.read(apiServiceProvider);
  try {
    final res = await api.get('/reports/summary', queryParameters: {'period': period});
    if (res is Map<String, dynamic>) return res;
    if (res is Map) return Map<String, dynamic>.from(res);
    return null;
  } catch (_) {
    return null;
  }
});

// ─── Screen ───────────────────────────────────────────────────────────────────

class AdminReportsScreen extends ConsumerWidget {
  const AdminReportsScreen({super.key});

  static const _periods = ['week', 'month', 'quarter', 'year'];
  static const _periodLabels = ['This week', 'This month', 'Quarter', 'Year'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(_adminReportPeriodProvider);
    final reportAsync = ref.watch(_adminReportDataProvider(period));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        leading: const BackButton(color: KTColors.textHeading),
        title: Text('Reports', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: KTColors.borderColor),
        ),
      ),
      body: RefreshIndicator(
        color: KTColors.primary,
        backgroundColor: KTColors.surface,
        onRefresh: () async => ref.invalidate(_adminReportDataProvider(period)),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // ── Period chips ─────────────────────────────────────────
            SizedBox(
              height: 40,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _periods.length,
                itemBuilder: (_, i) {
                  final sel = period == _periods[i];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_periodLabels[i]),
                      selected: sel,
                      selectedColor: KTColors.primary,
                      backgroundColor: KTColors.surface,
                      labelStyle: TextStyle(
                          color: sel ? Colors.white : KTColors.textMuted, fontSize: 13),
                      onSelected: (_) =>
                          ref.read(_adminReportPeriodProvider.notifier).state = _periods[i],
                      side: BorderSide.none,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),

            // ── Report cards ─────────────────────────────────────────
            reportAsync.when(
              loading: () => _LoadingCards(),
              error: (_, __) => _ReportCardGrid(data: null),
              data: (data) => _ReportCardGrid(data: data),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Report card grid ─────────────────────────────────────────────────────────

class _ReportCardGrid extends StatelessWidget {
  final Map<String, dynamic>? data;
  const _ReportCardGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    final revenue = data?['revenue'] as Map? ?? {};
    final fleet = data?['fleet'] as Map? ?? {};
    final drivers = data?['drivers'] as Map? ?? {};
    final trips = data?['trips'] as Map? ?? {};
    final expenses = data?['expenses'] as Map? ?? {};

    return Column(
      children: [
        _ReportCard(
          icon: Icons.currency_rupee_rounded,
          color: const Color(0xFF16A34A),
          title: 'Revenue',
          metrics: [
            _Metric('Total Revenue', _fmt(revenue['total_revenue'] ?? revenue['total'])),
            _Metric('Invoiced', _fmt(revenue['invoiced'])),
            _Metric('Collected', _fmt(revenue['collected'])),
            _Metric('Outstanding', _fmt(revenue['outstanding'] ?? revenue['pending'])),
          ],
        ),
        const SizedBox(height: 12),
        _ReportCard(
          icon: Icons.local_shipping_rounded,
          color: const Color(0xFF2563EB),
          title: 'Fleet',
          metrics: [
            _Metric('Total Vehicles', _count(fleet['total'])),
            _Metric('Active', _count(fleet['active'])),
            _Metric('In Transit', _count(fleet['in_transit'])),
            _Metric('Under Maintenance', _count(fleet['maintenance'])),
          ],
        ),
        const SizedBox(height: 12),
        _ReportCard(
          icon: Icons.person_rounded,
          color: const Color(0xFF7C3AED),
          title: 'Driver Performance',
          metrics: [
            _Metric('Total Drivers', _count(drivers['total'])),
            _Metric('Active', _count(drivers['active'])),
            _Metric('Trips Completed', _count(drivers['trips_completed'])),
            _Metric('Avg Rating', _rating(drivers['avg_rating'])),
          ],
        ),
        const SizedBox(height: 12),
        _ReportCard(
          icon: Icons.route_rounded,
          color: KTColors.primary,
          title: 'Trip Summary',
          metrics: [
            _Metric('Total Trips', _count(trips['total'])),
            _Metric('Completed', _count(trips['completed'])),
            _Metric('In Transit', _count(trips['in_transit'])),
            _Metric('Delayed', _count(trips['delayed'])),
          ],
        ),
        const SizedBox(height: 12),
        _ReportCard(
          icon: Icons.receipt_long_rounded,
          color: const Color(0xFFD97706),
          title: 'Expense Summary',
          metrics: [
            _Metric('Total Expenses', _fmt(expenses['total'])),
            _Metric('Fuel', _fmt(expenses['fuel'])),
            _Metric('Tolls', _fmt(expenses['tolls'])),
            _Metric('Maintenance', _fmt(expenses['maintenance'])),
          ],
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  String _fmt(dynamic v) {
    if (v == null) return '—';
    final d = double.tryParse(v.toString()) ?? 0.0;
    if (d >= 10000000) return '₹${(d / 10000000).toStringAsFixed(1)}Cr';
    if (d >= 100000) return '₹${(d / 100000).toStringAsFixed(1)}L';
    if (d >= 1000) return '₹${(d / 1000).toStringAsFixed(1)}K';
    return '₹${d.toStringAsFixed(0)}';
  }

  String _count(dynamic v) => v?.toString() ?? '—';

  String _rating(dynamic v) {
    if (v == null) return '—';
    final d = double.tryParse(v.toString()) ?? 0.0;
    return '${d.toStringAsFixed(1)} ★';
  }
}

class _Metric {
  final String label;
  final String value;
  const _Metric(this.label, this.value);
}

class _ReportCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final List<_Metric> metrics;

  const _ReportCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.metrics,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                  color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Text(title,
                style: KTTextStyles.h2.copyWith(
                    color: KTColors.textHeading, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 14),
          const Divider(height: 1, color: KTColors.borderColor),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 2.5,
            children: metrics.map((m) => _MetricTile(metric: m, color: color)).toList(),
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final _Metric metric;
  final Color color;

  const _MetricTile({required this.metric, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(metric.value,
              style: KTTextStyles.body.copyWith(
                  color: color, fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 2),
          Text(metric.label,
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontSize: 11),
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ─── Loading placeholder ──────────────────────────────────────────────────────

class _LoadingCards extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (_) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: 160,
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: const Center(child: CircularProgressIndicator()),
          ),
        ),
      ),
    );
  }
}
