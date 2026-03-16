import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/checklist.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';

final checklistProvider = StateNotifierProvider.family<ChecklistNotifier,
    AsyncValue<Checklist>, ({int tripId, String type})>((ref, params) {
  return ChecklistNotifier(
    ApiService(),
    OfflineService(),
    params.tripId,
    params.type,
  );
});

class ChecklistNotifier extends StateNotifier<AsyncValue<Checklist>> {
  final ApiService _api;
  final OfflineService _offline;
  final int tripId;
  final String type;

  ChecklistNotifier(this._api, this._offline, this.tripId, this.type)
      : super(const AsyncValue.loading()) {
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api
          .get<Map<String, dynamic>>('/trips/$tripId/checklist?type=$type');
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
    state = AsyncValue.data(Checklist(
      tripId: current.tripId,
      type: current.type,
      items: updated,
      completedAt: current.completedAt,
    ));
  }

  Future<void> submit() async {
    final current = state.valueOrNull;
    if (current == null) return;
    try {
      await _api.post('/trips/$tripId/checklist', data: current.toJson());
    } catch (_) {
      await _offline.enqueue(
        method: 'POST',
        path: '/trips/$tripId/checklist',
        data: current.toJson(),
      );
    }
  }
}
