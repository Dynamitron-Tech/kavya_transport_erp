import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _vouchersProvider =
    FutureProvider.autoDispose.family<List<dynamic>, String?>((ref, type) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.get('/accountant/vouchers',
      queryParameters: {if (type != null) 'voucher_type': type});
  if (result is Map && result['data'] is List) return result['data'];
  return [];
});

class AccountantVouchersScreen extends ConsumerStatefulWidget {
  const AccountantVouchersScreen({super.key});

  @override
  ConsumerState<AccountantVouchersScreen> createState() =>
      _AccountantVouchersScreenState();
}

class _AccountantVouchersScreenState
    extends ConsumerState<AccountantVouchersScreen> {
  String? _typeFilter;
  final _currencyFmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_vouchersProvider(_typeFilter));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        title: const Text('Vouchers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showCreateVoucherSheet(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Type filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _chip('All', null),
                _chip('Receipt', 'receipt'),
                _chip('Payment', 'payment'),
                _chip('Journal', 'journal'),
              ],
            ),
          ),
          Expanded(
            child: state.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list),
              error: (e, _) => KTErrorState(
                  message: e.toString(),
                  onRetry: () =>
                      ref.invalidate(_vouchersProvider(_typeFilter))),
              data: (vouchers) {
                if (vouchers.isEmpty) {
                  return const KTEmptyState(
                    title: 'No vouchers',
                    subtitle: 'Create a payment or receipt voucher to get started.',
                    lottieAsset: 'assets/lottie/empty_box.json',
                  );
                }
                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async =>
                      ref.invalidate(_vouchersProvider(_typeFilter)),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: vouchers.length,
                    itemBuilder: (context, i) => _VoucherTile(
                        voucher: vouchers[i], fmt: _currencyFmt),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, String? value) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: FilterChip(
          label: Text(label),
          selected: _typeFilter == value,
          onSelected: (_) => setState(() => _typeFilter = value),
        ),
      );

  Future<void> _showCreateVoucherSheet(BuildContext ctx) async {
    String voucherType = 'receipt';
    final amountCtrl = TextEditingController();
    final partyCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String payMethod = 'bank_transfer';

    await showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx2) => StatefulBuilder(
        builder: (ctx2, setModalState) => Padding(
          padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx2).viewInsets.bottom,
              left: 16, right: 16, top: 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Create Voucher', style: KTTextStyles.h3),
            const SizedBox(height: 16),
            // Voucher type toggle
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'receipt', label: Text('Receipt')),
                ButtonSegment(value: 'payment', label: Text('Payment')),
                ButtonSegment(value: 'journal', label: Text('Journal')),
              ],
              selected: {voucherType},
              onSelectionChanged: (s) =>
                  setModalState(() => voucherType = s.first),
            ),
            const SizedBox(height: 12),
            TextField(
                controller: partyCtrl,
                decoration:
                    const InputDecoration(labelText: 'Party / Account Name')),
            const SizedBox(height: 12),
            TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (₹)')),
            const SizedBox(height: 12),
            if (voucherType != 'journal') ...[
              DropdownButtonFormField<String>(
                initialValue: payMethod,
                decoration:
                    const InputDecoration(labelText: 'Payment Method'),
                items: ['bank_transfer', 'cheque', 'cash', 'upi', 'neft', 'rtgs']
                    .map((m) => DropdownMenuItem(
                        value: m,
                        child: Text(m.toUpperCase())))
                    .toList(),
                onChanged: (v) => setModalState(() => payMethod = v!),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
                controller: refCtrl,
                decoration: const InputDecoration(
                    labelText: 'Reference / UTR')),
            const SizedBox(height: 12),
            TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(labelText: 'Narration')),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final api = ref.read(apiServiceProvider);
                  // Build type-appropriate payload — avoid sending fields
                  // that are invalid on the target model (Payment vs LedgerEntry)
                  final Map<String, dynamic> payload;
                  if (voucherType == 'journal') {
                    payload = {
                      'voucher_type': voucherType,
                      'entry_date': DateTime.now().toIso8601String().substring(0, 10),
                      'account_name': partyCtrl.text,
                      'narration': noteCtrl.text,
                      'debit': double.tryParse(amountCtrl.text) ?? 0,
                      'credit': 0,
                      'ledger_type': 'EXPENSE',
                    };
                  } else {
                    payload = {
                      'voucher_type': voucherType,
                      'payment_date': DateTime.now().toIso8601String().substring(0, 10),
                      'amount': double.tryParse(amountCtrl.text) ?? 0,
                      'payment_method': payMethod,
                      'transaction_ref': refCtrl.text,
                      'remarks': '${partyCtrl.text}${noteCtrl.text.isNotEmpty ? ' — ${noteCtrl.text}' : ''}',
                    };
                  }
                  try {
                    await api.post('/accountant/vouchers', data: payload);
                    if (ctx2.mounted) Navigator.pop(ctx2);
                    ref.invalidate(_vouchersProvider(_typeFilter));
                  } catch (e) {
                    // Use outer screen context so the SnackBar is guaranteed
                    // to appear on the main Scaffold (not inside the modal sheet)
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(content: Text('Error saving voucher: $e')));
                    }
                  }
                },
                child: const Text('Save Voucher'),
              ),
            ),
            const SizedBox(height: 16),
          ]),
        ),
      ),
    );
  }
}

class _VoucherTile extends StatelessWidget {
  final dynamic voucher;
  final NumberFormat fmt;
  const _VoucherTile({required this.voucher, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final v = voucher as Map<String, dynamic>;
    final vType = v['voucher_type'] ?? 'receipt';
    final amount = (v['amount'] as num? ?? v['debit'] as num? ?? 0).toDouble();

    final typeColors = {
      'receipt': KTColors.success,
      'payment': KTColors.danger,
      'journal': KTColors.info,
      'contra': KTColors.warning,
    };
    final typeIcons = {
      'receipt': Icons.arrow_circle_down,
      'payment': Icons.arrow_circle_up,
      'journal': Icons.chrome_reader_mode,
      'contra': Icons.swap_horiz,
    };

    final color = typeColors[vType] ?? KTColors.textMuted;
    final icon = typeIcons[vType] ?? Icons.note;
    final vNo = v['payment_number'] ?? v['entry_number'] ?? '—';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vNo,
                    style: const TextStyle(
                        color: KTColors.acctAccent,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                        fontSize: 13)),
                const SizedBox(height: 3),
                Text(v['remarks'] ?? v['narration'] ?? '—',
                    style: const TextStyle(
                        color: KTColors.textMuted, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text(
                    (v['payment_date'] ?? v['entry_date'] ?? '')
                        .toString()
                        .substring(0, 10),
                    style: const TextStyle(
                        color: KTColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(fmt.format(amount),
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.bold,
                      fontSize: 15)),
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4)),
                child: Text(vType.toUpperCase(),
                    style: TextStyle(
                        color: color,
                        fontSize: 9,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
