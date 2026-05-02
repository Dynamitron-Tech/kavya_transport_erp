import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _statementsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, period) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.get('/accountant/statements',
      queryParameters: {'period': period});
  if (result is Map<String, dynamic> && result['data'] != null) {
    return result['data'] as Map<String, dynamic>;
  }
  return {};
});

class AccountantStatementsScreen extends ConsumerStatefulWidget {
  const AccountantStatementsScreen({super.key});

  @override
  ConsumerState<AccountantStatementsScreen> createState() =>
      _AccountantStatementsScreenState();
}

class _AccountantStatementsScreenState
    extends ConsumerState<AccountantStatementsScreen> {
  String _period = 'monthly';
  final _currencyFmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_statementsProvider(_period));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(title: const Text('Financial Statements')),
      body: Column(
        children: [
          // Period selector
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'monthly', label: Text('Monthly')),
                ButtonSegment(value: 'quarterly', label: Text('Quarterly')),
                ButtonSegment(value: 'yearly', label: Text('Yearly')),
              ],
              selected: {_period},
              onSelectionChanged: (s) => setState(() => _period = s.first),
            ),
          ),
          Expanded(
            child: state.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (e, _) => KTErrorState(
                  message: e.toString(),
                  onRetry: () =>
                      ref.invalidate(_statementsProvider(_period))),
              data: (data) {
                final income = (data['income_statement'] as Map<String, dynamic>?) ?? {};
                final outstanding = (data['outstanding'] as Map<String, dynamic>?) ?? {};
                final tax = (data['tax_summary'] as Map<String, dynamic>?) ?? {};
                final startDate = data['start_date'] ?? '';
                final endDate = data['end_date'] ?? '';

                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async =>
                      ref.invalidate(_statementsProvider(_period)),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Period header
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: KTColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: KTColors.borderColor),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Period',
                                style: const TextStyle(
                                    color: KTColors.textMuted,
                                    fontSize: 12)),
                            Text('$startDate → $endDate',
                                style: const TextStyle(
                                    color: KTColors.textHeading,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Income Statement
                      Text('Profit & Loss Statement', style: KTTextStyles.h3),
                      const SizedBox(height: 12),
                      _StatementCard(children: [
                        _statRow('Total Revenue', income['total_revenue'] ?? 0,
                            KTColors.success, _currencyFmt, bold: true),
                        _divider(),
                        _statRow('Total Expenses', income['total_expenses'] ?? 0,
                            KTColors.danger, _currencyFmt),
                        _divider(),
                        _statRow('Net Profit', income['net_profit'] ?? 0,
                            (income['net_profit'] ?? 0) >= 0
                                ? KTColors.success
                                : KTColors.danger,
                            _currencyFmt,
                            bold: true,
                            large: true),
                      ]),
                      const SizedBox(height: 20),

                      // Outstanding
                      Text('Outstanding', style: KTTextStyles.h3),
                      const SizedBox(height: 12),
                      _StatementCard(children: [
                        _statRow(
                            'Receivables (Due)',
                            outstanding['total_receivables'] ?? 0,
                            KTColors.warning,
                            _currencyFmt),
                      ]),
                      const SizedBox(height: 20),

                      // Tax Summary
                      Text('GST Summary', style: KTTextStyles.h3),
                      const SizedBox(height: 12),
                      _StatementCard(children: [
                        _statRow('GST Collected (Output)',
                            tax['gst_collected'] ?? 0, KTColors.info,
                            _currencyFmt),
                        _divider(),
                        _statRow('GST Paid (Input)', tax['gst_paid'] ?? 0,
                            KTColors.success, _currencyFmt),
                        _divider(),
                        _statRow('Net GST Payable', tax['gst_payable'] ?? 0,
                            KTColors.danger, _currencyFmt,
                            bold: true),
                      ]),
                      const SizedBox(height: 24),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _statRow(String label, dynamic value, Color color, NumberFormat fmt,
      {bool bold = false, bool large = false}) {
    final doubleVal = (value as num).toDouble();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  color: KTColors.textMuted,
                  fontSize: bold ? 14 : 13)),
          Text(
            fmt.format(doubleVal),
            style: TextStyle(
                color: color,
                fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                fontSize: large ? 18 : 14),
          ),
        ],
      ),
    );
  }

  Widget _divider() =>
      const Divider(color: KTColors.borderColor, height: 1);
}

class _StatementCard extends StatelessWidget {
  final List<Widget> children;
  const _StatementCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(children: children),
    );
  }
}
