import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import '../services/offline_sync_service.dart';

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

// Track offline sync visibility - streams from service
final offlineSyncStatusProvider = StreamProvider<OfflineSyncStatus>((ref) {
  final offlineService = ref.read(offlineSyncProvider);
  return offlineService.statusStream;
});

// Manual sync trigger
final offlineSyncNotifierProvider = 
  StateNotifierProvider<OfflineSyncNotifier, AsyncValue<void>>((ref) {
    return OfflineSyncNotifier(ref.read(offlineSyncProvider));
  });

class OfflineSyncNotifier extends StateNotifier<AsyncValue<void>> {
  final OfflineSyncService _offlineService;

  OfflineSyncNotifier(this._offlineService) : super(const AsyncValue.data(null));

  Future<void> syncNow() async {
    state = const AsyncValue.loading();
    try {
      await _offlineService.syncAll();
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
