import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/trip.dart';
import '../models/expense.dart';
import 'fleet_dashboard_provider.dart'; // canonical apiServiceProvider

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
    final data = await api.get(
      '/trips?search=$query',
    );
    
    final rawData = data['data'];
    final items = (rawData is List ? rawData : [])
        .map((e) => Trip.fromJson(e as Map<String, dynamic>))
        .toList();
    
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
    final data = await api.get(
      '/expenses?search=$query',
    );
    
    final innerData = (data['data'] is Map ? data['data'] as Map<String, dynamic> : {});
    final items = (innerData['items'] as List<dynamic>?)
        ?.map((e) => Expense.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    
    return items;
  } catch (e) {
    return [];
  }
});
