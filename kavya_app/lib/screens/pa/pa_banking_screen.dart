import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/notification_bell_widget.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

const _kPaAccent = Color(0xFFDC4B2A);

final _myBankingEntriesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/banking/entries', queryParameters: {'my_entries': true});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

final _approvedBankingEntriesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response =
      await api.get('/banking/entries', queryParameters: {'status': 'approved'});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

final _bankAccountsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/banking/accounts');
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

class PABankingScreen extends ConsumerStatefulWidget {
  const PABankingScreen({super.key});

  @override
  ConsumerState<PABankingScreen> createState() => _PABankingScreenState();
}

class _PABankingScreenState extends ConsumerState<PABankingScreen> {
  int _activeTab = 0; // 0 = My Entries, 1 = Approved

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.darkBg,
      body: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverAppBar(
            pinned: true,
            backgroundColor: KTColors.darkSurface,
            surfaceTintColor: Colors.transparent,
            title: Text('Banking',
                style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
            actions: const [NotificationBellWidget()],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(58),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: _SegmentedToggle(
                  labels: const ['My Entries', 'Approved'],
                  active: _activeTab,
                  onChanged: (i) => setState(() => _activeTab = i),
                ),
              ),
            ),
          ),
        ],
        body: IndexedStack(
          index: _activeTab,
          children: [
            _EntriesTab(provider: _myBankingEntriesProvider),
            _EntriesTab(provider: _approvedBankingEntriesProvider),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: _kPaAccent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Entry',
            style: TextStyle(fontWeight: FontWeight.w700)),
        onPressed: () => _showNewEntrySheet(context),
      ),
    );
  }

  void _showNewEntrySheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _NewBankingEntrySheet(
        onSaved: () {
          ref.invalidate(_myBankingEntriesProvider);
          ref.invalidate(_approvedBankingEntriesProvider);
        },
      ),
    );
  }
}

// ── Segmented Toggle ──────────────────────────────────────────────────────────

class _SegmentedToggle extends StatelessWidget {
  final List<String> labels;
  final int active;
  final void Function(int) onChanged;

  const _SegmentedToggle({
    required this.labels,
    required this.active,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: KTColors.darkBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: List.generate(labels.length, (i) {
          final isActive = i == active;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: isActive ? _kPaAccent : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  labels[i],
                  style: TextStyle(
                    color: isActive ? Colors.white : KTColors.darkTextSecondary,
                    fontSize: 13,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Entries Tab ───────────────────────────────────────────────────────────────

class _EntriesTab extends ConsumerWidget {
  final ProviderBase<AsyncValue<List<dynamic>>> provider;
  const _EntriesTab({required this.provider});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncValue = ref.watch(provider);

    return asyncValue.when(
      loading: () => const KTLoadingShimmer(type: ShimmerType.list),
      error: (e, _) =>
          KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(provider)),
      data: (entries) {
        if (entries.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.account_balance_outlined,
                    size: 52,
                    color: KTColors.darkTextSecondary.withValues(alpha: 0.4)),
                const SizedBox(height: 12),
                Text('No entries found',
                    style: KTTextStyles.body
                        .copyWith(color: KTColors.darkTextSecondary)),
              ],
            ),
          );
        }

        // Compute totals
        double totalCredit = 0, totalDebit = 0;
        for (final e in entries) {
          final rawAmt = (e as Map)['amount'];
          final amount = rawAmt is num ? rawAmt.toDouble() : double.tryParse(rawAmt?.toString() ?? '') ?? 0.0;
          if (e['transaction_type'] == 'credit') {
            totalCredit += amount;
          } else {
            totalDebit += amount;
          }
        }

        return RefreshIndicator(
          color: _kPaAccent,
          backgroundColor: KTColors.darkSurface,
          onRefresh: () async => ref.invalidate(provider),
          child: CustomScrollView(
            slivers: [
              // Summary strip
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: KTColors.darkSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: KTColors.darkBorder),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _SummaryCell(
                            label: 'Total Credit',
                            value: '₹${totalCredit.toStringAsFixed(0)}',
                            color: KTColors.success),
                      ),
                      Container(
                          width: 1, height: 36, color: KTColors.darkBorder),
                      Expanded(
                        child: _SummaryCell(
                            label: 'Total Debit',
                            value: '₹${totalDebit.toStringAsFixed(0)}',
                            color: KTColors.danger),
                      ),
                      Container(
                          width: 1, height: 36, color: KTColors.darkBorder),
                      Expanded(
                        child: _SummaryCell(
                          label: 'Net',
                          value:
                              '₹${(totalCredit - totalDebit).abs().toStringAsFixed(0)}',
                          color: totalCredit >= totalDebit
                              ? KTColors.success
                              : KTColors.danger,
                          prefix: totalCredit >= totalDebit ? '+' : '-',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                sliver: SliverList.builder(
                  itemCount: entries.length,
                  itemBuilder: (context, i) {
                    final entry =
                        Map<String, dynamic>.from(entries[i] as Map);
                    return _BankingEntryCard(entry: entry);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SummaryCell extends StatelessWidget {
  final String label, value;
  final Color color;
  final String prefix;

  const _SummaryCell({
    required this.label,
    required this.value,
    required this.color,
    this.prefix = '',
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$prefix$value',
            style: KTTextStyles.body.copyWith(
                color: color, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(label,
            style: KTTextStyles.caption
                .copyWith(color: KTColors.darkTextSecondary)),
      ],
    );
  }
}

// ── Banking Entry Card ────────────────────────────────────────────────────────

class _BankingEntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _BankingEntryCard({required this.entry});

  Color _statusColor(String? s) {
    switch (s) {
      case 'approved': return KTColors.success;
      case 'pending': return KTColors.warning;
      case 'rejected': return KTColors.danger;
      default: return KTColors.darkTextSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = entry['status'] as String?;
    final rawAmt = entry['amount'];
    final amount = rawAmt is num ? rawAmt.toDouble() : double.tryParse(rawAmt?.toString() ?? '') ?? 0.0;
    final type = entry['transaction_type'] as String?;
    final isCredit = type == 'credit';
    final amountColor = isCredit ? KTColors.success : KTColors.danger;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.darkBorder),
      ),
      child: Row(
        children: [
          // Icon bubble
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: amountColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isCredit ? Icons.south_west_rounded : Icons.north_east_rounded,
              color: amountColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry['description'] ??
                      entry['reference_number'] ??
                      '—',
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.darkTextPrimary,
                      fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  entry['account_name'] ??
                      entry['reference_number'] ??
                      '',
                  style: KTTextStyles.caption.copyWith(
                      color: KTColors.darkTextSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Amount + status
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '-'}₹${amount.toStringAsFixed(0)}',
                style: KTTextStyles.body.copyWith(
                    color: amountColor, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(status).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status ?? '',
                  style: TextStyle(
                      color: _statusColor(status),
                      fontSize: 10,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── New Banking Entry Bottom Sheet ────────────────────────────────────────────

class _NewBankingEntrySheet extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _NewBankingEntrySheet({required this.onSaved});

  @override
  ConsumerState<_NewBankingEntrySheet> createState() =>
      _NewBankingEntrySheetState();
}

class _NewBankingEntrySheetState
    extends ConsumerState<_NewBankingEntrySheet> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _referenceCtrl = TextEditingController();
  // entry_type: PAYMENT_MADE (debit) or PAYMENT_RECEIVED (credit) or CASH_DEPOSIT, etc.
  String _entryType = 'PAYMENT_MADE';
  int? _selectedAccountId;
  bool _saving = false;

  static const _entryTypes = [
    ('PAYMENT_MADE', 'Payment Made (Debit)'),
    ('PAYMENT_RECEIVED', 'Payment Received (Credit)'),
    ('CASH_DEPOSIT', 'Cash Deposit'),
    ('CASH_WITHDRAWAL', 'Cash Withdrawal'),
    ('BANK_TRANSFER', 'Bank Transfer'),
    ('JOURNAL_ENTRY', 'Journal Entry'),
  ];

  @override
  void dispose() {
    _descCtrl.dispose();
    _amountCtrl.dispose();
    _referenceCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedAccountId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please select a bank account'),
            backgroundColor: KTColors.danger),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);
      final rupees = double.parse(_amountCtrl.text.trim());
      final today = DateTime.now();
      final dateStr =
          '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      await api.post('/banking/entries', data: {
        'account_id': _selectedAccountId,
        'entry_date': dateStr,
        'entry_type': _entryType,
        'amount_paise': (rupees * 100).round(),
        'description': _descCtrl.text.trim(),
        'reference_no': _referenceCtrl.text.trim().isEmpty ? null : _referenceCtrl.text.trim(),
      });
      widget.onSaved();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Entry submitted for approval'),
              backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: $e'),
              backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 16 + bottomPadding),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: KTColors.darkBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('New Banking Entry',
                style: KTTextStyles.h2
                    .copyWith(color: KTColors.darkTextPrimary)),
            const SizedBox(height: 16),

            // Bank account selector
            Consumer(builder: (context, ref, _) {
              final accountsAsync = ref.watch(_bankAccountsProvider);
              return accountsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => Text('Could not load accounts: $e',
                    style: const TextStyle(color: KTColors.danger, fontSize: 12)),
                data: (accounts) => DropdownButtonFormField<int>(
                  initialValue: _selectedAccountId,
                  dropdownColor: KTColors.darkSurface,
                  style: const TextStyle(color: KTColors.darkTextPrimary),
                  decoration: InputDecoration(
                    labelText: 'Bank Account *',
                    labelStyle: const TextStyle(color: KTColors.darkTextSecondary),
                    filled: true,
                    fillColor: KTColors.darkBg,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: KTColors.darkBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: _kPaAccent, width: 1.5),
                    ),
                  ),
                  items: accounts.map<DropdownMenuItem<int>>((a) {
                    final acc = a as Map;
                    return DropdownMenuItem<int>(
                      value: acc['id'] as int,
                      child: Text(acc['account_name'] ?? '—',
                          style: const TextStyle(color: KTColors.darkTextPrimary)),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedAccountId = v),
                  hint: const Text('Select account',
                      style: TextStyle(color: KTColors.darkTextSecondary)),
                ),
              );
            }),
            const SizedBox(height: 10),

            // Entry type dropdown
            DropdownButtonFormField<String>(
              initialValue: _entryType,
              dropdownColor: KTColors.darkSurface,
              style: const TextStyle(color: KTColors.darkTextPrimary),
              decoration: InputDecoration(
                labelText: 'Entry Type *',
                labelStyle: const TextStyle(color: KTColors.darkTextSecondary),
                filled: true,
                fillColor: KTColors.darkBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: KTColors.darkBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: _kPaAccent, width: 1.5),
                ),
              ),
              items: _entryTypes.map((e) => DropdownMenuItem(
                value: e.$1,
                child: Text(e.$2, style: const TextStyle(color: KTColors.darkTextPrimary)),
              )).toList(),
              onChanged: (v) => setState(() => _entryType = v ?? _entryType),
            ),
            const SizedBox(height: 10),

            _f('Description', _descCtrl),
            _f('Amount (₹)', _amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (double.tryParse(v) == null) return 'Invalid amount';
                  return null;
                }),
            _f('Reference / UTR Number', _referenceCtrl, required: false),

            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPaAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Submit for Approval',
                        style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _f(
    String label,
    TextEditingController ctrl, {
    TextInputType keyboardType = TextInputType.text,
    bool required = true,
    String? Function(String?)? validator,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextFormField(
          controller: ctrl,
          keyboardType: keyboardType,
          style: const TextStyle(color: KTColors.darkTextPrimary),
          decoration: InputDecoration(
            labelText: label,
            labelStyle:
                const TextStyle(color: KTColors.darkTextSecondary),
            filled: true,
            fillColor: KTColors.darkBg,
            border:
                OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: KTColors.darkBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: _kPaAccent, width: 1.5),
            ),
          ),
          validator: validator ??
              (required
                  ? (v) => (v == null || v.trim().isEmpty)
                      ? '$label is required'
                      : null
                  : null),
        ),
      );
}


