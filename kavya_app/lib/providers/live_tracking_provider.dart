import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart'; // re-uses apiServiceProvider

// ── Model ──────────────────────────────────────────────────────────────────

class TruckLocation {
  final int vehicleId;
  final String registrationNo;
  final double lat;
  final double lng;
  final double speed;
  final bool ignitionOn;
  final double odometerKm;
  final String? driverName;
  final String? tripId;
  final String? tripOrigin;
  final String? tripDestination;
  final DateTime? lastPing;

  const TruckLocation({
    required this.vehicleId,
    required this.registrationNo,
    required this.lat,
    required this.lng,
    required this.speed,
    required this.ignitionOn,
    required this.odometerKm,
    this.driverName,
    this.tripId,
    this.tripOrigin,
    this.tripDestination,
    this.lastPing,
  });

  factory TruckLocation.fromJson(Map<String, dynamic> json) {
    final lastPingRaw =
        (json['last_update'] ?? json['timestamp']) as String?;
    DateTime? parsedPing;
    if (lastPingRaw != null) {
      // Python datetime: "2026-03-23 12:30:00.123456" → replace space with T
      parsedPing = DateTime.tryParse(lastPingRaw.replaceFirst(' ', 'T'));
    }
    return TruckLocation(
      vehicleId: (json['vehicle_id'] as num? ?? 0).toInt(),
      registrationNo: (json['registration_number'] ??
              json['rc_number'] ??
              json['vehicle_registration'] ??
              'Unknown')
          .toString(),
      lat: (json['latitude'] ?? json['lat'] ?? 0.0).toDouble(),
      lng: (json['longitude'] ?? json['lng'] ?? 0.0).toDouble(),
      speed: (json['speed'] ?? json['speed_kmph'] ?? json['current_speed'] ?? 0.0)
          .toDouble(),
      ignitionOn: (json['ignition_on'] as bool?) ?? false,
      odometerKm: (json['odometer'] ?? 0.0).toDouble(),
      driverName: json['driver_name'] as String?,
      tripId: json['trip_id']?.toString(),
      tripOrigin: json['origin'] as String?,
      tripDestination: json['destination'] as String?,
      lastPing: parsedPing,
    );
  }

  // ── Derived status ───────────────────────────────────────────────────────

  String get status {
    if (lastPing == null) return 'offline';
    final minutesAgo = DateTime.now().difference(lastPing!).inMinutes;
    if (minutesAgo > 5) return 'offline';
    if (speed > 5) return 'running';
    return 'on_break';
  }

  Color get statusColor {
    switch (status) {
      case 'running':
        return const Color(0xFF10B981); // green
      case 'on_break':
        return const Color(0xFFF59E0B); // amber
      default:
        return const Color(0xFF6B7280); // gray
    }
  }

  String get statusLabel {
    switch (status) {
      case 'running':
        return 'Running';
      case 'on_break':
        return 'On Break';
      default:
        return 'Offline';
    }
  }

  int get minutesSinceLastPing {
    if (lastPing == null) return 999;
    return DateTime.now().difference(lastPing!).inMinutes;
  }
}

// ── State ──────────────────────────────────────────────────────────────────

class TrackingState {
  final List<TruckLocation> trucks;
  final bool isLoading;
  final String? error;
  final String? selectedId;
  final String filter; // 'all' | 'running' | 'on_break' | 'offline'
  final String search;

  const TrackingState({
    this.trucks = const [],
    this.isLoading = false,
    this.error,
    this.selectedId,
    this.filter = 'all',
    this.search = '',
  });

  TrackingState copyWith({
    List<TruckLocation>? trucks,
    bool? isLoading,
    String? error,
    String? selectedId,
    String? filter,
    String? search,
    bool clearSelected = false,
    bool clearError = false,
  }) {
    return TrackingState(
      trucks: trucks ?? this.trucks,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      selectedId: clearSelected ? null : (selectedId ?? this.selectedId),
      filter: filter ?? this.filter,
      search: search ?? this.search,
    );
  }

  List<TruckLocation> get filteredTrucks {
    return trucks.where((t) {
      if (filter != 'all' && t.status != filter) return false;
      if (search.isNotEmpty) {
        final q = search.toLowerCase();
        final matchReg = t.registrationNo.toLowerCase().contains(q);
        final matchDriver =
            t.driverName?.toLowerCase().contains(q) ?? false;
        return matchReg || matchDriver;
      }
      return true;
    }).toList();
  }

  int get runningCount => trucks.where((t) => t.status == 'running').length;
  int get onBreakCount => trucks.where((t) => t.status == 'on_break').length;
  int get offlineCount => trucks.where((t) => t.status == 'offline').length;

  TruckLocation? get selectedTruck {
    if (selectedId == null) return null;
    try {
      return trucks.firstWhere((t) => t.vehicleId.toString() == selectedId);
    } catch (_) {
      return null;
    }
  }
}

// ── Notifier ───────────────────────────────────────────────────────────────

class TrackingNotifier extends StateNotifier<TrackingState> {
  final dynamic _api;
  Timer? _timer;

  TrackingNotifier(this._api) : super(const TrackingState()) {
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _fetch());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: state.trucks.isEmpty, clearError: true);
    try {
      final res = await _api.get('/tracking/live');
      final rawList = (res is Map ? res['data'] : res) as List<dynamic>? ?? [];
      final trucks = rawList
          .map((e) => TruckLocation.fromJson(e as Map<String, dynamic>))
          .where((t) => t.lat != 0 && t.lng != 0)
          .toList();
      if (!mounted) return;
      state = state.copyWith(trucks: trucks, isLoading: false, clearError: true);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load tracking data',
      );
    }
  }

  void refresh() => _fetch();

  void selectTruck(String? vehicleId) {
    state = state.copyWith(selectedId: vehicleId, clearSelected: vehicleId == null);
  }

  void setFilter(String filter) {
    state = state.copyWith(filter: filter, clearSelected: true);
  }

  void setSearch(String search) {
    state = state.copyWith(search: search);
  }
}

// ── Provider ───────────────────────────────────────────────────────────────

final trackingProvider =
    StateNotifierProvider<TrackingNotifier, TrackingState>((ref) {
  final api = ref.read(apiServiceProvider);
  return TrackingNotifier(api);
});
