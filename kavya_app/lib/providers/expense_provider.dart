import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/expense.dart';
import '../services/api_service.dart';
import '../services/offline_sync_service.dart';
import 'cache_manager_provider.dart';
import 'fleet_dashboard_provider.dart'; // canonical apiServiceProvider
import 'recent_activity_provider.dart';

final offlineServiceProvider = Provider<OfflineSyncService>((ref) => OfflineSyncService());

// Paginated expenses provider
final expensesPaginatedProvider = StateNotifierProvider.family<
    ExpensesPaginationNotifier,
    AsyncValue<PaginatedExpenses>,
    int?>((ref, tripId) {
  return ExpensesPaginationNotifier(
    ref.read(apiServiceProvider),
    ref.read(offlineServiceProvider),
    ref,
    tripId,
  );
});

class PaginatedExpenses {
  final List<Expense> items;
  final int currentPage;
  final int pageSize;
  final int total;
  final bool hasMore;

  PaginatedExpenses({
    required this.items,
    required this.currentPage,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });

  PaginatedExpenses copyWith({
    List<Expense>? items,
    int? currentPage,
    int? pageSize,
    int? total,
    bool? hasMore,
  }) {
    return PaginatedExpenses(
      items: items ?? this.items,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      total: total ?? this.total,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class ExpensesPaginationNotifier extends StateNotifier<AsyncValue<PaginatedExpenses>> {
  final ApiService _api;
  final OfflineSyncService _offline;
  final Ref _ref;
  final int? tripId;
  int _currentPage = 1;
  final int _pageSize = 15;
  List<Expense> _allExpenses = [];

  ExpensesPaginationNotifier(
    this._api,
    this._offline,
    this._ref,
    this.tripId,
  ) : super(const AsyncValue.loading()) {
    fetchExpenses();
  }

  Future<void> fetchExpenses({bool reset = false}) async {
    if (reset) {
      _currentPage = 1;
      _allExpenses = [];
      state = const AsyncValue.loading();
    }

    try {
      final tripFilter = tripId != null ? '&trip_id=$tripId' : '';
      final response = await _api.get(
        '/expenses?page=$_currentPage&limit=$_pageSize$tripFilter',
      );
      // API response: {success, data: {items: [...], total: ...}}
      final innerData = response['data'] is Map
          ? Map<String, dynamic>.from(response['data'] as Map)
          : <String, dynamic>{};
      final items = (innerData['items'] as List<dynamic>?)
          ?.map((e) => Expense.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList() ?? [];

      final total = innerData['total'] as int? ?? 0;

      if (reset) {
        _allExpenses = items;
      } else {
        _allExpenses.addAll(items);
      }

      state = AsyncValue.data(PaginatedExpenses(
        items: _allExpenses,
        currentPage: _currentPage,
        pageSize: _pageSize,
        total: total,
        hasMore: _allExpenses.length < total,
      ));

      _ref.read(expensesCacheProvider).set('expenses_page_$_currentPage', items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> loadMore() async {
    if (!state.maybeWhen(
      data: (data) => data.hasMore,
      orElse: () => false,
    )) {
      return;
    }
    _currentPage++;
    await fetchExpenses();
  }

  Future<void> refresh() async {
    await fetchExpenses(reset: true);
  }

  Future<void> addExpense(Expense expense, {bool biometricVerified = false, Map<String, dynamic>? extraPayload}) async {
    try {
      // Optimistic update - add immediately to UI
      final current = state.valueOrNull;
      if (current != null) {
        final updatedItems = [expense, ...current.items];
        state = AsyncValue.data(current.copyWith(
          items: updatedItems,
          total: current.total + 1,
        ));
      }

      // Send to server (include biometric flag + payment method extras)
      final payload = {
        ...expense.toJson(),
        'biometric_verified': biometricVerified,
        if (extraPayload != null) ...extraPayload,
      };
      final response = await _api.post('/expenses', data: payload);
      // API response: {success, data: {...expense...}}
      final expenseData = (response is Map && response['data'] is Map)
          ? Map<String, dynamic>.from(response['data'] as Map)
          : (response is Map ? Map<String, dynamic>.from(response) : <String, dynamic>{});
      final createdExpense = Expense.fromJson(expenseData);

      // Update with server response (includes ID)
      if (current != null) {
        final updatedItems = current.items.map((e) {
          if (e.category == expense.category &&
              e.amount == expense.amount &&
              e.id == null) {
            return createdExpense;
          }
          return e;
        }).toList();

        state = AsyncValue.data(current.copyWith(items: updatedItems));
      }

      // Invalidate cache
      _ref.read(expensesCacheProvider).invalidatePattern('expenses_.*');
      
      // Notify recent activity feed (show feedback card on Today screen)
      _ref.read(recentExpenseProvider.notifier).setRecentExpense(createdExpense);
    } catch (e, st) {
      try {
        // On error, queue for offline sync
        await _offline.enqueueRequest(
          method: 'POST',
          path: '/expenses',
          data: expense.toJson(),
        );

        // Keep optimistic update (user sees it marked as "syncing")
        final current = state.valueOrNull;
        if (current != null) {
          // Mark expense as pending
          final updatedItems = [
            Expense(
              category: expense.category,
              amount: expense.amount,
              description: expense.description,
              receiptUrl: expense.receiptUrl,
              date: expense.date,
              status: 'pending', // Mark as pending sync
            ),
            ...current.items,
          ];
          state = AsyncValue.data(current.copyWith(items: updatedItems));
        }
      } catch (_) {
        state = AsyncValue.error(e, st);
      }
    }
  }
}

// Old provider for backward compatibility
final expensesProvider = StateNotifierProvider.family<ExpensesNotifier,
    AsyncValue<List<Expense>>, int?>((ref, tripId) {
  return ExpensesNotifier(
    ref.read(apiServiceProvider),
    ref.read(offlineServiceProvider),
    ref,
    tripId,
  );
});

class ExpensesNotifier extends StateNotifier<AsyncValue<List<Expense>>> {
  final ApiService _api;
  final OfflineSyncService _offline;
  final Ref _ref;
  final int? tripId;

  ExpensesNotifier(this._api, this._offline, this._ref, this.tripId)
      : super(const AsyncValue.loading()) {
    fetchExpenses();
  }

  Future<void> fetchExpenses() async {
    // Check cache first
    final cacheKey = 'expenses_all_${tripId ?? 'all'}';
    final cached = _ref.read(expensesCacheProvider).get(cacheKey);
    if (cached != null && cached is List<Expense>) {
      state = AsyncValue.data(cached);
      return;
    }

    state = const AsyncValue.loading();
    try {
      final path = tripId != null ? '/expenses?trip_id=$tripId' : '/expenses';
      debugPrint('[ExpensesNotifier] fetchExpenses GET $path');
      final response = await _api.get(path);
      debugPrint('[ExpensesNotifier] response type=${response.runtimeType}');
      final innerData = (response['data'] is Map ? response['data'] as Map<String, dynamic> : {});
      debugPrint('[ExpensesNotifier] innerData keys=${innerData.keys.toList()}');
      final items = (innerData['items'] as List<dynamic>?)
              ?.map((e) => Expense.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      debugPrint('[ExpensesNotifier] parsed ${items.length} expenses');
      state = AsyncValue.data(items);

      // Cache results
      _ref.read(expensesCacheProvider).set(cacheKey, items);
    } catch (e, st) {
      debugPrint('[ExpensesNotifier] fetchExpenses ERROR: $e');
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() async {
    _ref.read(expensesCacheProvider).invalidatePattern('expenses_.*');
    await fetchExpenses();
  }

  Future<void> addExpense(Expense expense, {bool biometricVerified = false, Map<String, dynamic>? extraPayload}) async {
    try {
      // Optimistic update
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data([expense, ...current]);

      // Send to server (include biometric flag + payment method extras)
      final payload = {
        ...expense.toJson(),
        'biometric_verified': biometricVerified,
        if (extraPayload != null) ...extraPayload,
      };
      debugPrint('[ExpensesNotifier] addExpense POST /expenses payload=$payload');
      final result = await _api.post('/expenses', data: payload);
      debugPrint('[ExpensesNotifier] addExpense POST result=$result');

      // Success - refresh to get server ID
      await refresh();
    } catch (e, st) {
      debugPrint('[ExpensesNotifier] addExpense ERROR: $e');
      try {
        // Offline-first: queue the write
        await _offline.enqueueRequest(
          method: 'POST',
          path: '/expenses',
          data: expense.toJson(),
        );
        // Keep optimistic update with pending status
      } catch (_) {
        state = AsyncValue.error(e, st);
      }
    }
  }
}
