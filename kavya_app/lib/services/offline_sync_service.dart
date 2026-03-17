import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/kt_colors.dart';
import 'api_service.dart';

final offlineSyncProvider = Provider<OfflineSyncService>((ref) {
  return OfflineSyncService();
});

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

class OfflineSyncService {
  late Box _fleetCache;
  late Box _acctCache;
  late Box _assocCache;
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
    _fleetCache = await Hive.openBox('fleet_cache'); // TTL: 30 minutes
    _acctCache = await Hive.openBox('acct_cache');   // TTL: 15 minutes
    _assocCache = await Hive.openBox('assoc_cache'); // TTL: 10 minutes
    
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
    // Project Associate offline queue: LR creation, EWB generation stored locally [cite: 106]
    // -> retry automatically when connection restored [cite: 106]
    if (_offlineQueue.isEmpty) return;
    
    _currentStatus = OfflineSyncStatus(
      queuedCount: _offlineQueue.length,
      isSyncing: true,
      lastSyncTime: _currentStatus.lastSyncTime,
    );
    _emitStatus();
    
    debugPrint("Syncing ${_offlineQueue.length} pending offline actions...");
    
    // NEW: Sync Hive queue for failed API requests
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
        // Stop syncing on first failure — retry later
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
    
    // Mark sync as complete
    _currentStatus = OfflineSyncStatus(
      queuedCount: _offlineQueue.length,
      isSyncing: false,
      lastSyncTime: DateTime.now(),
    );
    _emitStatus();
  }

  // NEW: Enqueue a request for offline retry
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