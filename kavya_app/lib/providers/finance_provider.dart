import 'package:flutter_riverpod/flutter_riverpod.dart';
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

final paymentsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/accountant/payments');
  final data = response is Map ? (response['data'] ?? response['payments']) : response;
  return data is List ? List<dynamic>.from(data as List) : [];
});