import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _payablesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.get('/accountant/payables');
  if (result is Map && result['data'] is List) return result['data'];
  return [];
});

class AccountantPayablesScreen extends ConsumerWidget {
  const AccountantPayablesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(_payablesProvider);
    final currencyFmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(title: const Text('Payables')),
      body: state.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(
            message: e.toString(),
            onRetry: () => ref.invalidate(_payablesProvider)),
        data: (payables) {
          if (payables.isEmpty) {
            return const KTEmptyState(
              title: 'No outstanding payables',
              subtitle: 'All vendor dues are cleared.',
              lottieAsset: 'assets/lottie/empty_box.json',
            );
          }

          // Total outstanding
          final totalOutstanding = payables.fold<double>(
              0, (sum, p) => sum + ((p['total_outstanding'] as num? ?? 0).toDouble()));

          return RefreshIndicator(
            color: KTColors.acctAccent,
            onRefresh: () async => ref.invalidate(_payablesProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Summary card
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        KTColors.danger.withOpacity(0.3),
                        KTColors.danger.withOpacity(0.1),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.danger.withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Payables',
                              style: TextStyle(
                                  color: KTColors.textMuted, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(
                            currencyFmt.format(totalOutstanding),
                            style: const TextStyle(
                                color: KTColors.danger,
                                fontSize: 22,
                                fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Text('${payables.length} Vendors',
                          style: const TextStyle(
                              color: KTColors.textMuted, fontSize: 13)),
                    ],
                  ),
                ),
                // Aging header
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      const Expanded(
                          flex: 3,
                          child: Text('Vendor',
                              style: TextStyle(
                                  color: KTColors.textMuted, fontSize: 11))),
                      for (final h in ['Current', '30-60', '60-90', '90+'])
                        Expanded(
                            child: Text(h,
                                textAlign: TextAlign.end,
                                style: const TextStyle(
                                    color: KTColors.textMuted, fontSize: 10))),
                    ],
                  ),
                ),
                // Payable rows
                ...payables.cast<Map<String, dynamic>>().map(
                    (p) => _PayableTile(payable: p, fmt: currencyFmt)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PayableTile extends StatelessWidget {
  final Map<String, dynamic> payable;
  final NumberFormat fmt;
  const _PayableTile({required this.payable, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final over90 = (payable['days_90_plus'] as num? ?? 0).toDouble();
    final over60 = (payable['days_60_90'] as num? ?? 0).toDouble();
    final isOverdue = over90 > 0 || over60 > 100000;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: isOverdue
                ? KTColors.danger.withOpacity(0.4)
                : KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(payable['vendor_name'] ?? '—',
                      style: const TextStyle(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                  Text(
                    (payable['vendor_type'] ?? 'vendor')
                        .toString()
                        .replaceAll('_', ' ')
                        .toUpperCase(),
                    style: const TextStyle(
                        color: KTColors.textMuted, fontSize: 10),
                  ),
                ],
              ),
              Text(
                fmt.format(
                    (payable['total_outstanding'] as num? ?? 0).toDouble()),
                style: const TextStyle(
                    color: KTColors.danger,
                    fontWeight: FontWeight.bold,
                    fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Aging breakdown
          Row(children: [
            _agingCell('Current',
                (payable['current'] as num? ?? 0).toDouble(), fmt,
                color: KTColors.success),
            _agingCell('30-60',
                (payable['days_30_60'] as num? ?? 0).toDouble(), fmt,
                color: KTColors.warning),
            _agingCell('60-90', over60, fmt, color: Colors.orange),
            _agingCell('90+', over90, fmt, color: KTColors.danger),
          ]),
        ],
      ),
    );
  }

  Widget _agingCell(String label, double value, NumberFormat fmt,
      {required Color color}) {
    return Expanded(
      child: Column(
        children: [
          Text(label,
              textAlign: TextAlign.center,
              style: const TextStyle(color: KTColors.textMuted, fontSize: 9)),
          const SizedBox(height: 3),
          Text(
            fmt.format(value),
            textAlign: TextAlign.center,
            style: TextStyle(
                color: value > 0 ? color : KTColors.textMuted,
                fontSize: 11,
                fontWeight:
                    value > 0 ? FontWeight.w600 : FontWeight.normal),
          ),
        ],
      ),
    );
  }
}
