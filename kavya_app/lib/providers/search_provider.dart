import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:debounce_throttle/debounce_throttle.dart';
import '../models/trip.dart';
import '../models/expense.dart';
import '../services/api_service.dart';
import 'cache_manager_provider.dart';

final apiServiceProvider = StateProvider<ApiService>((ref) => ApiService());

// Debounced trip search provider
final tripSearchQueryProvider = StateProvider<String>((ref) => '');

final tripSearchProvider = FutureProvider.autoDispose<List<Trip>>((ref) async {
  final query = ref.watch(tripSearchQueryProvider);
  
  if (query.isEmpty) {
    return [];
  }

  // Debounce: wait before searching
  await Future.delayed(const Duration(milliseconds: 500));

  try {
    final api = ref.read(apiServiceProvider);
    final data = await api.get<Map<String, dynamic>>(
      '/trips/?search=$query',
    );
    
    final items = (data['items'] as List<dynamic>?)
        ?.map((e) => Trip.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    
    return items;
  } catch (e) {
    return [];
  }
});

// Debounced expense search provider
final expenseSearchQueryProvider = StateProvider<String>((ref) => '');

final expenseSearchProvider = FutureProvider.autoDispose<List<Expense>>((ref) async {
  final query = ref.watch(expenseSearchQueryProvider);
  
  if (query.isEmpty) {
    return [];
  }

  // Debounce: wait before searching
  await Future.delayed(const Duration(milliseconds: 500));

  try {
    final api = ref.read(apiServiceProvider);
    final data = await api.get<Map<String, dynamic>>(
      '/expenses/?search=$query',
    );
    
    final items = (data['items'] as List<dynamic>?)
        ?.map((e) => Expense.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    
    return items;
  } catch (e) {
    return [];
  }
});
