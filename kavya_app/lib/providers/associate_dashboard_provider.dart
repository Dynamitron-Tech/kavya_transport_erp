import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart';

final associateDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async { //
  final api = ref.read(apiServiceProvider);
  return await api.getDashboardAssociate(); //
});

final paActionCenterProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getPAActionCenter();
  final data = response['data'] ?? response['actions'] ?? response;
  return data is List ? List<dynamic>.from(data) : [];
});

final paJobPipelineProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getPAJobPipeline();
  final data = response['data'] ?? response['jobs'] ?? response;
  return data is List ? List<dynamic>.from(data) : [];
});

final paRecentActivityProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getPARecentActivity();
});