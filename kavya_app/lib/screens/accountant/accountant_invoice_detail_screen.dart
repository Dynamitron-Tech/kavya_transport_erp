import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../providers/finance_provider.dart';

class AccountantInvoiceDetailScreen extends ConsumerWidget {
  final String id;
  const AccountantInvoiceDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceState = ref.watch(invoiceDetailProvider(id));
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]

    return invoiceState.when(
      loading: () => Scaffold(appBar: AppBar(), body: const KTLoadingShimmer()), // [cite: 109-110]
      error: (err, stack) => Scaffold(
        appBar: AppBar(), 
        body: KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(invoiceDetailProvider(id))) // [cite: 111-113]
      ),
      data: (data) {
        // Dummy data for structure
        final status = data['status'] ?? 'unpaid';
        final isPaid = status == 'paid';

        return Scaffold(
          appBar: AppBar(title: Text(data['invoice_no'] ?? 'KT-2026-0045', style: KTTextStyles.mono)), //
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Header & Client Details 
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text("Acme Transport", style: KTTextStyles.h2),
                          KTStatusBadge(label: status, color: isPaid ? KTColors.success : KTColors.warning),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text("GSTIN: 33AAAAA0000A1Z5", style: KTTextStyles.body),
                      const SizedBox(height: 4),
                      Text("Date: 10 Mar 2026\nDue: 18 Mar 2026", style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // Line Items Table 
              Text("Line Items", style: KTTextStyles.h3),
              const SizedBox(height: 8),
              Card(
                clipBehavior: Clip.antiAlias,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    headingRowColor: MaterialStateProperty.all(Colors.grey.shade100),
                    columns: const [
                      DataColumn(label: Text("Description")),
                      DataColumn(label: Text("Qty")),
                      DataColumn(label: Text("Rate")),
                      DataColumn(label: Text("Amount")),
                    ],
                    rows: [
                      DataRow(cells: [
                        const DataCell(Text("Freight Charges (Chennai to CBE)")),
                        const DataCell(Text("1")),
                        DataCell(Text(currencyFormat.format(40000))),
                        DataCell(Text(currencyFormat.format(40000))),
                      ]),
                      DataRow(cells: [
                        const DataCell(Text("Loading/Unloading")),
                        const DataCell(Text("1")),
                        DataCell(Text(currencyFormat.format(5000))),
                        DataCell(Text(currencyFormat.format(5000))),
                      ]),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Totals & GST Breakdown 
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      _buildTotalsRow("Subtotal", currencyFormat.format(45000)),
                      const SizedBox(height: 8),
                      _buildTotalsRow("CGST (2.5%)", currencyFormat.format(1125)),
                      const SizedBox(height: 8),
                      _buildTotalsRow("SGST (2.5%)", currencyFormat.format(1125)),
                      const Divider(height: 24),
                      _buildTotalsRow("Total", currencyFormat.format(47250), isBold: true),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 80), // Padding for FAB
            ],
          ),
          // "Record payment" FAB (if status != paid) 
          floatingActionButton: isPaid ? null : FloatingActionButton.extended(
            onPressed: () {
              // Open modal or navigate to payment screen
            },
            icon: const Icon(Icons.payment),
            label: const Text("Record Payment"),
            backgroundColor: KTColors.primary,
          ),
        );
      },
    );
  }

  Widget _buildTotalsRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: isBold ? KTTextStyles.h3 : KTTextStyles.body),
        Text(value, style: isBold ? KTTextStyles.h3 : KTTextStyles.body),
      ],
    );
  }
}