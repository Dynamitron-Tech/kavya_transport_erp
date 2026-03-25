import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final _invoiceDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, invoiceId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/finance/invoices/$invoiceId');
  if (resp is Map<String, dynamic> && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  if (resp is Map<String, dynamic>) return resp;
  return {};
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class AdminInvoiceDetailScreen extends ConsumerWidget {
  final String invoiceId;
  const AdminInvoiceDetailScreen({super.key, required this.invoiceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_invoiceDetailProvider(invoiceId));

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
                border: Border(bottom: BorderSide(color: KTColors.borderColor)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Text('Invoice detail',
                        style: TextStyle(color: KTColors.textHeading, fontSize: 17, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: detail.when(
        data: (d) {
          if (d.isEmpty) {
            return const Center(
                child: Text('Invoice not found',
                    style: TextStyle(color: KTColors.textMuted)));
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(_invoiceDetailProvider(invoiceId)),
            child: _body(context, ref, d),
          );
        },
        loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.primary)),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: KTColors.textMuted))),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, Map<String, dynamic> d) {
    final invNumber = d['invoice_number'] as String? ?? '—';
    final status = (d['status'] as String? ?? 'DRAFT').toUpperCase();
    final clientName = d['client_name'] as String? ?? d['billing_name'] as String? ?? '—';
    final issueDate = _fmtDate(d['issue_date'] ?? d['created_at']);
    final dueDate = _fmtDate(d['due_date']);
    final subtotal = _safeDouble(d['subtotal'] ?? d['base_amount']);
    final gst = _safeDouble(d['gst_amount'] ?? d['tax_amount']);
    final total = _safeDouble(d['total_amount'] ?? d['grand_total']);
    final paidAmount = _safeDouble(d['paid_amount']);
    final balance = total - paidAmount;

    final isPaid = status == 'PAID';
    final isOverdue = status == 'OVERDUE';

    // Line items
    final lineItems = d['line_items'] as List? ?? d['items'] as List? ?? [];

    // Payment history
    final payments = d['payments'] as List? ?? d['payment_history'] as List? ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header card ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(invNumber,
                        style: const TextStyle(
                            color: KTColors.textHeading,
                            fontSize: 18,
                            fontWeight: FontWeight.bold)),
                  ),
                  _statusPill(status, isPaid
                      ? KTColors.success
                      : isOverdue
                          ? KTColors.danger
                          : KTColors.info),
                ],
              ),
              const SizedBox(height: 8),
              _headerRow('Client', clientName),
              _headerRow('Issue date', issueDate),
              _headerRow('Due date', dueDate),
              const Divider(color: KTColors.borderColor, height: 20),
              _headerRow('Subtotal', _fmtAmt(subtotal)),
              _headerRow('GST', _fmtAmt(gst)),
              _headerRow('Total', _fmtAmt(total),
                  bold: true, color: KTColors.textHeading),
              if (!isPaid) ...[
                const Divider(color: KTColors.borderColor, height: 20),
                _headerRow('Paid', _fmtAmt(paidAmount),
                    color: KTColors.success),
                _headerRow('Balance', _fmtAmt(balance),
                    bold: true, color: KTColors.danger),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Line items ──
        if (lineItems.isNotEmpty) ...[
          _sectionHead('LINE ITEMS'),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: lineItems.map<Widget>((item) {
                final m = item as Map<String, dynamic>;
                final desc = m['description'] as String? ?? m['item'] as String? ?? '—';
                final qty = _safeDouble(m['quantity'] ?? 1);
                final rate = _safeDouble(m['rate'] ?? m['unit_price']);
                final amt = _safeDouble(m['amount'] ?? m['total']);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(desc,
                          style: const TextStyle(
                              color: KTColors.textHeading, fontSize: 13)),
                      Row(
                        children: [
                          Text('${qty.toStringAsFixed(0)} × ${_fmtAmt(rate)}',
                              style: const TextStyle(
                                  color: KTColors.textMuted,
                                  fontSize: 12)),
                          const Spacer(),
                          Text(_fmtAmt(amt),
                              style: const TextStyle(
                                  color: KTColors.textHeading,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13)),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Payment history ──
        if (payments.isNotEmpty) ...[
          _sectionHead('PAYMENT HISTORY'),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: payments.map<Widget>((p) {
                final m = p as Map<String, dynamic>;
                final amt = _fmtAmt(_safeDouble(m['amount']));
                final date = _fmtDate(m['payment_date'] ?? m['created_at']);
                final method = m['payment_method'] as String? ?? m['mode'] as String? ?? '—';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle,
                          color: KTColors.success, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('$amt via $method',
                                style: const TextStyle(
                                    color: KTColors.textHeading,
                                    fontSize: 13)),
                            Text(date,
                                style: const TextStyle(
                                    color: KTColors.textMuted,
                                    fontSize: 11)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Actions ──
        if (!isPaid) ...[
          _actionBtn('Send reminder', Icons.notifications_active,
              KTColors.amber600, () async {
            final api = ref.read(apiServiceProvider);
            try {
              await api.post('/finance/invoices/$invoiceId/send');
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Reminder sent')),
                );
              }
            } catch (_) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to send reminder')),
                );
              }
            }
          }),
          const SizedBox(height: 10),
          _actionBtn('Record payment', Icons.payment, KTColors.success, () {
            _showRecordPayment(context, ref, balance);
          }),
          const SizedBox(height: 10),
        ],
        _actionBtn('Download PDF', Icons.picture_as_pdf, KTColors.info, () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('PDF download coming soon')),
          );
        }),
        const SizedBox(height: 30),
      ],
    );
  }

  void _showRecordPayment(
      BuildContext context, WidgetRef ref, double balance) {
    final amtCtrl = TextEditingController(text: balance.toStringAsFixed(0));
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Record payment',
                style: TextStyle(
                    color: KTColors.textHeading,
                    fontSize: 16,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: amtCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: KTColors.textHeading),
              decoration: InputDecoration(
                labelText: 'Amount (₹)',
                labelStyle:
                    const TextStyle(color: KTColors.textMuted),
                filled: true,
                fillColor: KTColors.lightBg,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.success,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () async {
                  Navigator.pop(ctx);
                  final api = ref.read(apiServiceProvider);
                  final amount =
                      double.tryParse(amtCtrl.text) ?? 0;
                  if (amount <= 0) return;
                  try {
                    await api.post(
                      '/finance/payments',
                      data: {'invoice_id': invoiceId, 'amount': amount},
                    );
                    ref.invalidate(_invoiceDetailProvider(invoiceId));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Payment recorded')),
                      );
                    }
                  } catch (_) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Failed to record payment')),
                      );
                    }
                  }
                },
                child: const Text('Submit',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _headerRow(String label, String value,
      {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: KTColors.textMuted, fontSize: 13)),
          Text(value,
              style: TextStyle(
                  color: color ?? KTColors.textMuted,
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  fontSize: 13)),
        ],
      ),
    );
  }

  Widget _statusPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  Widget _sectionHead(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style: const TextStyle(
                color: KTColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );

  Widget _actionBtn(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 14)),
          ],
        ),
      ),
    );
  }

  String _fmtDate(dynamic val) {
    if (val == null) return '—';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(val.toString()));
    } catch (_) {
      return val.toString();
    }
  }

  String _fmtAmt(double val) {
    if (val >= 100000) return '₹${(val / 100000).toStringAsFixed(1)}L';
    if (val >= 1000) return '₹${NumberFormat('#,##0').format(val)}';
    return '₹${val.toStringAsFixed(0)}';
  }

  double _safeDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0.0;
  }
}
