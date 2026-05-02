import 'package:flutter_riverpod/flutter_riverpod.dart';

class CacheEntry<T> {
  final T data;
  final DateTime timestamp;
  final Duration ttl; // Time to live

  CacheEntry(this.data, {Duration? ttl}) 
    : timestamp = DateTime.now(),
      ttl = ttl ?? const Duration(minutes: 5);

  bool get isExpired => DateTime.now().difference(timestamp) > ttl;
  bool get isValid => !isExpired;
}

class CacheManager<T> {
  final Map<String, CacheEntry<T>> _cache = {};

  T? get(String key) {
    final entry = _cache[key];
    if (entry != null && entry.isValid) {
      return entry.data;
    }
    if (entry != null && entry.isExpired) {
      _cache.remove(key);
    }
    return null;
  }

  void set(String key, T data, {Duration? ttl}) {
    _cache[key] = CacheEntry(data, ttl: ttl);
  }

  void invalidate(String key) {
    _cache.remove(key);
  }

  void invalidateAll() {
    _cache.clear();
  }

  void invalidatePattern(String pattern) {
    final regex = RegExp(pattern);
    _cache.removeWhere((key, _) => regex.hasMatch(key));
  }
}

// Trip cache manager
final tripsCacheProvider = StateProvider<CacheManager<List<dynamic>>>((ref) {
  return CacheManager<List<dynamic>>();
});

// Expense cache manager
final expensesCacheProvider = StateProvider<CacheManager<List<dynamic>>>((ref) {
  return CacheManager<List<dynamic>>();
});

// Attendance cache manager
final attendanceCacheProvider = StateProvider<CacheManager<List<dynamic>>>((ref) {
  return CacheManager<List<dynamic>>();
});

// Notification cache manager
final notificationsCacheProvider = StateProvider<CacheManager<List<dynamic>>>((ref) {
  return CacheManager<List<dynamic>>();
});
