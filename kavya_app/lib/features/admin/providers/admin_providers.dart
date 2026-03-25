import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/fleet_dashboard_provider.dart';

// ─── Dashboard Stats ────────────────────────────────────────────────────────

final adminDashboardStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/admin/dashboard/stats');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  return {};
});

// ─── Role Health ────────────────────────────────────────────────────────────

final adminRoleHealthProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/admin/dashboard/role-health');
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Compliance Alerts ──────────────────────────────────────────────────────

final adminComplianceSeverityFilter = StateProvider<String?>((ref) => null);
final adminComplianceCategoryFilter = StateProvider<String?>((ref) => null);

final adminComplianceAlertsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final severity = ref.watch(adminComplianceSeverityFilter);
  final category = ref.watch(adminComplianceCategoryFilter);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/admin/compliance/alerts', queryParameters: {
    if (severity != null) 'severity': severity,
    if (category != null) 'category': category,
  });
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

final complianceAlertCountProvider = StateProvider<int>((ref) => 0);

// ─── Finance Summary ────────────────────────────────────────────────────────

final adminFinanceSummaryProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/admin/finance/summary');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  return {};
});

final adminPayablesSummaryProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/admin/finance/payables-summary');
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Operations (Trips) ──────────────────────────────────────────────────────

final adminOpsFilterProvider = StateProvider<String?>((ref) => null);

final adminOperationsTripsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final status = ref.watch(adminOpsFilterProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/trips', queryParameters: {
    if (status != null) 'status': status,
    'limit': 50,
  });
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Operations (Jobs — legacy, unused in UI) ─────────────────────────────────────

final adminOperationsJobsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final status = ref.watch(adminOpsFilterProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/jobs', queryParameters: {
    if (status != null) 'status': status,
    'limit': 50,
  });
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Employees ──────────────────────────────────────────────────────────────

final adminEmployeeRoleFilter = StateProvider<String?>((ref) => null);
final adminEmployeeSearchProvider = StateProvider<String>((ref) => '');

final adminEmployeesProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final role = ref.watch(adminEmployeeRoleFilter);
  final search = ref.watch(adminEmployeeSearchProvider);
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/users', queryParameters: {
    'include_drivers': 'true',
    if (role != null) 'role': role,
    if (search.isNotEmpty) 'search': search,
    'limit': 100,
  });
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Branches ───────────────────────────────────────────────────────────────

final adminBranchesProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/branches');
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Invoices (recent) ──────────────────────────────────────────────────────

final adminRecentInvoicesProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/finance/invoices', queryParameters: {
    'limit': 5,
    'sort': 'created_at:desc',
  });
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Clients (for masters) ──────────────────────────────────────────────────

final adminClientListProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/clients', queryParameters: {'limit': 50});
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Vehicles (for masters) ─────────────────────────────────────────────────

final adminVehicleListProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response =
      await api.get('/vehicles', queryParameters: {'limit': 50});
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});

// ─── Drivers (for masters) ──────────────────────────────────────────────────

final adminDriverListProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/drivers', queryParameters: {'limit': 50});
  if (response is Map && response['data'] is List) {
    return response['data'] as List<dynamic>;
  }
  if (response is List) return response;
  return [];
});
