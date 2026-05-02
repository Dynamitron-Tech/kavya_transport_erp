import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/fleet_dashboard_provider.dart';
export '../../../core/services/fcm_service.dart' show unreadNotificationCountProvider;

// ─── Dashboard ──────────────────────────────────────────────────────────────

final managerDashboardStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/manager/dashboard/stats');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  return {};
});

final managerSparklineProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/manager/dashboard/revenue-sparkline');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  return {};
});

final managerUnassignedJobsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/jobs', queryParameters: {
    'limit': 20,
  });
  List<dynamic> all = [];
  if (response is Map && response['data'] is List) {
    all = response['data'] as List<dynamic>;
  } else if (response is List) {
    all = response;
  }
  const unassignedStatuses = {'DRAFT', 'PENDING_APPROVAL', 'APPROVED'};
  final filtered = all
      .where((j) => unassignedStatuses.contains((j['status'] as String?)?.toUpperCase()))
      .take(5)
      .toList();
  return filtered;
});

// ─── Job List ──────────────────────────────────────────────────────────────

class ManagerJobFilter {
  final String? status;
  final int? clientId;
  final int page;
  const ManagerJobFilter({this.status, this.clientId, this.page = 1});

  ManagerJobFilter copyWith({String? status, int? clientId, int? page}) =>
      ManagerJobFilter(
        status: status ?? this.status,
        clientId: clientId ?? this.clientId,
        page: page ?? this.page,
      );
}

final managerJobFilterProvider = StateProvider<ManagerJobFilter>((ref) => const ManagerJobFilter());

final managerJobListProvider = FutureProvider<List<dynamic>>((ref) async {
  final filter = ref.watch(managerJobFilterProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/jobs', queryParameters: {
    if (filter.status != null) 'status': filter.status,
    if (filter.clientId != null) 'client_id': filter.clientId,
    'page': filter.page,
    'limit': 20,
  });
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

// ─── Client List ───────────────────────────────────────────────────────────

final managerClientSearchProvider = StateProvider<String>((ref) => '');

final managerClientListProvider = FutureProvider<List<dynamic>>((ref) async {
  final search = ref.watch(managerClientSearchProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/clients', queryParameters: {
    if (search.isNotEmpty) 'search': search,
    'limit': 50,
  });
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

// ─── Fleet ─────────────────────────────────────────────────────────────────

final managerFleetSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/vehicles/summary');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  return {};
});

final managerVehicleListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/vehicles', queryParameters: {'limit': 100});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

// ─── Reports ───────────────────────────────────────────────────────────────

final managerReportPeriodProvider = StateProvider<String>((ref) => 'month');

final managerReportsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final period = ref.watch(managerReportPeriodProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/reports/summary', queryParameters: {'period': period});
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

// ─── Approvals ─────────────────────────────────────────────────────────────

final managerApprovalTypeProvider = StateProvider<String>((ref) => 'all');

final managerApprovalsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final type = ref.watch(managerApprovalTypeProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/manager/dashboard/approvals', queryParameters: {
    'type': type,
  });
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

final approvalCountProvider = StateProvider<int>((ref) => 0);

// ─── Available vehicles/drivers for assignment ─────────────────────────────

final managerAvailableVehiclesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/vehicles', queryParameters: {'limit': 100});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

final managerAvailableDriversProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/drivers', queryParameters: {'limit': 100});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

// ─── Notifications ─────────────────────────────────────────────────────────

final managerNotificationsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/my-notifications', queryParameters: {'limit': 50});
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});
