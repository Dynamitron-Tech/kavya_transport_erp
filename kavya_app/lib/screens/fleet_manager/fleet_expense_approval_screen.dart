import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// Provider for fetching pending expenses
final pendingExpensesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getExpensesPending(); // [cite: 33, 67]
});

class FleetExpenseApprovalScreen extends ConsumerStatefulWidget {
  const FleetExpenseApprovalScreen({super.key});

  @override
  ConsumerState<FleetExpenseApprovalScreen> createState() => _FleetExpenseApprovalScreenState();
}

class _FleetExpenseApprovalScreenState extends ConsumerState<FleetExpenseApprovalScreen> {
  String _selectedFilter = 'Pending'; // [cite: 67-68]
  final List<String> _filters = ['All', 'Pending', 'Approved', 'Rejected']; // [cite: 67-68]

  Future<void> _handleApprove(String id) async {
    try {
      await ref.read(apiServiceProvider).approveExpense(id); // [cite: 33, 68]
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Expense approved'), backgroundColor: KTColors.success), // [cite: 117]
        );
        ref.invalidate(pendingExpensesProvider);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger), // [cite: 117]
        );
      }
    }
  }

  void _showRejectModal(String id) { // [cite: 68-69]
    final reasonController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24, right: 24, top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text("Reject Expense", style: KTTextStyles.h2),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: "Reason for rejection"), // [cite: 68]
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.danger),
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) return;
                Navigator.pop(context);
                try {
                  await ref.read(apiServiceProvider).rejectExpense(id, reasonController.text); // [cite: 33, 68-69]
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Expense rejected'), backgroundColor: KTColors.danger), // [cite: 117]
                    );
                    ref.invalidate(pendingExpensesProvider);
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
                  }
                }
              },
              child: const Text("Confirm reject"), // [cite: 68-69]
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final expensesState = ref.watch(pendingExpensesProvider);
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]

    return Scaffold(
      appBar: AppBar(title: const Text("Expense approvals")), // [cite: 67]
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
              error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(pendingExpensesProvider)), // [cite: 111-113]
              data: (expenses) {
                if (expenses.isEmpty) {
                  return const KTEmptyState(
                    title: "No pending expenses", // [cite: 69]
                    subtitle: "All caught up!",
                    lottieAsset: 'assets/lottie/done.json', // [cite: 69, 114-115]
                  );
                }

                return RefreshIndicator( // [cite: 118]
                  color: KTColors.primary,
                  onRefresh: () async => ref.invalidate(pendingExpensesProvider),
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
                                  CircleAvatar(backgroundColor: KTColors.roleDriver, child: Text("K", style: KTTextStyles.label.copyWith(color: Colors.white))), // [cite: 68]
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text("Kumar • ${ex['trip_number'] ?? 'KT-T-0089'}", style: KTTextStyles.label), // [cite: 68]
                                        Text("16 Mar 2026 • 14:30", style: KTTextStyles.bodySmall), // [cite: 68, 115]
                                      ],
                                    ),
                                  ),
                                  Chip(label: Text(ex['type'] ?? 'Fuel'), backgroundColor: KTColors.info.withOpacity(0.1)), // [cite: 68]
                                ],
                              ),
                              const SizedBox(height: 16),
                              Text(currencyFormat.format(ex['amount'] ?? 4500), style: KTTextStyles.h1), // [cite: 68, 115]
                              const SizedBox(height: 16),
                              Row( // [cite: 68]
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