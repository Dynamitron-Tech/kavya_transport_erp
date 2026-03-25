import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../providers/manager_providers.dart';

class ManagerReportsScreen extends ConsumerWidget {
  const ManagerReportsScreen({super.key});

  static const _periods = ['week', 'month', 'quarter', 'year'];
  static const _periodLabels = ['This week', 'This month', 'Quarter', 'Year'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentPeriod = ref.watch(managerReportPeriodProvider);
    final reportAsync = ref.watch(managerReportsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text('Reports', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: RefreshIndicator(
        color: KTColors.managerAccent,
        backgroundColor: KTColors.surface,
        onRefresh: () async => ref.invalidate(managerReportsProvider),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // ── Period chips ───────────────────────
            SizedBox(
              height: 40,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _periods.length,
                itemBuilder: (_, i) {
                  final sel = currentPeriod == _periods[i];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_periodLabels[i]),
                      selected: sel,
                      selectedColor: KTColors.managerAccent,
                      backgroundColor: KTColors.surface,
                      labelStyle: TextStyle(color: sel ? Colors.white : KTColors.textMuted, fontSize: 13),
                      onSelected: (_) => ref.read(managerReportPeriodProvider.notifier).state = _periods[i],
                      side: BorderSide.none,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // ── Report data ────────────────────────
            reportAsync.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerReportsProvider)),
              data: (report) => _ReportBody(report: report),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportBody extends StatelessWidget {
  final Map<String, dynamic> report;
  const _ReportBody({required this.report});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── KPI grid ─────────────────────────────
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.0,
          children: [
            _kpi('Total Revenue', '₹${_fmt(report['total_revenue'])}', KTColors.success),
            _kpi('Total Expenses', '₹${_fmt(report['total_expenses'])}', KTColors.danger),
            _kpi('Jobs Completed', '${report['jobs_completed'] ?? 0}', KTColors.info),
            _kpi('Avg per Trip', '₹${_fmt(report['avg_revenue_per_trip'])}', KTColors.managerAccent),
          ],
        ),
        const SizedBox(height: 20),

        // ── Top Routes ───────────────────────────
        Text("TOP ROUTES", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
        const SizedBox(height: 12),
        ..._buildTopRoutes(report['top_routes']),
        const SizedBox(height: 20),

        // ── Expense Breakdown ────────────────────
        Text("EXPENSE BREAKDOWN", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
        const SizedBox(height: 12),
        ..._buildExpenseBreakdown(report['expense_breakdown']),
      ],
    );
  }

  List<Widget> _buildTopRoutes(dynamic routes) {
    if (routes == null || routes is! List || routes.isEmpty) {
      return [Text('No route data', style: KTTextStyles.body.copyWith(color: KTColors.textMuted))];
    }
    final maxTrips = routes.fold<num>(1, (m, r) => (r['trip_count'] ?? 0) > m ? r['trip_count'] : m);
    return routes.map<Widget>((r) {
      final count = (r['trip_count'] as num?)?.toDouble() ?? 0;
      final routeName = (r['route'] as String?) ??
          '${r['origin'] ?? 'Unknown'} → ${r['destination'] ?? 'Unknown'}';
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(10)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(routeName, style: KTTextStyles.body.copyWith(color: KTColors.textHeading))),
                Text('${count.toInt()} trips', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: maxTrips > 0 ? count / maxTrips : 0,
                  minHeight: 5,
                  backgroundColor: KTColors.borderColor,
                  valueColor: const AlwaysStoppedAnimation(KTColors.info),
                ),
              ),
            ],
          ),
        ),
      );
    }).toList();
  }

  List<Widget> _buildExpenseBreakdown(dynamic breakdown) {
    // Backend returns a List of {category, amount} objects
    List<Map<String, dynamic>> items = [];
    if (breakdown is List && breakdown.isNotEmpty) {
      items = breakdown
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } else if (breakdown is Map && breakdown.isNotEmpty) {
      // Fallback: treat as {category: amount} map
      breakdown.forEach((k, v) => items.add({'category': k, 'amount': v}));
    }
    if (items.isEmpty) {
      return [Text('No expense data', style: KTTextStyles.body.copyWith(color: KTColors.textMuted))];
    }
    final colors = [KTColors.managerAccent, KTColors.info, KTColors.success, KTColors.warning, KTColors.danger];
    int ci = 0;
    return items.map<Widget>((e) {
      final color = colors[ci++ % colors.length];
      final category = e['category']?.toString() ?? 'Other';
      final amount = e['amount'] ?? 0;
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            Container(width: 4, height: 24, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 10),
            Expanded(child: Text(category, style: KTTextStyles.body.copyWith(color: KTColors.textHeading))),
            Text('₹${_fmt(amount)}', style: KTTextStyles.body.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600)),
          ]),
        ),
      );
    }).toList();
  }

  Widget _kpi(String label, String value, Color color) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 3, color: color),
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
    );
  }

  String _fmt(dynamic val) {
    final n = (val is num) ? val.toDouble() : 0.0;
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(0)}K';
    return n.toStringAsFixed(0);
  }
}
