import 'dart:io';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

final _auditorReportProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, Map<String, String>>(
  (ref, params) async {
    final api = ref.read(apiServiceProvider);
    final result = await api.get('/reports/auditor', queryParameters: params);
    if (result is Map<String, dynamic> && result['data'] != null) {
      return result['data'] as Map<String, dynamic>;
    }
    return {};
  },
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class AuditorReportScreen extends ConsumerStatefulWidget {
  const AuditorReportScreen({super.key});

  @override
  ConsumerState<AuditorReportScreen> createState() => _AuditorReportScreenState();
}

class _AuditorReportScreenState extends ConsumerState<AuditorReportScreen> {
  // period presets
  static const _periods = ['This Month', 'Last 3 Months', 'This Quarter', 'This Year'];
  String _selectedPeriod = 'This Month';

  late DateTime _fromDate;
  late DateTime _toDate;

  String _ledgerFilter = 'ALL';
  int _ledgerPage = 1;

  final _currencyFmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
  bool _isExporting = false;

  @override
  void initState() {
    super.initState();
    _applyPeriod('This Month');
  }

  void _applyPeriod(String period) {
    final today = DateTime.now();
    setState(() {
      _selectedPeriod = period;
      _ledgerPage = 1;
      switch (period) {
        case 'Last 3 Months':
          _fromDate = DateTime(today.year, today.month - 2, 1);
          _toDate = today;
        case 'This Quarter':
          final q = ((today.month - 1) ~/ 3) * 3 + 1;
          _fromDate = DateTime(today.year, q, 1);
          _toDate = today;
        case 'This Year':
          _fromDate = DateTime(today.year, 1, 1);
          _toDate = today;
        default: // This Month
          _fromDate = DateTime(today.year, today.month, 1);
          _toDate = today;
      }
    });
  }

  Map<String, String> get _params => {
        'from_date': DateFormat('yyyy-MM-dd').format(_fromDate),
        'to_date': DateFormat('yyyy-MM-dd').format(_toDate),
        'ledger_page': _ledgerPage.toString(),
        'ledger_per_page': '100',
      };

  Future<void> _exportReport(String format) async {
    setState(() => _isExporting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final bytes = await api.downloadBytes(
        '/reports/auditor/export',
        queryParameters: {
          'format': format,
          'from_date': DateFormat('yyyy-MM-dd').format(_fromDate),
          'to_date': DateFormat('yyyy-MM-dd').format(_toDate),
        },
      );

      final dir = await getTemporaryDirectory();
      final fname =
          'auditor_report_${DateFormat('yyyyMMdd').format(_fromDate)}_${DateFormat('yyyyMMdd').format(_toDate)}.$format';
      final file = File('${dir.path}/$fname');
      await file.writeAsBytes(bytes);

      final mimeType =
          format == 'pdf' ? 'application/pdf' : 'text/csv';
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: mimeType)],
          text: 'Auditor Report — ${DateFormat('dd MMM yyyy').format(_fromDate)} to ${DateFormat('dd MMM yyyy').format(_toDate)}',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  void _showExportSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Export Auditor Report', style: KTTextStyles.h2),
            const SizedBox(height: 4),
            Text('Choose format to download', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () { Navigator.pop(context); _exportReport('csv'); },
                    icon: const Icon(Icons.table_chart_outlined, size: 20),
                    label: const Text('Export CSV'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      foregroundColor: KTColors.info,
                      side: const BorderSide(color: KTColors.info),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () { Navigator.pop(context); _exportReport('pdf'); },
                    icon: const Icon(Icons.picture_as_pdf_outlined, size: 20),
                    label: const Text('Export PDF'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      backgroundColor: KTColors.acctAccent,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_auditorReportProvider(_params));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        title: const Text('Auditor Report'),
        actions: [
          if (_isExporting)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else
            IconButton(
              icon: const Icon(Icons.download_outlined),
              tooltip: 'Export',
              onPressed: _showExportSheet,
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Period Selector ──────────────────────────────────────────
          Container(
            color: KTColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _periods.map((p) {
                  final selected = _selectedPeriod == p;
                  return GestureDetector(
                    onTap: () => _applyPeriod(p),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? KTColors.acctAccent : KTColors.lightBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: selected ? KTColors.acctAccent : KTColors.borderColor,
                        ),
                      ),
                      child: Text(
                        p,
                        style: KTTextStyles.bodySmall.copyWith(
                          color: selected ? Colors.white : KTColors.textMuted,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // ── Content ─────────────────────────────────────────────────
          Expanded(
            child: state.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (e, _) => KTErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(_auditorReportProvider(_params)),
              ),
              data: (data) => RefreshIndicator(
                color: KTColors.acctAccent,
                onRefresh: () async => ref.invalidate(_auditorReportProvider(_params)),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // period pill
                    _PeriodPill(
                      from: DateFormat('dd MMM yyyy').format(_fromDate),
                      to: DateFormat('dd MMM yyyy').format(_toDate),
                    ),
                    const SizedBox(height: 16),

                    // ── KPI Grid ──
                    _buildKPIGrid(data),
                    const SizedBox(height: 20),

                    // ── Section 1: P&L ──
                    _buildSectionHeader('1. Profit & Loss Summary', Icons.trending_up_rounded, KTColors.success),
                    _buildPLSection(data['pl_summary'] as Map<String, dynamic>? ?? {}),
                    const SizedBox(height: 20),

                    // ── Section 2: Payment Breakdown ──
                    _buildSectionHeader('2. Payment Method Breakdown', Icons.credit_card_outlined, KTColors.info),
                    _buildPaymentSection(data['payment_breakdown'] as List? ?? []),
                    const SizedBox(height: 20),

                    // ── Section 3: GST ──
                    _buildSectionHeader('3. GST Summary', Icons.receipt_long_outlined, KTColors.warning),
                    _buildGSTSection(data['gst_summary'] as Map<String, dynamic>? ?? {}),
                    const SizedBox(height: 20),

                    // ── Section 4: Outstanding ──
                    _buildSectionHeader('4. Outstanding Receivables', Icons.access_time_rounded, KTColors.danger),
                    _buildOutstandingSection(data['outstanding_receivables'] as Map<String, dynamic>? ?? {}),
                    const SizedBox(height: 20),

                    // ── Section 5: TDS ──
                    _buildSectionHeader('5. TDS Summary', Icons.check_circle_outline, KTColors.roleManager),
                    _buildTDSSection(data['tds_summary'] as Map<String, dynamic>? ?? {}),
                    const SizedBox(height: 20),

                    // ── Section 6: Ledger ──
                    _buildSectionHeader('6. Ledger Entries', Icons.menu_book_outlined, KTColors.textHeading),
                    _buildLedgerSection(data['ledger'] as Map<String, dynamic>? ?? {}),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── KPI Grid ─────────────────────────────────────────────────────────────

  Widget _buildKPIGrid(Map<String, dynamic> data) {
    final pl = data['pl_summary'] as Map<String, dynamic>? ?? {};
    final os = data['outstanding_receivables'] as Map<String, dynamic>? ?? {};
    final gst = data['gst_summary'] as Map<String, dynamic>? ?? {};
    final netProfit = _toDouble(pl['net_profit']);

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.7,
      children: [
        _KPICard(label: 'Revenue', value: _currencyFmt.format(_toDouble(pl['total_invoiced'])), color: KTColors.success, icon: Icons.currency_rupee_rounded),
        _KPICard(
          label: 'Net Profit',
          value: _currencyFmt.format(netProfit),
          color: netProfit >= 0 ? KTColors.success : KTColors.danger,
          icon: netProfit >= 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
        ),
        _KPICard(label: 'Outstanding', value: _currencyFmt.format(_toDouble(os['total_outstanding'])), color: KTColors.warning, icon: Icons.hourglass_top_rounded),
        _KPICard(label: 'GST Payable', value: _currencyFmt.format(_toDouble(gst['net_gst_payable'])), color: KTColors.info, icon: Icons.receipt_outlined),
      ],
    );
  }

  // ── Section: P&L ─────────────────────────────────────────────────────────

  Widget _buildPLSection(Map<String, dynamic> data) {
    final rows = [
      ('Total Invoiced', _toDouble(data['total_invoiced']), KTColors.textHeading),
      ('Total Collected', _toDouble(data['total_collected']), KTColors.success),
      ('Total Expenses', _toDouble(data['total_expenses']), KTColors.danger),
    ];
    final netProfit = _toDouble(data['net_profit']);
    final eff = _toDouble(data['collection_efficiency_percent']);

    return _SectionCard(children: [
      ...rows.map((r) => _SummaryRow(label: r.$1, value: _currencyFmt.format(r.$2), valueColor: r.$3)),
      const _Divider(),
      _SummaryRow(
        label: 'Net Profit / (Loss)',
        value: _currencyFmt.format(netProfit),
        valueColor: netProfit >= 0 ? KTColors.success : KTColors.danger,
        bold: true,
        large: true,
      ),
      const SizedBox(height: 4),
      _SummaryRow(label: 'Collection Efficiency', value: '${eff.toStringAsFixed(1)}%', valueColor: KTColors.info),
    ]);
  }

  // ── Section: Payment Breakdown ───────────────────────────────────────────

  static const _chartColors = [
    Color(0xFF2563EB), Color(0xFF10B981), Color(0xFFF59E0B),
    Color(0xFFEF4444), Color(0xFF8B5CF6), Color(0xFF06B6D4), Color(0xFFEC4899),
  ];

  Widget _buildPaymentSection(List items) {
    if (items.isEmpty) {
      return _SectionCard(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text('No payment records in this period.',
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
        ),
      ]);
    }

    final sections = items.asMap().entries.map((e) {
      final amount = _toDouble(e.value['amount']);
      return PieChartSectionData(
        value: amount,
        color: _chartColors[e.key % _chartColors.length],
        radius: 60,
        showTitle: false,
      );
    }).toList();

    final total = items.fold<double>(0, (acc, m) => acc + _toDouble(m['amount']));

    return _SectionCard(children: [
      SizedBox(
        height: 180,
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: PieChart(PieChartData(
                sections: sections,
                centerSpaceRadius: 36,
                sectionsSpace: 3,
              )),
            ),
            Expanded(
              flex: 3,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: items.asMap().entries.map<Widget>((e) {
                  final method = (e.value['method'] as String?) ?? '-';
                  final amount = _toDouble(e.value['amount']);
                  final pct = total > 0 ? (amount / total * 100).toStringAsFixed(1) : '0.0';
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(right: 6),
                          decoration: BoxDecoration(
                            color: _chartColors[e.key % _chartColors.length],
                            shape: BoxShape.circle,
                          ),
                        ),
                        Expanded(
                          child: Text(method,
                              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
                              overflow: TextOverflow.ellipsis),
                        ),
                        Text('$pct%',
                            style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
      const _Divider(),
      ...items.asMap().entries.map<Widget>((e) {
        final method = (e.value['method'] as String?) ?? '-';
        final amount = _toDouble(e.value['amount']);
        final count = (e.value['count'] as num?)?.toInt() ?? 0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: _chartColors[e.key % _chartColors.length],
                  shape: BoxShape.circle,
                ),
              ),
              Expanded(child: Text(method, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted))),
              Text('$count txns  ', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
              Text(_currencyFmt.format(amount), style: KTTextStyles.mono.copyWith(color: KTColors.textHeading)),
            ],
          ),
        );
      }),
    ]);
  }

  // ── Section: GST ─────────────────────────────────────────────────────────

  Widget _buildGSTSection(Map<String, dynamic> data) {
    final rows = [
      ('Taxable Value', _toDouble(data['taxable_value'])),
      ('CGST Collected', _toDouble(data['cgst_amount'])),
      ('SGST Collected', _toDouble(data['sgst_amount'])),
      ('IGST Collected', _toDouble(data['igst_amount'])),
    ];
    final netGst = _toDouble(data['net_gst_payable']);

    return _SectionCard(children: [
      ...rows.map((r) => _SummaryRow(label: r.$1, value: _currencyFmt.format(r.$2))),
      const _Divider(),
      Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        margin: const EdgeInsets.only(top: 4),
        decoration: BoxDecoration(
          color: KTColors.warningBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: KTColors.warning.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Net GST Payable',
                style: KTTextStyles.h3.copyWith(color: KTColors.warning)),
            Text(_currencyFmt.format(netGst),
                style: KTTextStyles.mono.copyWith(
                    color: KTColors.warning, fontWeight: FontWeight.bold, fontSize: 15)),
          ],
        ),
      ),
    ]);
  }

  // ── Section: Outstanding ─────────────────────────────────────────────────

  Widget _buildOutstandingSection(Map<String, dynamic> data) {
    final total = _toDouble(data['total_outstanding']);
    final buckets = [
      (
        'Overdue',
        _toDouble(data['overdue_amount']),
        (data['overdue_count'] as num?)?.toInt() ?? 0,
        KTColors.dangerBg,
        KTColors.danger
      ),
      (
        'Partially Paid',
        _toDouble(data['partially_paid_amount']),
        (data['partially_paid_count'] as num?)?.toInt() ?? 0,
        KTColors.warningBg,
        KTColors.warning
      ),
      (
        'Disputed',
        _toDouble(data['disputed_amount']),
        (data['disputed_count'] as num?)?.toInt() ?? 0,
        KTColors.infoBg,
        KTColors.info
      ),
    ];

    return _SectionCard(children: [
      Row(
        children: buckets.map<Widget>((b) => Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: b.$4,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: b.$5.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(b.$1, style: KTTextStyles.bodySmall.copyWith(color: b.$5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(_currencyFmt.format(b.$2),
                    style: KTTextStyles.mono.copyWith(color: b.$5, fontWeight: FontWeight.bold)),
                Text('${b.$3} invoices', style: KTTextStyles.bodySmall.copyWith(color: b.$5.withValues(alpha: 0.8), fontSize: 11)),
              ],
            ),
          ),
        )).toList(),
      ),
      const _Divider(),
      _SummaryRow(label: 'Total Outstanding', value: _currencyFmt.format(total), bold: true, valueColor: KTColors.textHeading),
    ]);
  }

  // ── Section: TDS ─────────────────────────────────────────────────────────

  Widget _buildTDSSection(Map<String, dynamic> data) {
    final total = _toDouble(data['total_tds_deducted']);
    final count = (data['payment_count'] as num?)?.toInt() ?? 0;
    return _SectionCard(children: [
      _SummaryRow(label: 'Total TDS Deducted', value: _currencyFmt.format(total), valueColor: KTColors.roleManager, bold: true),
      const _Divider(),
      _SummaryRow(label: 'Payments with TDS', value: '$count payments', valueColor: KTColors.textMuted),
    ]);
  }

  // ── Section: Ledger ───────────────────────────────────────────────────────

  static const _ledgerTypes = ['ALL', 'RECEIVABLE', 'PAYABLE', 'INCOME', 'EXPENSE'];
  static const _typeColors = {
    'INCOME': KTColors.success,
    'EXPENSE': KTColors.danger,
    'RECEIVABLE': KTColors.info,
    'PAYABLE': KTColors.warning,
  };

  Widget _buildLedgerSection(Map<String, dynamic> ledgerData) {
    final entries = (ledgerData['entries'] as List?) ?? [];
    final totalPages = (ledgerData['total_pages'] as num?)?.toInt() ?? 1;
    final page = (ledgerData['page'] as num?)?.toInt() ?? 1;
    final total = (ledgerData['total'] as num?)?.toInt() ?? 0;

    final filtered = _ledgerFilter == 'ALL'
        ? entries
        : entries.where((e) => e['ledger_type'] == _ledgerFilter).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _ledgerTypes.map((t) {
              final selected = _ledgerFilter == t;
              return GestureDetector(
                onTap: () => setState(() { _ledgerFilter = t; _ledgerPage = 1; }),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8, bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: selected ? KTColors.acctAccent : KTColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: selected ? KTColors.acctAccent : KTColors.borderColor),
                  ),
                  child: Text(
                    t == 'ALL' ? 'All' : '${t[0]}${t.substring(1).toLowerCase()}',
                    style: KTTextStyles.bodySmall.copyWith(
                      color: selected ? Colors.white : KTColors.textMuted,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        if (filtered.isEmpty)
          _SectionCard(children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No ledger entries found.',
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            ),
          ])
        else
          _SectionCard(
            children: filtered.map<Widget>((e) {
              final debit = _toDouble(e['debit']);
              final credit = _toDouble(e['credit']);
              final balance = _toDouble(e['balance']);
              final type = (e['ledger_type'] as String?) ?? '';
              final typeColor = _typeColors[type] ?? KTColors.textMuted;
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // left: date + type badge
                        SizedBox(
                          width: 72,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e['entry_date'] ?? '',
                                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontSize: 11),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: typeColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  type.length > 8 ? '${type.substring(0, 8)}..' : type,
                                  style: TextStyle(color: typeColor, fontSize: 10, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // middle: account + narration
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e['account_name'] ?? '',
                                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if ((e['narration'] as String?)?.isNotEmpty == true)
                                Text(
                                  e['narration'] as String,
                                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontSize: 11),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                        // right: debit/credit/balance
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (debit > 0)
                              Text(
                                '+${_currencyFmt.format(debit)}',
                                style: KTTextStyles.mono.copyWith(color: KTColors.success, fontSize: 12),
                              ),
                            if (credit > 0)
                              Text(
                                '-${_currencyFmt.format(credit)}',
                                style: KTTextStyles.mono.copyWith(color: KTColors.danger, fontSize: 12),
                              ),
                            Text(
                              _currencyFmt.format(balance),
                              style: KTTextStyles.mono.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (filtered.last != e)
                    const Divider(color: KTColors.borderColor, height: 1),
                ],
              );
            }).toList(),
          ),

        // Pagination
        if (totalPages > 1)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Page $page of $totalPages  ($total entries)',
                    style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                Row(
                  children: [
                    _PagBtn(
                      label: '← Prev',
                      enabled: _ledgerPage > 1,
                      onTap: () => setState(() => _ledgerPage--),
                    ),
                    const SizedBox(width: 8),
                    _PagBtn(
                      label: 'Next →',
                      enabled: _ledgerPage < totalPages,
                      onTap: () => setState(() => _ledgerPage++),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _buildSectionHeader(String title, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Text(title, style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
        ],
      ),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}

// ---------------------------------------------------------------------------
// Small widget helpers (private to this file)
// ---------------------------------------------------------------------------

class _PeriodPill extends StatelessWidget {
  final String from;
  final String to;
  const _PeriodPill({required this.from, required this.to});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Report Period',
              style: const TextStyle(color: KTColors.textMuted, fontSize: 12)),
          Text('$from → $to',
              style: const TextStyle(
                  color: KTColors.textHeading, fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;
  final bool large;
  const _SummaryRow({required this.label, required this.value, this.valueColor, this.bold = false, this.large = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: KTColors.textMuted, fontSize: bold ? 14 : 13)),
          Text(value,
              style: TextStyle(
                  color: valueColor ?? KTColors.textHeading,
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  fontSize: large ? 17 : 14)),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => const Divider(color: KTColors.borderColor, height: 1);
}

class _KPICard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _KPICard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, style: const TextStyle(color: KTColors.textMuted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PagBtn extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback onTap;
  const _PagBtn({required this.label, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: enabled ? KTColors.acctAccent : KTColors.borderColor,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style: TextStyle(
                color: enabled ? Colors.white : KTColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      ),
    );
  }
}
