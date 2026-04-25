import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart'; // to reuse apiServiceProvider

final vehiclesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getVehicles(); // Data: GET /api/v1/vehicles [cite: 62]
});

final vehicleDetailProvider = FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, id) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getVehicleDetail(id); // Data: GET /api/v1/vehicles/:id [cite: 64]
});