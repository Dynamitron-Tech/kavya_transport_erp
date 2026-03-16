import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/trip.dart';
import '../services/api_service.dart';

final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

final tripsProvider =
    StateNotifierProvider<TripsNotifier, AsyncValue<List<Trip>>>((ref) {
  return TripsNotifier(ref.read(apiServiceProvider));
});

final activeTripProvider = Provider<Trip?>((ref) {
  final trips = ref.watch(tripsProvider);
  return trips.valueOrNull?.where((t) => t.isActive).firstOrNull;
});

class TripsNotifier extends StateNotifier<AsyncValue<List<Trip>>> {
  final ApiService _api;

  TripsNotifier(this._api) : super(const AsyncValue.loading()) {
    fetchTrips();
  }

  Future<void> fetchTrips() async {
    state = const AsyncValue.loading();
    try {
      final data = await _api.get<Map<String, dynamic>>('/trips/');
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) => Trip.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateTripStatus(int tripId, String status) async {
    try {
      await _api.patch('/trips/$tripId/status', data: {'status': status});
      await fetchTrips();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final tripDetailProvider =
    FutureProvider.family<Trip, int>((ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  return api.get<Trip>('/trips/$tripId',
      fromJson: (d) => Trip.fromJson(d as Map<String, dynamic>));
});
