import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/checklist.dart';
import '../services/api_service.dart';
import '../services/offline_sync_service.dart';

final checklistProvider = StateNotifierProvider.family<ChecklistNotifier,
    AsyncValue<Checklist>, ({int tripId, String type})>((ref, params) {
  return ChecklistNotifier(
    ApiService(),
    ref.read(offlineSyncProvider),
    params.tripId,
    params.type,
  );
});

class ChecklistNotifier extends StateNotifier<AsyncValue<Checklist>> {
  final ApiService _api;
  final OfflineSyncService _offline;
  final int tripId;
  final String type;

  ChecklistNotifier(this._api, this._offline, this.tripId, this.type)
      : super(const AsyncValue.loading()) {
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api
          .get('/trips/$tripId/checklist?type=$type');
      state = AsyncValue.data(Checklist.fromJson(data));
    } catch (_) {
      // No existing checklist — start with defaults
      state = AsyncValue.data(Checklist(
        tripId: tripId,
        type: type,
        items: defaultPreTripItems(),
      ));
    }
  }

  void toggleItem(String itemId, bool checked) {
    final current = state.valueOrNull;
    if (current == null) return;
    final updated = current.items
        .map((i) => i.id == itemId ? i.copyWith(checked: checked) : i)
        .toList();
    state = AsyncValue.data(current.copyWith(items: updated));
  }

  void setNotes(String notes) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(notes: notes));
  }

  Future<void> submit() async {
    final current = state.valueOrNull;
    if (current == null) return;
    
    // Save current state for potential rollback
    final previousState = state;
    
    try {
      // Optimistic update - mark as submitted immediately
      state = AsyncValue.data(current.copyWith(
        completedAt: DateTime.now().toIso8601String(),
      ));
      
      // Send to server
      await _api.post('/trips/$tripId/checklist', data: current.toJson());
      
      // Success - keep optimistic state
    } catch (e) {
      // Rollback on failure
      state = previousState;
      
      // Fallback to offline sync
      await _offline.enqueueRequest(
        method: 'POST',
        path: '/trips/$tripId/checklist',
        data: current.toJson(),
      );
      
      rethrow;
    }
  }
}
