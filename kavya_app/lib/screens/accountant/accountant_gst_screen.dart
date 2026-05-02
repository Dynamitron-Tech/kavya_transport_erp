import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _gstProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String?>((ref, fy) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.get('/accountant/gst',
      queryParameters: {if (fy != null) 'financial_year': fy});
  if (result is Map<String, dynamic>) return result;
  return {'data': {}};
});

class AccountantGSTScreen extends ConsumerStatefulWidget {
  const AccountantGSTScreen({super.key});

  @override
  ConsumerState<AccountantGSTScreen> createState() =>
      _AccountantGSTScreenState();
}

class _AccountantGSTScreenState extends ConsumerState<AccountantGSTScreen> {
  String? _selectedFY;
  final _currencyFmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  // Generate available FY options
  List<String> get _fyOptions {
    final now = DateTime.now();
    final currentFY = now.month >= 4 ? now.year : now.year - 1;
    return List.generate(3, (i) {
      final y = currentFY - i;
      return '$y-${(y + 1).toString().substring(2)}';
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_gstProvider(_selectedFY));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(title: const Text('GST Documents')),
      body: Column(
        children: [
          // FY selector chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('All Years'),
                    selected: _selectedFY == null,
                    onSelected: (_) => setState(() => _selectedFY = null),
                  ),
                ),
                ..._fyOptions.map((fy) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text('FY $fy'),
                        selected: _selectedFY == fy,
                        onSelected: (_) => setState(() => _selectedFY = fy),
                      ),
                    )),
              ],
            ),
          ),
          Expanded(
            child: state.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (e, _) => KTErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(_gstProvider(_selectedFY))),
              data: (result) {
                final rawData = result['data'];
                final summary = (rawData is Map
                        ? rawData['summary']
                        : null) as Map<String, dynamic>? ??
                    {};
                final entries = (rawData is Map
                        ? rawData['entries']
                        : null) as List? ??
                    [];

                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async =>
                      ref.invalidate(_gstProvider(_selectedFY)),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Summary cards
                      if (summary.isNotEmpty) ...[
                        Text('GST Summary', style: KTTextStyles.h3),
                        const SizedBox(height: 12),
                        _GSTSummaryCard(summary: summary, fmt: _currencyFmt),
                        const SizedBox(height: 24),
                      ],
                      Text('Entries', style: KTTextStyles.h3),
                      const SizedBox(height: 12),
                      if (entries.isEmpty)
                        const KTEmptyState(
                          title: 'No GST entries',
                          subtitle:
                              'GST entries are auto-created when invoices are generated.',
                          lottieAsset: 'assets/lottie/empty_box.json',
                        )
                      else
                        ...entries.cast<Map<String, dynamic>>().map(
                            (e) => _GSTEntryTile(entry: e, fmt: _currencyFmt)),
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
}

class _GSTSummaryCard extends StatelessWidget {
  final Map<String, dynamic> summary;
  final NumberFormat fmt;
  const _GSTSummaryCard({required this.summary, required this.fmt});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          _row('Taxable Value', summary['total_taxable'] ?? 0, KTColors.textHeading),
          const Divider(color: KTColors.borderColor, height: 20),
          _row('CGST', summary['total_cgst'] ?? 0, KTColors.info),
          const SizedBox(height: 6),
          _row('SGST', summary['total_sgst'] ?? 0, KTColors.info),
          const SizedBox(height: 6),
          _row('IGST', summary['total_igst'] ?? 0, KTColors.warning),
          const Divider(color: KTColors.borderColor, height: 20),
          _row('Total GST', summary['total_gst'] ?? 0, KTColors.acctAccent,
              bold: true),
          const SizedBox(height: 6),
          _row('Total Value', summary['total_value'] ?? 0, KTColors.success,
              bold: true),
        ],
      ),
    );
  }

  Widget _row(String label, dynamic value, Color color,
      {bool bold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(
                color: KTColors.textMuted, fontSize: 13)),
        Text(
          fmt.format((value as num).toDouble()),
          style: TextStyle(
              color: color,
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              fontSize: bold ? 15 : 13),
        ),
      ],
    );
  }
}

class _GSTEntryTile extends StatelessWidget {
  final Map<String, dynamic> entry;
  final NumberFormat fmt;
  const _GSTEntryTile({required this.entry, required this.fmt});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(entry['invoice_number'] ?? '—',
                  style: const TextStyle(
                      color: KTColors.acctAccent,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w600)),
              _badge(entry['filing_status'] ?? 'pending'),
            ],
          ),
          const SizedBox(height: 6),
          Text(entry['party_name'] ?? '—',
              style: const TextStyle(
                  color: KTColors.textHeading, fontWeight: FontWeight.w500)),
          Text('GSTIN: ${entry['party_gstin'] ?? '—'}',
              style: const TextStyle(
                  color: KTColors.textMuted, fontSize: 12)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _taxChip('CGST', entry['cgst_amount']),
              _taxChip('SGST', entry['sgst_amount']),
              _taxChip('IGST', entry['igst_amount']),
              Text(
                fmt.format((entry['total_value'] as num? ?? 0).toDouble()),
                style: const TextStyle(
                    color: KTColors.success,
                    fontWeight: FontWeight.bold,
                    fontSize: 14),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _badge(String status) {
    final colors = {
      'filed': KTColors.success,
      'pending': KTColors.warning,
      'overdue': KTColors.danger,
    };
    final c = colors[status.toLowerCase()] ?? KTColors.textMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
      child: Text(status.toUpperCase(),
          style: TextStyle(
              color: c, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }

  Widget _taxChip(String label, dynamic value) {
    final amount = (value as num? ?? 0).toDouble();
    return Column(children: [
      Text(label,
          style: const TextStyle(color: KTColors.textMuted, fontSize: 10)),
      Text('₹${amount.toStringAsFixed(0)}',
          style: const TextStyle(
              color: KTColors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500)),
    ]);
  }
}
