import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../providers/admin_providers.dart';

class AdminFinanceScreen extends ConsumerWidget {
  const AdminFinanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(adminFinanceSummaryProvider);
    final invoices = ref.watch(adminRecentInvoicesProvider);
    final payables = ref.watch(adminPayablesSummaryProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: KTColors.borderColor, width: 1)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.go('/admin/dashboard'),
                  ),
                  Expanded(
                    child: Text('Finance',
                        style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: KTColors.primary,
        onRefresh: () async {
          ref.invalidate(adminFinanceSummaryProvider);
          ref.invalidate(adminRecentInvoicesProvider);
          ref.invalidate(adminPayablesSummaryProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── KPI Grid ──
            summary.when(
              data: (d) => _buildKpiGrid(d),
              loading: () => const SizedBox(height: 120, child: Center(child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => GestureDetector(
                onTap: () => ref.invalidate(adminFinanceSummaryProvider),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Column(children: [
                    Text('Finance data unavailable',
                        style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 4),
                    Text('Tap to retry',
                        style: KTTextStyles.caption.copyWith(color: KTColors.primary)),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── Receivables Aging ──
            _sectionHead('RECEIVABLES AGING'),
            const SizedBox(height: 10),
            summary.when(
              data: (d) {
                final aging = d['receivables_aging'] as Map<String, dynamic>? ?? {};
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: KTColors.borderColor),
                    boxShadow: const [
                      BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    children: [
                      _agingRow('Current (0-30d)', aging['current'], KTColors.primary),
                      const Divider(color: KTColors.borderColor, height: 16),
                      _agingRow('31-60 days', aging['days_31_60'], KTColors.amber500),
                      const Divider(color: KTColors.borderColor, height: 16),
                      _agingRow('61-90 days', aging['days_61_90'], KTColors.danger),
                      const Divider(color: KTColors.borderColor, height: 16),
                      _agingRow('90+ days', aging['days_90_plus'], KTColors.danger),
                    ],
                  ),
                );
              },
              loading: () => const SizedBox(height: 80),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 24),

            // ── Recent Invoices ──
            _sectionHead('RECENT INVOICES'),
            const SizedBox(height: 10),
            invoices.when(
              data: (list) {
                if (list.isEmpty) {
                  return Text('No invoices yet',
                      style: KTTextStyles.body.copyWith(color: KTColors.textMuted));
                }
                return Column(
                  children: list.take(5).map<Widget>((inv) {
                    final m = inv as Map<String, dynamic>;
                    return _invoiceTile(context, m);
                  }).toList(),
                );
              },
              loading: () => const SizedBox(height: 80, child: Center(child: CircularProgressIndicator(color: KTColors.primary))),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 24),

            // ── Payables ──
            _sectionHead('PAYABLES'),
            const SizedBox(height: 10),
            payables.when(
              data: (list) {
                if (list.isEmpty) return const SizedBox.shrink();
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: KTColors.borderColor),
                    boxShadow: const [
                      BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    children: list.map<Widget>((p) {
                      final m = p as Map<String, dynamic>;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(m['category'] as String? ?? '—',
                                style: KTTextStyles.body.copyWith(color: KTColors.textBody)),
                            Text(_fmtAmt(m['amount']),
                                style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                );
              },
              loading: () => const SizedBox(height: 60),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _sectionHead(String title) {
    return Text(title,
        style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted));
  }

  Widget _buildKpiGrid(Map<String, dynamic> d) {
    return Column(
      children: [
        Row(
          children: [
            _kpi(_fmtAmt(d['month_revenue']), 'Month revenue', KTColors.primary),
            const SizedBox(width: 12),
            _kpi(_fmtAmt(d['total_receivables']), 'Receivables', KTColors.danger),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _kpi(_fmtAmt(d['total_payables']), 'Payables', KTColors.info),
            const SizedBox(width: 12),
            _kpi(_fmtAmt(d['overdue_amount']), 'Overdue', const Color(0xFF7C3AED)),
          ],
        ),
      ],
    );
  }

  Widget _kpi(String value, String label, Color color) {
    return Expanded(
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
          boxShadow: const [
            BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
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
                    children: [
                      Text(value,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 22,
                              color: Color(0xFF0D1B2A),
                              height: 1.2)),
                      const SizedBox(height: 4),
                      Text(label,
                          style: const TextStyle(
                              fontWeight: FontWeight.w400,
                              fontSize: 12,
                              color: Color(0xFF8494A4),
                              height: 1.4)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _agingRow(String label, dynamic amount, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: KTTextStyles.body.copyWith(color: KTColors.textBody)),
        Text(_fmtAmt(amount),
            style: KTTextStyles.h3.copyWith(color: color)),
      ],
    );
  }

  Widget _invoiceTile(BuildContext context, Map<String, dynamic> m) {
    final number = m['invoice_number'] as String? ?? '—';
    final status = (m['status'] as String? ?? 'DRAFT').toUpperCase();
    final client = m['client_name'] as String? ?? m['billing_name'] as String? ?? '—';
    final amount = _fmtAmt(m['total_amount']);
    final isPaid = status == 'PAID';
    final isOverdue = status == 'OVERDUE';
    final statusColor = isPaid ? KTColors.primary : isOverdue ? KTColors.danger : KTColors.info;

    return GestureDetector(
      onTap: () {
        final invId = m['id']?.toString();
        if (invId != null) context.push('/admin/invoices/$invId');
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
          boxShadow: const [
            BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: statusColor),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(number,
                              style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(status,
                                style: KTTextStyles.labelCaps.copyWith(
                                    color: statusColor, letterSpacing: 0.3)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('$client · $amount',
                          style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtAmt(dynamic val) {
    final v = (val is num) ? val.toDouble() : double.tryParse(val?.toString() ?? '') ?? 0.0;
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(0)}K';
    return '₹${v.toStringAsFixed(0)}';
  }
}

