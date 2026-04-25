import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'api_service.dart';

class OfflineSyncStatus {
  final int queuedCount;
  final bool isSyncing;
  final String? lastError;
  final DateTime? lastSyncTime;

  OfflineSyncStatus({
    required this.queuedCount,
    this.isSyncing = false,
    this.lastError,
    this.lastSyncTime,
  });

  bool get hasPending => queuedCount > 0;
  bool get isIdle => !isSyncing && !hasPending;
}

final offlineSyncProvider = Provider<OfflineSyncService>((ref) {
  return OfflineSyncService();
});

class OfflineSyncService {
  late Box<String> _offlineQueue; // NEW: Hive queue for failed requests
  
  bool isOnline = true;
  StreamSubscription? _connectivitySubscription;
  final ApiService _api = ApiService();
  
  // Sync status stream
  final StreamController<OfflineSyncStatus> _statusController = 
    StreamController<OfflineSyncStatus>.broadcast();
  
  Stream<OfflineSyncStatus> get statusStream => _statusController.stream;
  
  OfflineSyncStatus _currentStatus = OfflineSyncStatus(queuedCount: 0, isSyncing: false);
  
  OfflineSyncService() {
    _emitStatus();
  }

  // Initialize Hive boxes and connectivity listener
  Future<void> init() async {
    await Hive.initFlutter();
    
    // Open role-specific caches [cite: 105-106]
    // NEW: Open offline request queue
    _offlineQueue = await Hive.openBox<String>('offline_queue');

    // Monitor connectivity [cite: 106-107]
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> results) {
      // In connectivity_plus ^6.0.0, this returns a List<ConnectivityResult>
      bool currentlyOnline = !results.contains(ConnectivityResult.none);
      
      if (isOnline != currentlyOnline) {
        isOnline = currentlyOnline;
        _handleConnectionChange(isOnline);
      }
    });
  }

  void _handleConnectionChange(bool connected) {
    if (connected) {
      // On connection restored -> sync pending queue [cite: 106-107]
      _syncPendingQueue();
    } else {
      // On connection lost -> handled by UI to show "No internet" banner [cite: 106-107]
      debugPrint("Network connection lost");
    }
  }

  void _emitStatus() {
    _statusController.add(_currentStatus);
  }

  Future<void> _syncPendingQueue() async {
    if (_offlineQueue.isEmpty) return;
    
    _currentStatus = OfflineSyncStatus(
      queuedCount: _offlineQueue.length,
      isSyncing: true,
      lastSyncTime: _currentStatus.lastSyncTime,
    );
    _emitStatus();
    
    debugPrint("Syncing ${_offlineQueue.length} pending offline actions...");
    
    // Try batch sync first
    try {
      final keys = _offlineQueue.keys.toList();
      final actions = <Map<String, dynamic>>[];
      for (final key in keys) {
        final raw = _offlineQueue.get(key);
        if (raw == null) continue;
        final entry = jsonDecode(raw) as Map<String, dynamic>;
        actions.add({
          'method': entry['method'],
          'path': entry['path'],
          'data': entry['data'],
          'timestamp': entry['timestamp'],
          'client_action_id': entry['client_action_id'] ?? key.toString(),
        });
      }
      
      if (actions.isNotEmpty) {
        final deviceId = await _getDeviceId();
        final result = await _api.syncBatch(
          deviceId: deviceId,
          actions: actions,
        );
        
        // Remove all successfully queued items from local Hive
        for (final key in keys) {
          await _offlineQueue.delete(key);
        }
        debugPrint("Batch sync completed: ${result['accepted'] ?? 0} accepted");
      }
    } catch (e) {
      debugPrint("Batch sync failed, falling back to individual replay: $e");
      // Fallback: replay individual requests
      await _syncIndividual();
    }
    
    _currentStatus = OfflineSyncStatus(
      queuedCount: _offlineQueue.length,
      isSyncing: false,
      lastSyncTime: DateTime.now(),
    );
    _emitStatus();
  }

  Future<String> _getDeviceId() async {
    final info = DeviceInfoPlugin();
    try {
      final androidInfo = await info.androidInfo;
      return androidInfo.id;
    } catch (_) {
      try {
        final iosInfo = await info.iosInfo;
        return iosInfo.identifierForVendor ?? 'unknown-ios';
      } catch (_) {
        return 'unknown-device';
      }
    }
  }

  /// Fallback: replay queued requests one by one
  Future<void> _syncIndividual() async {
    final keys = _offlineQueue.keys.toList();
    for (final key in keys) {
      final raw = _offlineQueue.get(key);
      if (raw == null) continue;

      final entry = jsonDecode(raw) as Map<String, dynamic>;
      try {
        switch (entry['method']) {
          case 'POST':
            await _api.post(entry['path'], data: entry['data']);
            break;
          case 'PUT':
            await _api.put(entry['path'], data: entry['data']);
            break;
          case 'PATCH':
            await _api.patch(entry['path'], data: entry['data']);
            break;
        }
        await _offlineQueue.delete(key);
        debugPrint("Synced offline action: ${entry['path']}");
      } catch (e) {
        _currentStatus = OfflineSyncStatus(
          queuedCount: _offlineQueue.length,
          isSyncing: false,
          lastError: e.toString(),
          lastSyncTime: DateTime.now(),
        );
        _emitStatus();
        debugPrint("Sync failed: $e");
        break;
      }
    }
  }

  // Enqueue a request for offline retry
  Future<void> enqueueRequest({
    required String method,
    required String path,
    Map<String, dynamic>? data,
  }) async {
    final entry = jsonEncode({
      'method': method,
      'path': path,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
      'client_action_id': '${DateTime.now().millisecondsSinceEpoch}_${_offlineQueue.length}',
    });
    await _offlineQueue.add(entry);
    
    // Update status
    _currentStatus = OfflineSyncStatus(
      queuedCount: _offlineQueue.length,
      isSyncing: _currentStatus.isSyncing,
      lastError: _currentStatus.lastError,
      lastSyncTime: _currentStatus.lastSyncTime,
    );
    _emitStatus();
  }

  // NEW: Get count of pending requests
  Future<int> getPendingCount() async {
    return _offlineQueue.length;
  }

  // NEW: Manually sync all queued requests
  Future<void> syncAll() async {
    await _syncPendingQueue();
  }

  // Helper method for actions that require network [cite: 106]
  bool checkNetworkAction(BuildContext context) {
    if (!isOnline) {
      // show "Connect to internet" dialog if offline [cite: 106]
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text("No Internet Connection"),
          content: const Text("This action requires an active internet connection. Please connect and try again."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK"))
          ],
        ),
      );
      return false;
    }
    return true;
  }

  void dispose() {
    _connectivitySubscription?.cancel();
    _statusController.close();
  }
}