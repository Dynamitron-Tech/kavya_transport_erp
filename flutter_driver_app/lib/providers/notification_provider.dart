import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/notification_model.dart';
import '../services/api_service.dart';

final notificationListProvider = StateNotifierProvider<NotificationListNotifier,
    AsyncValue<List<NotificationModel>>>((ref) {
  return NotificationListNotifier(ApiService());
});

class NotificationListNotifier
    extends StateNotifier<AsyncValue<List<NotificationModel>>> {
  final ApiService _api;

  NotificationListNotifier(this._api) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final data = await _api.get<Map<String, dynamic>>('/notifications/');
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) =>
                  NotificationModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.patch('/notifications/$id/read', data: {});
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data(current); // refresh
    } catch (_) {}
  }
}
