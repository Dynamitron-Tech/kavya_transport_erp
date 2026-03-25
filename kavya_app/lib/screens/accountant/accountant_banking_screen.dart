import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

const _bankingTypeMap = {
  'Payment Received': 'PAYMENT_RECEIVED',
  'Payment Made': 'PAYMENT_MADE',
  'Transfer': 'BANK_TRANSFER',
  'Deposit': 'CASH_DEPOSIT',
  'Withdrawal': 'CASH_WITHDRAWAL',
  'Journal': 'JOURNAL_ENTRY',
};

final bankingEntriesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, typeFilter) async {
    final api = ref.read(apiServiceProvider);
    final entryType = _bankingTypeMap[typeFilter];
    final params = entryType != null ? {'entry_type': entryType} : <String, dynamic>{};
    final res = await api.get('/banking/entries', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    return [];
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class AccountantBankingScreen extends ConsumerStatefulWidget {
  const AccountantBankingScreen({super.key});

  @override
  ConsumerState<AccountantBankingScreen> createState() => _AccountantBankingScreenState();
}

class _AccountantBankingScreenState extends ConsumerState<AccountantBankingScreen> {
  String _typeFilter = 'All';
  static const _filters = ['All', 'Payment Received', 'Payment Made', 'Transfer', 'Expense'];

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(bankingEntriesProvider(_typeFilter));
    final accent = KTColors.getRoleColor('accountant');

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text('Banking', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: accent.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: accent.withOpacity(0.4)),
            ),
            child: Text('Finance', style: KTTextStyles.label.copyWith(color: accent)),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: KTColors.acctAccent,
        foregroundColor: Colors.white,
        onPressed: () => _showCreateEntrySheet(context),
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          // ─── Top KPI Cards ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(child: _kpiCard('Total Balance', Icons.account_balance, KTColors.info, isAsync: true)),
                const SizedBox(width: 12),
                Expanded(child: _kpiCard('Today Credits', Icons.arrow_downward, KTColors.success, isAsync: true)),
              ],
            ),
          ),

          // ─── Filter Chips ─────────────────────────────────────────
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _filters[i];
                final selected = _typeFilter == f;
                return FilterChip(
                  label: Text(f),
                  selected: selected,
                  onSelected: (_) => setState(() => _typeFilter = f),
                  labelStyle: KTTextStyles.label.copyWith(
                    color: selected ? KTColors.surface : KTColors.textMuted,
                  ),
                  selectedColor: KTColors.acctAccent,
                  backgroundColor: KTColors.surface,
                  side: BorderSide(color: selected ? KTColors.acctAccent : KTColors.borderColor),
                  showCheckmark: false,
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ─── Entries List ─────────────────────────────────────────
          Expanded(
            child: entriesAsync.when(
              loading: () => ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 5,
                itemBuilder: (_, __) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: KTLoadingShimmer(type: ShimmerType.card),
                ),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
                    const SizedBox(height: 12),
                    Text('Failed to load entries', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 16),
                    KTButton.secondary(
                      onPressed: () => ref.invalidate(bankingEntriesProvider(_typeFilter)),
                      label: 'Retry',
                    ),
                  ],
                ),
              ),
              data: (entries) {
                if (entries.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.account_balance_outlined, color: KTColors.textMuted, size: 64),
                        const SizedBox(height: 16),
                        Text('No Banking Entries', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                        const SizedBox(height: 8),
                        Text('Tap + to add a banking entry.',
                            style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async => ref.invalidate(bankingEntriesProvider(_typeFilter)),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: entries.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _entryCard(entries[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(String label, IconData icon, Color accent, {bool isAsync = false}) {
    return Container(
      padding: const EdgeInsets.all(16),
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
              color: accent.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: accent, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('—', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading, fontSize: 18)),
                Text(label, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _entryCard(Map<String, dynamic> entry) {
    final entryNo = entry['entry_number']?.toString() ?? '—';
    final type = entry['transaction_type']?.toString() ?? entry['type']?.toString() ?? '—';
    final date = entry['entry_date']?.toString() ?? '';
    final description = entry['description']?.toString() ?? '—';
    final amountPaise = (entry['amount_paise'] as num?)?.toInt() ?? (entry['amount'] as num?)?.toInt() ?? 0;
    final isCredit = type.toLowerCase().contains('received') || type.toLowerCase().contains('credit') || type.toLowerCase().contains('deposit');
    final accountName = entry['bank_account_name']?.toString() ?? entry['account_name']?.toString() ?? '—';
    final isReconciled = entry['is_reconciled'] == true;

    final amountColor = isCredit ? KTColors.success : KTColors.danger;
    final amountPrefix = isCredit ? '+₹' : '-₹';
    final amountDisplay = '$amountPrefix${(amountPaise.abs() / 100).toStringAsFixed(2)}';

    Color typeBadgeColor;
    switch (type.toLowerCase()) {
      case 'payment_received':
      case 'payment received':
        typeBadgeColor = KTColors.success;
        break;
      case 'payment_made':
      case 'payment made':
        typeBadgeColor = KTColors.danger;
        break;
      case 'transfer':
        typeBadgeColor = KTColors.info;
        break;
      default:
        typeBadgeColor = KTColors.textMuted;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Entry no + type + date
          Row(
            children: [
              Text(entryNo, style: KTTextStyles.mono.copyWith(color: KTColors.acctAccent)),
              const SizedBox(width: 8),
              KTStatusBadge(label: type, color: typeBadgeColor),
              const Spacer(),
              Text(date, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
            ],
          ),
          const SizedBox(height: 8),

          // Row 2: Description
          Text(description, style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
          const SizedBox(height: 8),

          // Row 3: Amount + Account + Reconciled
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(amountDisplay,
                      style: KTTextStyles.h3.copyWith(color: amountColor, fontWeight: FontWeight.w700)),
                  Text(accountName, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
                ],
              ),
              if (isReconciled)
                KTStatusBadge(label: 'Reconciled', color: KTColors.success),
            ],
          ),
        ],
      ),
    );
  }

  void _showCreateEntrySheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CreateEntrySheet(
        onSaved: () => ref.invalidate(bankingEntriesProvider(_typeFilter)),
      ),
    );
  }
}

// ─── Create Entry Bottom Sheet ───────────────────────────────────────────────

class _CreateEntrySheet extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _CreateEntrySheet({required this.onSaved});

  @override
  ConsumerState<_CreateEntrySheet> createState() => _CreateEntrySheetState();
}

class _CreateEntrySheetState extends ConsumerState<_CreateEntrySheet> {
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;
  bool _loadingAccounts = true;

  String _entryType = 'Payment Received';
  int? _selectedAccountId;
  List<Map<String, dynamic>> _accounts = [];
  final _amountCtrl = TextEditingController();
  String _paymentMethod = 'NEFT';
  final _referenceCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  static const _entryTypes = [
    'Payment Received', 'Payment Made', 'Transfer', 'Deposit', 'Withdrawal', 'Journal'
  ];
  static const _paymentMethods = ['NEFT', 'IMPS', 'UPI', 'Cash', 'Cheque', 'RTGS'];

  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get('/banking/accounts');
      final list = res['data'] as List? ?? [];
      if (mounted) {
        setState(() {
          _accounts = list.cast<Map<String, dynamic>>();
          if (_accounts.isNotEmpty) {
            // Default to the account marked is_default, or the first one
            final defaultAcc = _accounts.firstWhere(
              (a) => a['is_default'] == true,
              orElse: () => _accounts.first,
            );
            _selectedAccountId = defaultAcc['id'] as int?;
          }
          _loadingAccounts = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingAccounts = false);
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _referenceCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedAccountId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a bank account'), backgroundColor: KTColors.danger),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final amountPaise = ((double.tryParse(_amountCtrl.text) ?? 0) * 100).toInt();
      final entryTypeVal = _bankingTypeMap[_entryType] ?? 'PAYMENT_RECEIVED';
      await api.post('/banking/entries', data: {
        'entry_type': entryTypeVal,
        'account_id': _selectedAccountId,
        'amount_paise': amountPaise,
        'payment_method': _paymentMethod.toLowerCase(),
        'reference_no': _referenceCtrl.text,
        'description': _descriptionCtrl.text,
        'entry_date': DateTime.now().toIso8601String().split('T').first,
      });
      if (mounted) {
        Navigator.pop(context);
        widget.onSaved();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Entry saved'), backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: KTColors.borderColor, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Text('New Banking Entry', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
              const SizedBox(height: 16),

              // Entry type
              Text('Entry Type', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _entryType,
                dropdownColor: KTColors.surface,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                decoration: _inputDec('Select type'),
                items: _entryTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => setState(() => _entryType = v ?? _entryType),
              ),
              const SizedBox(height: 12),

              Text('Bank Account', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              _loadingAccounts
                  ? const SizedBox(
                      height: 48,
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : _accounts.isEmpty
                      ? Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: KTColors.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: KTColors.danger),
                          ),
                          child: Text(
                            'No active bank accounts found. Please add a bank account in settings.',
                            style: KTTextStyles.caption.copyWith(color: KTColors.danger),
                          ),
                        )
                      : DropdownButtonFormField<int>(
                          initialValue: _selectedAccountId,
                          dropdownColor: KTColors.surface,
                          style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                          decoration: _inputDec('Select account'),
                          items: _accounts.map((a) => DropdownMenuItem<int>(
                            value: a['id'] as int,
                            child: Text('${a['account_name']} (${a['bank_name']})'),
                          )).toList(),
                          validator: (v) => v == null ? 'Select an account' : null,
                          onChanged: (v) => setState(() => _selectedAccountId = v),
                        ),
              const SizedBox(height: 12),

              Text('Amount (₹)', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _amountCtrl,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: _inputDec('0.00', prefix: '₹'),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (double.tryParse(v) == null) return 'Enter a valid amount';
                  return null;
                },
              ),
              const SizedBox(height: 12),

              Text('Payment Method', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _paymentMethod,
                dropdownColor: KTColors.surface,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                decoration: _inputDec('Select method'),
                items: _paymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                onChanged: (v) => setState(() => _paymentMethod = v ?? _paymentMethod),
              ),
              const SizedBox(height: 12),

              Text('Reference Number', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _referenceCtrl,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                decoration: _inputDec('UTR / Cheque no.'),
              ),
              const SizedBox(height: 12),

              Text('Description', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _descriptionCtrl,
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                maxLines: 2,
                decoration: _inputDec('Details…'),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 24),

              KTButton.primary(
                onPressed: (_submitting || _loadingAccounts) ? null : _save,
                label: 'Save Entry',
                isLoading: _submitting,
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDec(String hint, {String? prefix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
      prefixText: prefix,
      prefixStyle: KTTextStyles.body.copyWith(color: KTColors.acctAccent),
      filled: true,
      fillColor: KTColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.acctAccent)),
    );
  }
}
