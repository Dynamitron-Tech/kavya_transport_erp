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
      final raw = await _api.get('/trips/$tripId/checklist?type=$type');
      // API wraps responses in {success, data:{...}} — unwrap the inner payload
      final payload = (raw is Map && raw.containsKey('data'))
          ? raw['data'] as Map<String, dynamic>
          : raw as Map<String, dynamic>;
      state = AsyncValue.data(Checklist.fromJson(payload));
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

  void setItems(List<ChecklistItem> items) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(items: items));
  }

  void setNotes(String notes) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(notes: notes));
  }

  void setLocation(double latitude, double longitude) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(latitude: latitude, longitude: longitude));
  }

  Future<void> submit() async {
    final current = state.valueOrNull;
    if (current == null) return;
    
    // Optimistic update — mark as submitted immediately before the request
    final submittedAt = DateTime.now().toIso8601String();
    state = AsyncValue.data(current.copyWith(
      completedAt: submittedAt,
    ));

    try {
      await _api.post('/trips/$tripId/checklist', data: current.toJson());
    } catch (e) {
      // Keep optimistic completedAt so the LOADED button unlocks,
      // then queue for background retry.
      await _offline.enqueueRequest(
        method: 'POST',
        path: '/trips/$tripId/checklist',
        data: current.toJson(),
      );
      rethrow;
    }
  }
}
