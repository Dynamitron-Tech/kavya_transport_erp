import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart';

final associateDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getDashboardAssociate(); //
});