import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'api_service.dart';

class OfflineService {
  static const String _queueBoxName = 'offline_queue';
  final ApiService _api = ApiService();

  Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox<String>(_queueBoxName);
  }

  Future<void> enqueue({
    required String method,
    required String path,
    Map<String, dynamic>? data,
  }) async {
    final box = Hive.box<String>(_queueBoxName);
    final entry = jsonEncode({
      'method': method,
      'path': path,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
    });
    await box.add(entry);
  }

  Future<int> get pendingCount async {
    final box = Hive.box<String>(_queueBoxName);
    return box.length;
  }

  Future<void> syncAll() async {
    final box = Hive.box<String>(_queueBoxName);
    final keys = box.keys.toList();

    for (final key in keys) {
      final raw = box.get(key);
      if (raw == null) continue;

      final entry = jsonDecode(raw) as Map<String, dynamic>;
      try {
        switch (entry['method']) {
          case 'POST':
            await _api.post(entry['path'], data: entry['data']);
            break;
          case 'PUT':
            await _api.put(entry['path'], data: entry['data']);
            break;
          case 'PATCH':
            await _api.patch(entry['path'], data: entry['data']);
            break;
        }
        await box.delete(key);
      } catch (_) {
        // Stop syncing on first failure — retry later
        break;
      }
    }
  }
}
