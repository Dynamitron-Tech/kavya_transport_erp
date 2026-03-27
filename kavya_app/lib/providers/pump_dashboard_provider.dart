import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/fuel.dart';
import '../services/api_service.dart';

final _api = ApiService();

/// Dashboard stats for the pump operator home screen.
final pumpDashboardProvider = FutureProvider.autoDispose<FuelDashboardStats>((ref) async {
  final res = await _api.get('/fuel-pump/dashboard');
  final data = res['data'] ?? res;
  return FuelDashboardStats.fromJson(data as Map<String, dynamic>);
});

/// All fuel tanks.
final fuelTanksProvider = FutureProvider.autoDispose<List<FuelTank>>((ref) async {
  final res = await _api.get('/fuel-pump/tanks');
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelTank.fromJson(e as Map<String, dynamic>)).toList();
});

/// Today's fuel issues list.
final todayFuelIssuesProvider = FutureProvider.autoDispose<List<FuelIssue>>((ref) async {
  final today = DateTime.now().toIso8601String().split('T').first;
  final res = await _api.get('/fuel-pump/issues', queryParameters: {
    'date_from': today,
    'date_to': today,
    'limit': 100,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
});

/// Open mismatch / theft alerts.
final fuelAlertsProvider = FutureProvider.autoDispose<List<FuelTheftAlert>>((ref) async {
  final res = await _api.get('/fuel-pump/alerts', queryParameters: {
    'status': 'OPEN',
    'limit': 50,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelTheftAlert.fromJson(e as Map<String, dynamic>)).toList();
});

/// Vehicle list for the fuel issue form dropdown.
final vehicleListProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/vehicles');
  final payload = res['data'] ?? res;
  if (payload is List) {
    return payload.cast<Map<String, dynamic>>();
  }
  return [];
});

final driversProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/drivers', queryParameters: {'limit': 500});
  final payload = (res['data'] ?? res);
  if (payload is List) {
    return payload.cast<Map<String, dynamic>>();
  }
  return [];
});

/// Notifier to submit a new fuel issue.
class FuelIssueNotifier extends StateNotifier<AsyncValue<void>> {
  FuelIssueNotifier() : super(const AsyncData(null));

  Future<bool> issueFuel({
    required int tankId,
    required int vehicleId,
    int? driverId,
    int? tripId,
    required double quantityLitres,
    required double ratePerLitre,
    double? odometerReading,
    String? receiptNumber,
    String? remarks,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/issues', data: {
        'tank_id': tankId,
        'vehicle_id': vehicleId,
        if (driverId != null) 'driver_id': driverId,
        if (tripId != null) 'trip_id': tripId,
        'fuel_type': 'DIESEL',
        'quantity_litres': quantityLitres,
        'rate_per_litre': ratePerLitre,
        if (odometerReading != null) 'odometer_reading': odometerReading,
        'issued_at': DateTime.now().toIso8601String(),
        if (receiptNumber != null) 'receipt_number': receiptNumber,
        if (remarks != null) 'remarks': remarks,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final fuelIssueNotifierProvider =
    StateNotifierProvider.autoDispose<FuelIssueNotifier, AsyncValue<void>>(
  (ref) => FuelIssueNotifier(),
);
