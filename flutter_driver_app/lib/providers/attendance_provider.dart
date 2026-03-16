import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/attendance.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';

final locationServiceProvider =
    Provider<LocationService>((ref) => LocationService());

final attendanceProvider =
    StateNotifierProvider<AttendanceNotifier, AsyncValue<Attendance?>>(
        (ref) {
  return AttendanceNotifier(ApiService(), ref.read(locationServiceProvider));
});

class AttendanceNotifier extends StateNotifier<AsyncValue<Attendance?>> {
  final ApiService _api;
  final LocationService _location;

  AttendanceNotifier(this._api, this._location)
      : super(const AsyncValue.loading()) {
    _loadToday();
  }

  Future<void> _loadToday() async {
    try {
      final data = await _api.get<Map<String, dynamic>>('/attendance/today');
      state = AsyncValue.data(Attendance.fromJson(data));
    } catch (_) {
      state = const AsyncValue.data(null);
    }
  }

  Future<void> checkIn() async {
    state = const AsyncValue.loading();
    try {
      final position = await _location.getCurrentPosition();
      final data = await _api.post<Map<String, dynamic>>(
        '/attendance/check-in',
        data: {
          if (position != null) 'lat': position.latitude,
          if (position != null) 'lng': position.longitude,
        },
      );
      state = AsyncValue.data(Attendance.fromJson(data));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> checkOut() async {
    state = const AsyncValue.loading();
    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/attendance/check-out',
        data: {},
      );
      state = AsyncValue.data(Attendance.fromJson(data));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
