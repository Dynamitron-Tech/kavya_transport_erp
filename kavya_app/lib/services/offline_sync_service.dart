import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/kt_colors.dart';

final offlineSyncProvider = Provider<OfflineSyncService>((ref) {
  return OfflineSyncService();
});

class OfflineSyncService {
  late Box _fleetCache;
  late Box _acctCache;
  late Box _assocCache;
  
  bool isOnline = true; // 
  StreamSubscription? _connectivitySubscription;

  // Initialize Hive boxes and connectivity listener
  Future<void> init() async {
    await Hive.initFlutter();
    
    // Open role-specific caches [cite: 105-106]
    _fleetCache = await Hive.openBox('fleet_cache'); // TTL: 30 minutes
    _acctCache = await Hive.openBox('acct_cache');   // TTL: 15 minutes
    _assocCache = await Hive.openBox('assoc_cache'); // TTL: 10 minutes

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

  Future<void> _syncPendingQueue() async {
    // Project Associate offline queue: LR creation, EWB generation stored locally [cite: 106]
    // -> retry automatically when connection restored [cite: 106]
    debugPrint("Syncing pending offline actions...");
    // Logic to loop through queued items in _assocCache and push to API goes here.
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
  }
}