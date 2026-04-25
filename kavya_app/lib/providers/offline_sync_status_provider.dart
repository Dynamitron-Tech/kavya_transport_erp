import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import '../services/offline_sync_service.dart';

// Re-export OfflineSyncStatus from service so widgets can import from either place
export '../services/offline_sync_service.dart' show OfflineSyncStatus;

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
