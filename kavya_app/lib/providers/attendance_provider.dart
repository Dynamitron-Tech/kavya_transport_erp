import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
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
      final today = DateTime.now();
      final dateStr =
          '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      final response = await _api.get('/attendance?date=$dateStr&limit=1');
      // API response: {success, data: {items: [...], total, page, limit}}
      final items = response['data']?['items'] as List<dynamic>? ?? [];
      if (items.isNotEmpty) {
        state = AsyncValue.data(
            Attendance.fromJson(Map<String, dynamic>.from(items.first as Map)));
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (_) {
      state = const AsyncValue.data(null);
    }
  }

  Future<void> reload() => _loadToday();

  Future<String?> checkIn({
    required String photoDataUrl,
    double? lat,
    double? lng,
    String? remarks,
  }) async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.post(
        '/attendance/check-in',
        data: {
          'photo_data_url': photoDataUrl,
          if (lat != null) 'lat': lat,
          if (lng != null) 'lng': lng,
          if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
        },
      );
      // response: {success, data: {id, date, status, check_in_time}, message}
      final data = Map<String, dynamic>.from(response['data'] as Map);
      final message = response['message'] as String? ?? 'Attendance marked';
      state = AsyncValue.data(Attendance.fromJson(data));
      return message;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Position?> getLocation() => _location.getCurrentPosition();
}
