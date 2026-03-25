import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../providers/finance_provider.dart';
import '../../widgets/payment_bottom_sheet.dart';

class AccountantReceivablesScreen extends ConsumerStatefulWidget {
  const AccountantReceivablesScreen({super.key});

  @override
  ConsumerState<AccountantReceivablesScreen> createState() => _AccountantReceivablesScreenState();
}

class _AccountantReceivablesScreenState extends ConsumerState<AccountantReceivablesScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]

  void _openWhatsApp(String phone, String text) async {
    final url = Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(text)}'); // [cite: 77]
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open WhatsApp')));
    }
  }

  void _showPaymentSheet(Map<String, dynamic> rec) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PaymentBottomSheet(
        invoiceId: (rec['id'] as num?)?.toInt() ?? 0,
        clientId: (rec['client_id'] as num?)?.toInt() ?? 0,
        invoiceNumber: rec['invoice_number'] ?? '',
        outstandingAmount: (rec['amount_due'] as num?)?.toDouble() ?? 0.0,
        clientName: rec['client_name'] ?? '',
        onPaymentRecorded: () => ref.invalidate(receivablesProvider),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final receivablesState = ref.watch(receivablesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Receivables"), // [cite: 76]
        actions: [
          IconButton(icon: const Icon(Icons.sort), onPressed: () {}) // Sort options: Due date | Amount | Client name 
        ],
      ),
      body: receivablesState.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list), // [cite: 109-110]
        error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(receivablesProvider)), // [cite: 111-113]
        data: (receivables) {
          if (receivables.isEmpty) return const KTEmptyState(title: "No receivables", subtitle: "All invoices are paid.", lottieAsset: 'assets/lottie/done.json'); // [cite: 114-115]

          return RefreshIndicator(
            color: KTColors.acctAccent,
            onRefresh: () async => ref.invalidate(receivablesProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: receivables.length,
              itemBuilder: (context, index) {
                final rec = receivables[index];
                final clientName = rec['client_name'] ?? '';
                final invoiceNo = rec['invoice_number'] ?? '';
                final amount = (rec['amount_due'] as num?) ?? 0;
                final isOverdue = rec['is_overdue'] ?? false;
                
                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(clientName, style: KTTextStyles.h3), // Client name (bold) [cite: 77]
                            KTStatusBadge(label: isOverdue ? 'Overdue' : 'Pending', color: isOverdue ? KTColors.danger : KTColors.warning), // Payment status badge [cite: 77]
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(invoiceNo, style: KTTextStyles.mono.copyWith(color: Colors.grey[600])), // Invoice number [cite: 77]
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text("Amount Due", style: KTTextStyles.bodySmall),
                                Text(currencyFormat.format(amount), style: KTTextStyles.h1), // Amount due (large, bold) [cite: 77]
                              ],
                            ),
                            if (isOverdue)
                              Text("${rec['aging_days'] ?? 0} days overdue", style: KTTextStyles.label.copyWith(color: KTColors.danger)), // Due date + "X days overdue" in red if past [cite: 77]
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(foregroundColor: KTColors.success, side: const BorderSide(color: KTColors.success)),
                                onPressed: () => _openWhatsApp('+919876543210', 'Reminder: Invoice $invoiceNo for ${currencyFormat.format(amount)} is due.'), // "Send reminder" → WhatsApp deep link [cite: 77]
                                icon: const Icon(Icons.chat),
                                label: const Text("Reminder"),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _showPaymentSheet(rec), // "Record payment" → UPI / NEFT / RTGS / Cheque / Cash
                                icon: const Icon(Icons.payment),
                                label: const Text("Pay"),
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
    );
  }
}