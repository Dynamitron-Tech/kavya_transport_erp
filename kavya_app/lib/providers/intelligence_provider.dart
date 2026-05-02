import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart';

/// Driver score summary (last 7 days trend + current tier).
final driverScoreProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, driverId) async {
  final api = ref.read(apiServiceProvider);
  return await api.getDriverScore(driverId);
});

/// Driver leaderboard (top 5 + bottom 5).
final driverLeaderboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 120), () => link.close());
  ref.onDispose(() => timer.cancel());
  final api = ref.read(apiServiceProvider);
  return await api.getDriverLeaderboard();
});

/// Vehicle risk score.
final vehicleRiskProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, vehicleId) async {
  final api = ref.read(apiServiceProvider);
  return await api.getVehicleRisk(vehicleId);
});

/// Fleet-wide maintenance summary (healthy/monitor/high_risk counts).
final fleetMaintenanceProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 120), () => link.close());
  ref.onDispose(() => timer.cancel());
  final api = ref.read(apiServiceProvider);
  return await api.getFleetMaintenanceSummary();
});

/// Trip intelligence alerts.
final tripAlertsProvider = FutureProvider.autoDispose.family<List<dynamic>, int>((ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  return await api.getTripAlerts(tripId);
});

/// Daily intelligence insights (last 7 days).
final dailyInsightsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 300), () => link.close());
  ref.onDispose(() => timer.cancel());
  final api = ref.read(apiServiceProvider);
  return await api.getDailyInsights();
});

/// Recent event bus events.
final recentEventsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 60), () => link.close());
  ref.onDispose(() => timer.cancel());
  final api = ref.read(apiServiceProvider);
  return await api.getRecentEvents();
});

/// Grouped events (priority-aware, deduped).
final groupedEventsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(seconds: 60), () => link.close());
  ref.onDispose(() => timer.cancel());
  final api = ref.read(apiServiceProvider);
  return await api.getGroupedEvents();
});
