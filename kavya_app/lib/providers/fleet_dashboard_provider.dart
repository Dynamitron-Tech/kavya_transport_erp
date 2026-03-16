import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

final apiServiceProvider = Provider((ref) => ApiService());

final fleetDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async { //
  final link = ref.keepAlive(); // Caches result 
  final timer = Timer(const Duration(seconds: 60), () { // for 60 seconds 
    link.close();
  });
  ref.onDispose(() => timer.cancel());

  final api = ref.read(apiServiceProvider);
  return await api.getDashboardFleet(); //
});