import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'api_service.dart';

/// Background GPS service — sends pings every 30 seconds while a trip is active.
/// Automation D-01: GPS ping every 30s when trip is active.
/// Automation D-09: Battery optimization whitelist prompt.
class BackgroundGpsService {
  static final BackgroundGpsService _instance = BackgroundGpsService._internal();
  factory BackgroundGpsService() => _instance;
  BackgroundGpsService._internal();

  Timer? _timer;
  int? _activeTripId;
  final ApiService _api = ApiService();
  bool _isRunning = false;

  bool get isRunning => _isRunning;
  int? get activeTripId => _activeTripId;

  /// Request all location permissions required for GPS tracking.
  Future<bool> requestPermissions() async {
    // Fine location first
    var status = await Permission.locationWhenInUse.request();
    if (!status.isGranted) {
      debugPrint('[GPS] Location permission denied');
      return false;
    }

    // Background location (Android 10+)
    final bgStatus = await Permission.locationAlways.request();
    if (!bgStatus.isGranted) {
      debugPrint('[GPS] Background location denied — tracking will pause when backgrounded');
    }

    return true;
  }

  /// D-09: Prompt user to whitelist app from battery optimization.
  /// This prevents Android from killing the background GPS timer.
  Future<void> requestBatteryOptimizationWhitelist() async {
    final status = await Permission.ignoreBatteryOptimizations.status;
    if (!status.isGranted) {
      final result = await Permission.ignoreBatteryOptimizations.request();
      if (result.isGranted) {
        debugPrint('[GPS] Battery optimization whitelist granted');
      } else {
        debugPrint('[GPS] Battery optimization whitelist denied');
      }
    }
  }

  /// Start sending GPS pings for the given trip.
  Future<void> startTracking(int tripId) async {
    if (_isRunning && _activeTripId == tripId) return;

    final hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // D-09: Ask for battery whitelist on first trip start
    await requestBatteryOptimizationWhitelist();

    _activeTripId = tripId;
    _isRunning = true;
    debugPrint('[GPS] Tracking started for trip $tripId');

    // Send first ping immediately
    await _sendPing();

    // Then every 30 seconds
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _sendPing());
  }

  /// Stop GPS tracking (trip ended/completed).
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    _isRunning = false;
    debugPrint('[GPS] Tracking stopped for trip $_activeTripId');
    _activeTripId = null;
  }

  Future<void> _sendPing() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      );

      await _api.sendGpsPing(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        tripId: _activeTripId,
      );

      debugPrint('[GPS] Ping sent: ${position.latitude}, ${position.longitude}');
    } catch (e) {
      debugPrint('[GPS] Ping failed: $e');
      // Don't stop tracking on transient failures — next timer tick will retry
    }
  }

  void dispose() {
    stopTracking();
  }
}
