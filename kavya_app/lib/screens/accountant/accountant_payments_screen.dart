import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart'; // For apiServiceProvider

// Reusing the same pending expenses logic 
final accountantPendingExpensesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getExpensesPending(); 
});

class AccountantExpenseApprovalScreen extends ConsumerStatefulWidget {
  const AccountantExpenseApprovalScreen({super.key});

  @override
  ConsumerState<AccountantExpenseApprovalScreen> createState() => _AccountantExpenseApprovalScreenState();
}

class _AccountantExpenseApprovalScreenState extends ConsumerState<AccountantExpenseApprovalScreen> {
  String _selectedFilter = 'Pending';
  final List<String> _filters = ['All', 'Pending', 'Approved', 'Rejected'];

  Future<void> _handleApprove(String id) async {
    try {
      await ref.read(apiServiceProvider).approveExpense(id); // 
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Expense approved'), backgroundColor: KTColors.success)); // [cite: 117]
        ref.invalidate(accountantPendingExpensesProvider);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger));
    }
  }

  void _showRejectModal(String id) {
    final reasonController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text("Reject Expense", style: KTTextStyles.h2),
            const SizedBox(height: 16),
            TextField(controller: reasonController, decoration: const InputDecoration(labelText: "Reason for rejection"), maxLines: 2),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.danger),
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) return;
                Navigator.pop(context);
                try {
                  await ref.read(apiServiceProvider).rejectExpense(id, reasonController.text); // 
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Expense rejected'), backgroundColor: KTColors.danger)); // [cite: 117]
                    ref.invalidate(accountantPendingExpensesProvider);
                  }
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger));
                }
              },
              child: const Text("Confirm reject"),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final expensesState = ref.watch(accountantPendingExpensesProvider);
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]

    return Scaffold(
      appBar: AppBar(title: const Text("Expense approvals")),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _filters.map((f) => Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: FilterChip(
                  label: Text(f),
                  selected: _selectedFilter == f,
                  onSelected: (val) => setState(() => _selectedFilter = f),
                ),
              )).toList(),
            ),
          ),
          Expanded(
            child: expensesState.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card), // [cite: 109-110]
              error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(accountantPendingExpensesProvider)), // [cite: 111-113]
              data: (expenses) {
                if (expenses.isEmpty) return const KTEmptyState(title: "No pending expenses", subtitle: "All caught up!", lottieAsset: 'assets/lottie/done.json'); // [cite: 114-115]

                return RefreshIndicator(
                  color: KTColors.primary,
                  onRefresh: () async => ref.invalidate(accountantPendingExpensesProvider), // [cite: 118]
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: expenses.length,
                    itemBuilder: (context, index) {
                      final ex = expenses[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(backgroundColor: KTColors.roleDriver, child: Text("D", style: KTTextStyles.label.copyWith(color: Colors.white))),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text("Driver Name • ${ex['trip_number'] ?? 'KT-T-0092'}", style: KTTextStyles.label),
                                        Text("Date Time Placeholder", style: KTTextStyles.bodySmall),
                                      ],
                                    ),
                                  ),
                                  Chip(label: Text(ex['type'] ?? 'Maintenance'), backgroundColor: KTColors.info.withOpacity(0.1)),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Text(currencyFormat.format(ex['amount'] ?? 12500), style: KTTextStyles.h1),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      style: OutlinedButton.styleFrom(foregroundColor: KTColors.danger, side: const BorderSide(color: KTColors.danger)),
                                      onPressed: () => _showRejectModal(ex['id'] ?? '1'),
                                      child: const Text("Reject"),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(backgroundColor: KTColors.success),
                                      onPressed: () => _handleApprove(ex['id'] ?? '1'),
                                      child: const Text("Approve"),
                                    ),
                                  ),
                                ],
                              )
                            ],
                          ),
                        ),
                      );
                    },
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