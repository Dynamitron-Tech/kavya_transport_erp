import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart';

final adminDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 60), () => link.close());
  ref.onDispose(() => timer.cancel());

  final api = ref.read(apiServiceProvider);
  return Map<String, dynamic>.from(
    (await api.get('/admin/dashboard/stats')) as Map,
  );
});

final fleetStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getFleetStats();
});

final tripStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getTripStats();
});

final financeStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getFinanceStats();
});

final adminNotificationsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getNotifications();
});
