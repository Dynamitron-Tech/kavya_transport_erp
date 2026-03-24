import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class LocationService {
  final ApiService _api = ApiService();
  StreamSubscription<Position>? _positionSubscription;

  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  void startTracking({
    required String vehicleId,
    Duration interval = const Duration(seconds: 30),
  }) {
    _positionSubscription?.cancel();
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50,
      ),
    ).listen((position) {
      _sendGpsPing(vehicleId, position);
    });
  }

  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
  }

  Future<void> _sendGpsPing(String vehicleId, Position position) async {
    try {
      await _api.sendGpsPing(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed * 3.6, // m/s → km/h
        heading: position.heading,
      );
    } catch (_) {
      // GPS ping failures are silently ignored — next ping will retry
    }
  }
}
