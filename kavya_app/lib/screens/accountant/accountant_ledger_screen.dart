import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _ledgerProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, typeFilter) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.get('/accountant/ledger',
      queryParameters: {
        if (typeFilter.isNotEmpty) 'ledger_type': typeFilter,
      });
  if (result is Map<String, dynamic>) return result;
  return {'data': []};
});

class AccountantLedgerScreen extends ConsumerStatefulWidget {
  const AccountantLedgerScreen({super.key});

  @override
  ConsumerState<AccountantLedgerScreen> createState() =>
      _AccountantLedgerScreenState();
}

class _AccountantLedgerScreenState
    extends ConsumerState<AccountantLedgerScreen> {
  String? _typeFilter;
  final _currencyFmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  final _types = ['receivable', 'payable', 'expense', 'income', 'capital'];

  @override
  Widget build(BuildContext context) {
    final typeKey = _typeFilter ?? '';
    final state = ref.watch(_ledgerProvider(typeKey));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        title: const Text('Ledger'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showAddEntrySheet(context),
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
                ..._types.map((t) => _chip(t[0].toUpperCase() + t.substring(1), t)),
              ],
            ),
          ),
          Expanded(
            child: state.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list),
              error: (e, _) => KTErrorState(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(_ledgerProvider(typeKey))),
              data: (result) {
                final entries =
                    (result['data'] as List? ?? []).cast<Map<String, dynamic>>();
                if (entries.isEmpty) {
                  return const KTEmptyState(
                    title: 'No ledger entries',
                    subtitle: 'Entries appear here after invoice/payment activity.',
                  );
                }
                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async =>
                      ref.invalidate(_ledgerProvider(typeKey)),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: entries.length,
                    itemBuilder: (context, i) =>
                        _LedgerTile(entry: entries[i], fmt: _currencyFmt),
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

  Future<void> _showAddEntrySheet(BuildContext context) async {
    final accountCtrl = TextEditingController();
    final debitCtrl = TextEditingController();
    final creditCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String selectedType = 'EXPENSE';

    const typeOptions = [
      ('RECEIVABLE', 'Receivable'),
      ('PAYABLE', 'Payable'),
      ('INCOME', 'Income'),
      ('EXPENSE', 'Expense'),
      ('ASSET', 'Asset'),
      ('LIABILITY', 'Liability'),
    ];

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
              left: 16, right: 16, top: 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('New Ledger Entry', style: KTTextStyles.h3),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: selectedType,
              decoration: const InputDecoration(labelText: 'Entry Type'),
              items: typeOptions.map((t) => DropdownMenuItem(
                value: t.$1,
                child: Text(t.$2),
              )).toList(),
              onChanged: (v) => setModalState(() => selectedType = v ?? 'EXPENSE'),
            ),
            const SizedBox(height: 12),
            TextField(controller: accountCtrl, decoration: const InputDecoration(labelText: 'Account Name')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: debitCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Debit (₹)'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: creditCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Credit (₹)'))),
            ]),
            const SizedBox(height: 12),
            TextField(controller: noteCtrl, decoration: const InputDecoration(labelText: 'Narration')),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final api = ref.read(apiServiceProvider);
                  try {
                    await api.post('/accountant/ledger', data: {
                      'account_name': accountCtrl.text,
                      'ledger_type': selectedType,
                      'debit': double.tryParse(debitCtrl.text) ?? 0,
                      'credit': double.tryParse(creditCtrl.text) ?? 0,
                      'narration': noteCtrl.text,
                      'entry_date': DateTime.now().toIso8601String().substring(0, 10),
                      'reference_type': 'manual',
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                    ref.invalidate(_ledgerProvider(_typeFilter ?? ''));
                  } catch (e) {
                    if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Error: $e')));
                  }
                },
                child: const Text('Save Entry'),
              ),
            ),
            const SizedBox(height: 16),
          ]),
        ),
      ),
    );
  }

  Map<String, String?> get params => {'type': _typeFilter};
}

class _LedgerTile extends StatelessWidget {
  final Map<String, dynamic> entry;
  final NumberFormat fmt;
  const _LedgerTile({required this.entry, required this.fmt});

  static double _toDouble(dynamic v) =>
      v == null ? 0.0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0.0);

  @override
  Widget build(BuildContext context) {
    final debit = _toDouble(entry['debit']);
    final credit = _toDouble(entry['credit']);
    final isDebit = debit > 0;
    final amount = isDebit ? debit : credit;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (isDebit ? KTColors.success : KTColors.danger)
                  .withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isDebit ? Icons.arrow_downward : Icons.arrow_upward,
              color: isDebit ? KTColors.success : KTColors.danger,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry['account_name'] ?? '—',
                    style: const TextStyle(
                        color: KTColors.textHeading,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                const SizedBox(height: 2),
                Text(entry['narration'] ?? '',
                    style: const TextStyle(
                        color: KTColors.textMuted, fontSize: 12)),
                Text(entry['entry_date']?.toString().substring(0, 10) ?? '',
                    style: const TextStyle(
                        color: KTColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(amount),
                style: TextStyle(
                    color: isDebit ? KTColors.success : KTColors.danger,
                    fontWeight: FontWeight.bold,
                    fontSize: 15),
              ),
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: (isDebit ? KTColors.success : KTColors.danger)
                        .withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4)),
                child: Text(
                  isDebit ? 'DR' : 'CR',
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: isDebit ? KTColors.success : KTColors.danger),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
