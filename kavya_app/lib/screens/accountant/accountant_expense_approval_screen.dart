import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _accountantExpensesProvider =
    FutureProvider.autoDispose.family<List<dynamic>, String>((ref, status) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.getAccountantExpenses(status: status == 'all' ? null : status);
  final data = result['data'];
  if (data is List) return data;
  return [];
});

class AccountantExpenseApprovalScreen extends ConsumerStatefulWidget {
  const AccountantExpenseApprovalScreen({super.key});

  @override
  ConsumerState<AccountantExpenseApprovalScreen> createState() =>
      _AccountantExpenseApprovalScreenState();
}

class _AccountantExpenseApprovalScreenState
    extends ConsumerState<AccountantExpenseApprovalScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _tabs = const ['pending', 'approved', 'paid', 'rejected'];
  final _tabLabels = const ['Pending', 'Approved', 'Paid', 'Rejected'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _invalidateAll() {
    for (final t in _tabs) {
      ref.invalidate(_accountantExpensesProvider(t));
    }
  }

  Future<void> _handleApprove(dynamic id) async {
    try {
      await ref.read(apiServiceProvider).approveExpense(id.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Expense approved'), backgroundColor: KTColors.success),
        );
        _invalidateAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  Future<void> _handleMarkPaid(dynamic id) async {
    try {
      await ref.read(apiServiceProvider).markExpensePaid(id.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Expense marked as paid'), backgroundColor: KTColors.success),
        );
        _invalidateAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  void _showRejectModal(dynamic id) {
    final reasonController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Reject Expense', style: KTTextStyles.h2),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Reason for rejection'),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.danger),
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(apiServiceProvider)
                      .rejectExpense(id.toString(), reasonController.text);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Expense rejected'),
                        backgroundColor: KTColors.danger,
                      ),
                    );
                    _invalidateAll();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger),
                    );
                  }
                }
              },
              child: const Text('Confirm reject'),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expense Approvals'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _tabs.map((tab) {
          return Consumer(builder: (context, ref, _) {
            final expState = ref.watch(_accountantExpensesProvider(tab));
            return expState.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card),
              error: (err, _) => KTErrorState(
                message: err.toString(),
                onRetry: () => ref.invalidate(_accountantExpensesProvider(tab)),
              ),
              data: (expenses) {
                if (expenses.isEmpty) {
                  return KTEmptyState(
                    title: 'No $tab expenses',
                    subtitle: 'All caught up!',
                    lottieAsset: 'assets/lottie/done.json',
                  );
                }
                return RefreshIndicator(
                  color: KTColors.acctAccent,
                  onRefresh: () async => _invalidateAll(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: expenses.length,
                    itemBuilder: (context, index) {
                      final ex = expenses[index] as Map;
                      return _ExpenseCard(
                        expense: ex,
                        tab: tab,
                        currencyFormat: currencyFormat,
                        onApprove: () => _handleApprove(ex['id']),
                        onReject: () => _showRejectModal(ex['id']),
                        onMarkPaid: () => _handleMarkPaid(ex['id']),
                      );
                    },
                  ),
                );
              },
            );
          });
        }).toList(),
      ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Map expense;
  final String tab;
  final NumberFormat currencyFormat;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onMarkPaid;

  const _ExpenseCard({
    required this.expense,
    required this.tab,
    required this.currencyFormat,
    required this.onApprove,
    required this.onReject,
    required this.onMarkPaid,
  });

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return KTColors.success;
      case 'rejected':
        return KTColors.danger;
      case 'paid':
        return KTColors.acctAccent;
      default:
        return KTColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final category = (expense['category'] ?? 'other').toString();
    final amount = (expense['amount'] is num) ? expense['amount'] : 0;
    final status = (expense['status'] ?? expense['expense_status'] ?? tab).toString().toLowerCase();
    final description = expense['description'] ?? '';
    final date = expense['expense_date'] ?? expense['created_at'] ?? '';
    final tripId = expense['trip_id'] ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: _statusColor(status).withOpacity(0.15),
                  child: Icon(_categoryIcon(category), color: _statusColor(status), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        category[0].toUpperCase() + category.substring(1),
                        style: KTTextStyles.label,
                      ),
                      if (tripId.toString().isNotEmpty)
                        Text('Trip #$tripId', style: KTTextStyles.bodySmall),
                    ],
                  ),
                ),
                Chip(
                  label: Text(status[0].toUpperCase() + status.substring(1),
                      style: const TextStyle(fontSize: 11)),
                  backgroundColor: _statusColor(status).withOpacity(0.1),
                  side: BorderSide.none,
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(currencyFormat.format(amount), style: KTTextStyles.h2),
            if (description.toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(description.toString(), style: KTTextStyles.bodySmall,
                  maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (date.toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(date.toString().split('T').first,
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            ],
            if (tab == 'pending') ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: KTColors.danger,
                        side: const BorderSide(color: KTColors.danger),
                      ),
                      onPressed: onReject,
                      child: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: KTColors.success),
                      onPressed: onApprove,
                      child: const Text('Approve'),
                    ),
                  ),
                ],
              ),
            ],
            if (tab == 'approved') ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: KTColors.acctAccent),
                  onPressed: onMarkPaid,
                  icon: const Icon(Icons.payment, size: 18),
                  label: const Text('Mark as Paid'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'fuel':
        return Icons.local_gas_station;
      case 'toll':
        return Icons.toll;
      case 'food':
        return Icons.restaurant;
      case 'maintenance':
        return Icons.build;
      case 'loading':
      case 'unloading':
        return Icons.inventory;
      default:
        return Icons.receipt_long;
    }
  }
}