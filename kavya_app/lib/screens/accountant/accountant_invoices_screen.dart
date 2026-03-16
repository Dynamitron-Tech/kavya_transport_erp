import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../providers/finance_provider.dart';

class AccountantInvoicesScreen extends ConsumerStatefulWidget {
  const AccountantInvoicesScreen({super.key});

  @override
  ConsumerState<AccountantInvoicesScreen> createState() => _AccountantInvoicesScreenState();
}

class _AccountantInvoicesScreenState extends ConsumerState<AccountantInvoicesScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]
  String _selectedFilter = 'All'; // 
  final List<String> _filters = ['All', 'Unpaid', 'Partially paid', 'Paid', 'Overdue']; // Filter chips 

  @override
  Widget build(BuildContext context) {
    final invoicesState = ref.watch(invoicesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text("Invoices")), //
      body: Column(
        children: [
          // Filter Chips Row
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
            child: invoicesState.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list), // [cite: 109-110]
              error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(invoicesProvider)), // [cite: 111-113]
              data: (invoices) {
                if (invoices.isEmpty) {
                  return const KTEmptyState(
                    title: "No invoices found",
                    subtitle: "Try changing the filter.",
                    lottieAsset: 'assets/lottie/empty_box.json', // [cite: 114-115]
                  );
                }

                return RefreshIndicator(
                  color: KTColors.primary,
                  onRefresh: () async => ref.invalidate(invoicesProvider), // [cite: 118]
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: invoices.length,
                    itemBuilder: (context, index) {
                      final inv = invoices[index];
                      // Dummy data mapping
                      final invoiceNo = inv['invoice_no'] ?? 'KT-2026-0045';
                      final clientName = inv['client_name'] ?? 'Acme Transport';
                      final amount = inv['amount'] ?? 45000;
                      final status = inv['status'] ?? 'unpaid';
                      final dueDate = inv['due_date'] ?? '18 Mar 2026';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () => context.push('/accountant/invoice/${inv['id'] ?? '1'}'), // Tap -> AccountantInvoiceDetailScreen [cite: 79]
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(invoiceNo, style: KTTextStyles.mono.copyWith(fontWeight: FontWeight.bold)), // Invoice number (KT prefix, monospace font) [cite: 79]
                                      const SizedBox(height: 4),
                                      Text(clientName, style: KTTextStyles.label), // Client name [cite: 79]
                                      const SizedBox(height: 4),
                                      Text("Due: $dueDate", style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])), // Due date [cite: 79]
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(currencyFormat.format(amount), style: KTTextStyles.h3), // Total amount (₹) [cite: 79]
                                    const SizedBox(height: 8),
                                    KTStatusBadge( // Status badge [cite: 79]
                                      label: status, 
                                      color: status == 'paid' ? KTColors.success : (status == 'overdue' ? KTColors.danger : KTColors.warning)
                                    ),
                                  ],
                                ),
                              ],
                            ),
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