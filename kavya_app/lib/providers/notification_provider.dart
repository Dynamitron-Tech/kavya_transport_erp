import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart'; // for apiServiceProvider

final notificationsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async { //
  // Data: GET /api/v1/notifications?unread=true [cite: 105]
  // Mocking the API response
  await Future.delayed(const Duration(seconds: 1));
  return [
    {'id': '1', 'title': 'Expense Submitted', 'message': 'Kumar submitted ₹4500 for Fuel.', 'type': 'expense_submitted', 'entity_id': 'exp_123', 'created_at': '10 mins ago'},
    {'id': '2', 'title': 'EWB Expiring Soon', 'message': 'EWB-123456 for TN01AB1234 expires in 3 hours.', 'type': 'ewb_expiring', 'entity_id': 'ewb_456', 'created_at': '1 hour ago'},
  ];
});