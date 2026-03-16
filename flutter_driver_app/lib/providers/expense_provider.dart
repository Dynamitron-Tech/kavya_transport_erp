import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/expense.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';

final offlineServiceProvider = Provider<OfflineService>((ref) => OfflineService());

final expensesProvider = StateNotifierProvider.family<ExpensesNotifier,
    AsyncValue<List<Expense>>, int?>((ref, tripId) {
  return ExpensesNotifier(ref.read(apiServiceProvider), ref.read(offlineServiceProvider), tripId);
});

final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

class ExpensesNotifier extends StateNotifier<AsyncValue<List<Expense>>> {
  final ApiService _api;
  final OfflineService _offline;
  final int? tripId;

  ExpensesNotifier(this._api, this._offline, this.tripId)
      : super(const AsyncValue.loading()) {
    fetchExpenses();
  }

  Future<void> fetchExpenses() async {
    state = const AsyncValue.loading();
    try {
      final path = tripId != null ? '/expenses/?trip_id=$tripId' : '/expenses/';
      final data = await _api.get<Map<String, dynamic>>(path);
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) => Expense.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addExpense(Expense expense) async {
    try {
      await _api.post('/expenses/', data: expense.toJson());
      await fetchExpenses();
    } catch (_) {
      // Offline-first: queue the write
      await _offline.enqueue(
        method: 'POST',
        path: '/expenses/',
        data: expense.toJson(),
      );
      // Optimistic update
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data([...current, expense]);
    }
  }
}
