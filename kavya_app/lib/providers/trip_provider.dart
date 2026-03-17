import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/trip.dart';
import '../services/api_service.dart';
import 'cache_manager_provider.dart';
import 'search_provider.dart';

// Paginated trips provider
final tripsPaginatedProvider = StateNotifierProvider<TripsPaginationNotifier, AsyncValue<PaginatedTrips>>((ref) {
  return TripsPaginationNotifier(ref.read(apiServiceProvider), ref);
});

class PaginatedTrips {
  final List<Trip> items;
  final int currentPage;
  final int pageSize;
  final int total;
  final bool hasMore;

  PaginatedTrips({
    required this.items,
    required this.currentPage,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });
}

class TripsPaginationNotifier extends StateNotifier<AsyncValue<PaginatedTrips>> {
  final ApiService _api;
  final Ref _ref;
  int _currentPage = 1;
  final int _pageSize = 20;
  List<Trip> _allTrips = [];

  TripsPaginationNotifier(this._api, this._ref) : super(const AsyncValue.loading()) {
    fetchTrips();
  }

  Future<void> fetchTrips({bool reset = false}) async {
    if (reset) {
      _currentPage = 1;
      _allTrips = [];
      state = const AsyncValue.loading();
    }

    try {
      final data = await _api.get<Map<String, dynamic>>(
        '/trips/?page=$_currentPage&page_size=$_pageSize',
      );
      
      final items = (data['items'] as List<dynamic>?)
          ?.map((e) => Trip.fromJson(e as Map<String, dynamic>))
          .toList() ?? [];
      
      final total = data['total'] as int? ?? 0;
      
      if (reset) {
        _allTrips = items;
      } else {
        _allTrips.addAll(items);
      }

      state = AsyncValue.data(PaginatedTrips(
        items: _allTrips,
        currentPage: _currentPage,
        pageSize: _pageSize,
        total: total,
        hasMore: _allTrips.length < total,
      ));

      // Cache the results
      _ref.read(tripsCacheProvider).set('trips_page_$_currentPage', items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> loadMore() async {
    if (!state.maybeWhen(data: (data) => data.hasMore, orElse: () => false)) {
      return;
    }
    _currentPage++;
    await fetchTrips();
  }

  Future<void> refresh() async {
    await fetchTrips(reset: true);
  }

  Future<void> updateTripStatus(int tripId, String status) async {
    try {
      // VALIDATION: Block trip start if pre-trip checklist is incomplete
      if (status == 'in_transit') {
        final checklistStatus = await _checkPreTripChecklistCompletion(tripId);
        if (!checklistStatus['complete']) {
          throw Exception(
            'Cannot start trip: Pre-trip checklist not completed. '
            '${checklistStatus['remaining']} items remaining.'
          );
        }
      }

      await _api.patch('/trips/$tripId/status', data: {'status': status});
      
      // Update local state optimistically
      _allTrips = _allTrips.map((trip) {
        if (trip.id == tripId) {
          return Trip(
            id: trip.id,
            tripNumber: trip.tripNumber,
            status: status,
            origin: trip.origin,
            destination: trip.destination,
            vehicleNumber: trip.vehicleNumber,
            driverId: trip.driverId,
            startDate: trip.startDate,
            endDate: trip.endDate,
            distanceKm: trip.distanceKm,
            freightAmount: trip.freightAmount,
            clientName: trip.clientName,
            lrNumber: trip.lrNumber,
            remarks: trip.remarks,
          );
        }
        return trip;
      }).toList();

      state = AsyncValue.data(state.valueOrNull!.copyWith(items: _allTrips));
      
      // Invalidate cache
      _ref.read(tripsCacheProvider).invalidatePattern('trip_detail_$tripId');
      
      // Refresh from server
      await Future.delayed(const Duration(milliseconds: 500));
      await refresh();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  /// Check if pre-trip checklist for this trip is complete
  Future<Map<String, dynamic>> _checkPreTripChecklistCompletion(int tripId) async {
    try {
      final data = await _api.get<Map<String, dynamic>>(
        '/trips/$tripId/checklist?type=pre_trip',
      );
      
      if (data == null) {
        return {'complete': false, 'remaining': '∞'}; // No checklist exists
      }

      // Check if checklist items exist and all are completed
      final items = data['items'] as List? ?? [];
      final completed = items.whereType<Map>().where((item) => item['checked'] == true).length;
      final total = items.length;
      final remaining = total - completed;

      return {
        'complete': remaining == 0 && total > 0,
        'remaining': '$remaining',
        'total': total,
        'completed': completed,
      };
    } catch (e) {
      // If we can't fetch checklist, assume it's not complete (safe default)
      return {'complete': false, 'remaining': '?'};
    }
  }
}

extension on PaginatedTrips {
  PaginatedTrips copyWith({
    List<Trip>? items,
    int? currentPage,
    int? pageSize,
    int? total,
    bool? hasMore,
  }) {
    return PaginatedTrips(
      items: items ?? this.items,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      total: total ?? this.total,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

// Old provider for backward compatibility (use paginated instead)
final tripsProvider =
    StateNotifierProvider<TripsNotifier, AsyncValue<List<Trip>>>((ref) {
  return TripsNotifier(ref.read(apiServiceProvider), ref);
});

final activeTripProvider = Provider<Trip?>((ref) {
  final trips = ref.watch(tripsPaginatedProvider);
  return trips.maybeWhen(
    data: (paginatedData) => paginatedData.items.where((t) => t.isActive).firstOrNull,
    orElse: () => null,
  );
});

class TripsNotifier extends StateNotifier<AsyncValue<List<Trip>>> {
  final ApiService _api;
  final Ref _ref;

  TripsNotifier(this._api, this._ref) : super(const AsyncValue.loading()) {
    fetchTrips();
  }

  Future<void> fetchTrips() async {
    // Check cache first
    final cached = _ref.read(tripsCacheProvider).get('trips_all');
    if (cached != null) {
      state = AsyncValue.data(cached);
      return;
    }

    state = const AsyncValue.loading();
    try {
      final data = await _api.get<Map<String, dynamic>>('/trips/');
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) => Trip.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      state = AsyncValue.data(items);
      
      // Cache results
      _ref.read(tripsCacheProvider).set('trips_all', items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() async {
    _ref.read(tripsCacheProvider).invalidate('trips_all');
    await fetchTrips();
  }

  Future<void> updateTripStatus(int tripId, String status) async {
    try {
      // VALIDATION: Block trip start if pre-trip checklist is incomplete
      if (status == 'in_transit') {
        final checklistStatus = await _checkPreTripChecklistCompletion(tripId);
        if (!checklistStatus['complete']) {
          throw Exception(
            'Cannot start trip: Pre-trip checklist not completed. '
            '${checklistStatus['remaining']} items remaining.'
          );
        }
      }

      await _api.patch('/trips/$tripId/status', data: {'status': status});
      await refresh();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  /// Check if pre-trip checklist for this trip is complete
  Future<Map<String, dynamic>> _checkPreTripChecklistCompletion(int tripId) async {
    try {
      final data = await _api.get<Map<String, dynamic>>(
        '/trips/$tripId/checklist?type=pre_trip',
      );
      
      if (data == null) {
        return {'complete': false, 'remaining': '∞'}; // No checklist exists
      }

      // Check if checklist items exist and all are completed
      final items = data['items'] as List? ?? [];
      final completed = items.whereType<Map>().where((item) => item['checked'] == true).length;
      final total = items.length;
      final remaining = total - completed;

      return {
        'complete': remaining == 0 && total > 0,
        'remaining': '$remaining',
        'total': total,
        'completed': completed,
      };
    } catch (e) {
      // If we can't fetch checklist, assume it's not complete (safe default)
      return {'complete': false, 'remaining': '?'};
    }
  }
}

final tripDetailProvider =
    FutureProvider.family<Trip, int>((ref, tripId) async {
  // Check cache first
  final cached = ref.read(tripsCacheProvider).get('trip_detail_$tripId');
  if (cached != null && cached is Trip) {
    return cached;
  }

  final api = ref.read(apiServiceProvider);
  final trip = await api.get<Trip>(
    '/trips/$tripId',
    fromJson: (d) => Trip.fromJson(d as Map<String, dynamic>),
  );
  
  // Cache the result
  ref.read(tripsCacheProvider).set('trip_detail_$tripId', trip);
  
  return trip;
});
