import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/driver_requests.dart';
import 'fleet_dashboard_provider.dart'; // gives apiServiceProvider

// ── Leave ─────────────────────────────────────────────────────────────────────

final myLeavesProvider =
    FutureProvider.autoDispose<List<DriverLeave>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final raw = await api.get('/driver-requests/leaves');
  final list = (raw['data'] as List?) ?? [];
  return list
      .cast<Map<String, dynamic>>()
      .map(DriverLeave.fromJson)
      .toList();
});

// ── Advance ───────────────────────────────────────────────────────────────────

final myAdvanceRequestsProvider =
    FutureProvider.autoDispose<List<DriverAdvanceRequest>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final raw = await api.get('/driver-requests/advance-requests');
  final list = (raw['data'] as List?) ?? [];
  return list
      .cast<Map<String, dynamic>>()
      .map(DriverAdvanceRequest.fromJson)
      .toList();
});
