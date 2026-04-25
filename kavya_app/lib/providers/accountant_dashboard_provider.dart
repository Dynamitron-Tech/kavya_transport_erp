import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart'; // To reuse apiServiceProvider

final accountantDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getDashboardAccountant(); //
});