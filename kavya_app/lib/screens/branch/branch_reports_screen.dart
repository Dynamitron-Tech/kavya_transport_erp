import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final branchReportProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, period) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/reports/branch/summary', queryParameters: {'period': period});
    final payload = res['data'] ?? res;
    if (payload is Map<String, dynamic>) return payload;
    return {};
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class BranchReportsScreen extends ConsumerStatefulWidget {
  const BranchReportsScreen({super.key});

  @override
  ConsumerState<BranchReportsScreen> createState() => _BranchReportsScreenState();
}

class _BranchReportsScreenState extends ConsumerState<BranchReportsScreen> {
  String _period = 'weekly';

  @override
  Widget build(BuildContext context) {
    final reportAsync = ref.watch(branchReportProvider(_period));

    return reportAsync.when(
      loading: () => _shimmerLayout(),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load report', style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
              const SizedBox(height: 8),
              Text('$e', style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              KTButton.secondary(
                label: 'Retry',
                onPressed: () => ref.invalidate(branchReportProvider(_period)),
              ),
            ],
          ),
        ),
      ),
      data: (report) => _buildContent(context, report),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> report) {
    final totalTrips = report['total_trips'] ?? 0;
    final completedTrips = report['completed_trips'] ?? 0;
    final activeDrivers = report['active_drivers'] ?? 0;
    final totalRevenuePaise = report['total_revenue_paise'] ?? 0;
    final pendingLRs = report['pending_lrs'] ?? 0;
    final fuelConsumedL = report['fuel_consumed_litres'] ?? 0.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── Period Toggle ─────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Text('Branch Report', style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
              ),
              _periodChip('weekly', 'Weekly'),
              const SizedBox(width: 8),
              _periodChip('monthly', 'Monthly'),
            ],
          ),
          const SizedBox(height: 16),

          // ─── KPI Grid ─────────────────────────────────────────────
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: [
              KTStatCard(
                title: 'Total Trips',
                value: '$totalTrips',
                color: KTColors.info,
                icon: Icons.local_shipping,
              ),
              KTStatCard(
                title: 'Completed',
                value: '$completedTrips',
                color: KTColors.success,
                icon: Icons.check_circle_outline,
              ),
              KTStatCard(
                title: 'Active Drivers',
                value: '$activeDrivers',
                color: KTColors.amber500,
                icon: Icons.people_outline,
              ),
              KTStatCard(
                title: 'Revenue',
                value: '₹${(totalRevenuePaise / 100).toStringAsFixed(0)}',
                color: KTColors.success,
                icon: Icons.currency_rupee,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ─── Secondary Stats ──────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: KTColors.navy800,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.navy700),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Operational Summary',
                    style: KTTextStyles.bodyMedium.copyWith(color: KTColors.darkTextPrimary)),
                const SizedBox(height: 12),
                _summaryRow('Pending LRs', '$pendingLRs'),
                _summaryRow('Fuel Consumed', '${fuelConsumedL.toStringAsFixed(1)} L'),
                if (report['completion_rate'] != null)
                  _summaryRow('Completion Rate', '${report['completion_rate']}%'),
                if (report['on_time_delivery_rate'] != null)
                  _summaryRow('On-Time Delivery', '${report['on_time_delivery_rate']}%'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Share Button ─────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: KTButton.secondary(
              label: 'Share Report',
              leading: const Icon(Icons.share_outlined, size: 18),
              onPressed: () => _shareReport(report),
            ),
          ),
        ],
      ),
    );
  }

  Widget _periodChip(String period, String label) {
    final sel = _period == period;
    return GestureDetector(
      onTap: () => setState(() => _period = period),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: sel ? KTColors.navy700 : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: sel ? KTColors.amber500 : KTColors.navy700),
        ),
        child: Text(label,
            style: KTTextStyles.label.copyWith(
                color: sel ? KTColors.amber500 : KTColors.darkTextSecondary)),
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary)),
          Text(value, style: KTTextStyles.mono.copyWith(color: KTColors.darkTextPrimary)),
        ],
      ),
    );
  }

  Widget _shimmerLayout() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const KTLoadingShimmer(type: ShimmerType.card),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: List.generate(4, (_) => const KTLoadingShimmer(type: ShimmerType.card)),
          ),
          const SizedBox(height: 16),
          const KTLoadingShimmer(type: ShimmerType.card),
        ],
      ),
    );
  }

  void _shareReport(Map<String, dynamic> report) {
    final period = _period == 'weekly' ? 'Weekly' : 'Monthly';
    final buf = StringBuffer();
    buf.writeln('📊 Kavya Transports — $period Branch Report');
    buf.writeln('────────────────────────');
    buf.writeln('Total Trips     : ${report['total_trips'] ?? 0}');
    buf.writeln('Completed       : ${report['completed_trips'] ?? 0}');
    buf.writeln('Active Drivers  : ${report['active_drivers'] ?? 0}');
    final rev = (report['total_revenue_paise'] ?? 0) / 100;
    buf.writeln('Revenue         : ₹${rev.toStringAsFixed(2)}');
    buf.writeln('Pending LRs     : ${report['pending_lrs'] ?? 0}');
    buf.writeln('Fuel Consumed   : ${report['fuel_consumed_litres']?.toStringAsFixed(1) ?? 0} L');
    if (report['completion_rate'] != null) {
      buf.writeln('Completion Rate : ${report['completion_rate']}%');
    }
    buf.writeln('────────────────────────');
    buf.writeln('Generated by Kavya Transport ERP');
    SharePlus.instance.share(ShareParams(text: buf.toString()));
  }
}
