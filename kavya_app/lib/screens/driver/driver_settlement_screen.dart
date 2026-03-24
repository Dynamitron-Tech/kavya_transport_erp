import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../providers/auth_provider.dart';
import '../../core/localization/locale_provider.dart';
import '../../core/localization/driver_strings.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final driverSettlementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
  (ref, driverId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/payables/driver/$driverId');
    final list = (res['data'] ?? res) as List? ?? [];
    return list.cast<Map<String, dynamic>>();
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class DriverSettlementScreen extends ConsumerWidget {
  const DriverSettlementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final s = ref.watch(sProvider);
    final driverId = int.tryParse(user?.id ?? '') ?? 0;
    final settlementsAsync = ref.watch(driverSettlementsProvider(driverId));

    return Scaffold(
      backgroundColor: KTColors.navy950,
      appBar: AppBar(
        backgroundColor: KTColors.navy900,
        foregroundColor: KTColors.darkTextPrimary,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(s.myEarnings, style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
        centerTitle: false,
      ),
      body: settlementsAsync.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(
            4,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: KTLoadingShimmer(type: ShimmerType.card),
            ),
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load settlements', style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary)),
              const SizedBox(height: 16),
              KTButton.secondary(
                onPressed: () => ref.invalidate(driverSettlementsProvider(driverId)),
                label: s.retry,
              ),
            ],
          ),
        ),
        data: (settlements) => _buildBody(context, settlements, s),
      ),
    );
  }

  Widget _buildBody(BuildContext context, List<Map<String, dynamic>> settlements, S s) {
    // Compute summary
    int totalPaisePending = 0;
    int totalPaiseMonth = 0;
    final now = DateTime.now();
    for (final s in settlements) {
      final netPaise = (s['net_amount_paise'] as num? ?? 0).toInt();
      final status = s['status']?.toString() ?? '';
      if (status == 'pending') totalPaisePending += netPaise;
      final dateStr = s['trip_date']?.toString() ?? '';
      if (dateStr.isNotEmpty) {
        try {
          final dt = DateTime.parse(dateStr);
          if (dt.year == now.year && dt.month == now.month) {
            totalPaiseMonth += netPaise;
          }
        } catch (_) {}
      }
    }

    return RefreshIndicator(
      color: KTColors.amber500,
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── Summary Cards ───────────────────────────────────────
          Row(
            children: [
              Expanded(child: _summaryCard('This Month', totalPaiseMonth, Icons.account_balance_wallet, KTColors.amber500)),
              const SizedBox(width: 12),
              Expanded(child: _summaryCard('Pending', totalPaisePending, Icons.pending_outlined, KTColors.warning)),
            ],
          ),
          const SizedBox(height: 24),

          // ─── Settlement History ───────────────────────────────────
          Text(s.settlementHistory, style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
          const SizedBox(height: 12),

          if (settlements.isEmpty)
            _emptyState()
          else
            ...settlements.map((s) => _settlementCard(context, s)),
        ],
      ),
    );
  }

  Widget _summaryCard(String label, int paise, IconData icon, Color accent) {
    final amount = '₹${(paise / 100).toStringAsFixed(2)}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.navy800,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.navy700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accent, size: 24),
          const SizedBox(height: 8),
          Text(amount, style: KTTextStyles.kpiNumber.copyWith(color: accent, fontSize: 20)),
          const SizedBox(height: 4),
          Text(label, style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
        ],
      ),
    );
  }

  Widget _settlementCard(BuildContext context, Map<String, dynamic> settlement) {
    final status = settlement['status']?.toString() ?? 'pending';
    final grossPaise = (settlement['gross_amount_paise'] as num? ?? 0).toInt();
    final advancePaise = (settlement['advance_paise'] as num? ?? 0).toInt();
    final expensesPaise = (settlement['expenses_paise'] as num? ?? 0).toInt();
    final netPaise = (settlement['net_amount_paise'] as num? ?? 0).toInt();
    final tripDate = settlement['trip_date']?.toString() ?? '';
    final route = '${settlement['origin'] ?? '—'} → ${settlement['destination'] ?? '—'}';

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'paid':
        statusColor = KTColors.success;
        statusLabel = 'Paid';
        break;
      case 'approved':
        statusColor = KTColors.info;
        statusLabel = 'Approved';
        break;
      default:
        statusColor = KTColors.warning;
        statusLabel = 'Pending';
    }

    return GestureDetector(
      onTap: () => _showDetail(context, settlement),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.navy800,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.navy700),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(tripDate, style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
                KTStatusBadge(label: statusLabel, color: statusColor),
              ],
            ),
            const SizedBox(height: 8),
            Text(route, style: KTTextStyles.body.copyWith(color: KTColors.darkTextPrimary)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _amountChip('Gross', grossPaise, KTColors.darkTextSecondary),
                _amountChip('Advance', -advancePaise, KTColors.danger),
                _amountChip('Expenses', -expensesPaise, KTColors.danger),
                _amountChip('Net', netPaise, KTColors.amber500, isHighlight: true),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _amountChip(String label, int paise, Color color, {bool isHighlight = false}) {
    final prefix = paise < 0 ? '-₹' : '₹';
    final amount = '$prefix${(paise.abs() / 100).toStringAsFixed(0)}';
    return Column(
      children: [
        Text(
          amount,
          style: isHighlight
              ? KTTextStyles.kpiNumber.copyWith(color: color, fontSize: 16)
              : KTTextStyles.label.copyWith(color: color, fontWeight: FontWeight.w600),
        ),
        Text(label, style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
      ],
    );
  }

  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          const Icon(Icons.receipt_long, color: KTColors.darkTextSecondary, size: 64),
          const SizedBox(height: 16),
          Text('No Settlements Yet', style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
          const SizedBox(height: 8),
          Text(
            'Your settlement history will appear here after trips are completed.',
            style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  void _showDetail(BuildContext context, Map<String, dynamic> settlement) {
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.navy800,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _SettlementDetailSheet(settlement: settlement),
    );
  }
}

// ─── Detail Bottom Sheet ─────────────────────────────────────────────────────

class _SettlementDetailSheet extends StatelessWidget {
  final Map<String, dynamic> settlement;
  const _SettlementDetailSheet({required this.settlement});

  @override
  Widget build(BuildContext context) {
    final grossPaise = (settlement['gross_amount_paise'] as num? ?? 0).toInt();
    final advancePaise = (settlement['advance_paise'] as num? ?? 0).toInt();
    final expensesPaise = (settlement['expenses_paise'] as num? ?? 0).toInt();
    final netPaise = (settlement['net_amount_paise'] as num? ?? 0).toInt();
    final tripId = settlement['trip_id']?.toString() ?? '—';
    final status = settlement['status']?.toString() ?? '—';

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: KTColors.navy700,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Settlement Breakdown', style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
          const SizedBox(height: 4),
          Text('Trip #$tripId · Status: ${status.toUpperCase()}',
              style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
          const Divider(color: KTColors.navy700, height: 24),
          _row('Gross Earnings', grossPaise, KTColors.success),
          _row('Advance Taken', -advancePaise, KTColors.danger),
          _row('Trip Expenses', -expensesPaise, KTColors.danger),
          const Divider(color: KTColors.navy700, height: 24),
          _row('Net Payable', netPaise, KTColors.amber500, isTotal: true),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _row(String label, int paise, Color color, {bool isTotal = false}) {
    final prefix = paise < 0 ? '-₹' : '₹';
    final amount = '$prefix${(paise.abs() / 100).toStringAsFixed(2)}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: isTotal
                  ? KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)
                  : KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary)),
          Text(amount,
              style: isTotal
                  ? KTTextStyles.kpiNumber.copyWith(color: color, fontSize: 20)
                  : KTTextStyles.label.copyWith(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
