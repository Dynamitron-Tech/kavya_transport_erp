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
import '../../providers/fleet_dashboard_provider.dart'; // for apiServiceProvider

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

  void _showRecordPaymentModal(Map<String, dynamic> receivable) {
    final amountController = TextEditingController(text: receivable['amount_due']?.toString() ?? '');
    String selectedMode = 'NEFT';
    DateTime selectedDate = DateTime.now();
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder( // StatefulBuilder to manage modal state
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 24, right: 24, top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text("Record Payment", style: KTTextStyles.h2),
              const SizedBox(height: 16),
              TextFormField(
                controller: amountController,
                decoration: const InputDecoration(labelText: "Amount received (₹)"), // [cite: 77]
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: selectedMode,
                decoration: const InputDecoration(labelText: "Payment Mode"), // [cite: 77]
                items: ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI'].map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                onChanged: (val) => setModalState(() => selectedMode = val!),
              ),
              const SizedBox(height: 16),
              const TextField(decoration: InputDecoration(labelText: "Reference number")), // [cite: 77]
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text("Date"), // [cite: 77]
                subtitle: Text(DateFormat('dd MMM yyyy').format(selectedDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final date = await showDatePicker(context: context, initialDate: selectedDate, firstDate: DateTime(2020), lastDate: DateTime.now());
                  if (date != null) setModalState(() => selectedDate = date);
                },
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(context);
                  try {
                    // Mock payload
                    await ref.read(apiServiceProvider).recordPayment(receivable['invoice_id'] ?? '1', {}); // [cite: 77]
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment recorded'), backgroundColor: KTColors.success)); // [cite: 117]
                      ref.invalidate(receivablesProvider);
                    }
                  } catch (e) {
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
                  }
                },
                child: const Text("Confirm"), // [cite: 77]
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
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
            color: KTColors.primary,
            onRefresh: () async => ref.invalidate(receivablesProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: receivables.length,
              itemBuilder: (context, index) {
                final rec = receivables[index];
                // Mocking data fields based on spec
                final clientName = rec['client_name'] ?? 'Acme Corp';
                final invoiceNo = rec['invoice_no'] ?? 'KT-INV-2026-001';
                final amount = rec['amount_due'] ?? 125000;
                final isOverdue = rec['is_overdue'] ?? true;
                
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
                              Text("12 days overdue", style: KTTextStyles.label.copyWith(color: KTColors.danger)), // Due date + "X days overdue" in red if past [cite: 77]
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
                                onPressed: () => _showRecordPaymentModal(rec), // "Record payment" → modal [cite: 77]
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