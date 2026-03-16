import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import 'fleet_dashboard_provider.dart'; // Reusing apiServiceProvider

final receivablesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getReceivables(); //
});

// ... existing receivablesProvider ...

final invoicesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getInvoices(); // Data: GET /api/v1/finance/invoices [cite: 78]
});

final invoiceDetailProvider = FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, id) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getInvoiceDetail(id); // Data: GET /api/v1/finance/invoices/:id 
});

// ... existing invoicesProvider and invoiceDetailProvider ...

final paymentsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async { //
  // Data: GET /api/v1/finance/payments
  // In a real scenario, you'd add this endpoint to ApiService.
  // We'll mock the response structure here for the UI layout.
  await Future.delayed(const Duration(seconds: 1)); 
  return [
    {'id': '1', 'client': 'Acme Transport', 'amount': 45000, 'mode': 'NEFT', 'date': '15 Mar 2026', 'ref': 'N123456789'},
    {'id': '2', 'client': 'Global Logistics', 'amount': 12500, 'mode': 'UPI', 'date': '14 Mar 2026', 'ref': 'UPI098765'},
    {'id': '3', 'client': 'Southern Freight', 'amount': 85000, 'mode': 'RTGS', 'date': '12 Mar 2026', 'ref': 'R112233445'},
  ];
});