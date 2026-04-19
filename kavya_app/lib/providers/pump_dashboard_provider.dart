import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/fuel.dart';
import '../services/api_service.dart';

final _api = ApiService();

/// Dashboard stats for the pump operator home screen.
final pumpDashboardProvider = FutureProvider.autoDispose<FuelDashboardStats>((ref) async {
  final res = await _api.get('/fuel-pump/dashboard');
  final data = res['data'] ?? res;
  return FuelDashboardStats.fromJson(data as Map<String, dynamic>);
});

/// All fuel tanks.
final fuelTanksProvider = FutureProvider.autoDispose<List<FuelTank>>((ref) async {
  final res = await _api.get('/fuel-pump/tanks');
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelTank.fromJson(e as Map<String, dynamic>)).toList();
});

/// Today's fuel issues list.
final todayFuelIssuesProvider = FutureProvider.autoDispose<List<FuelIssue>>((ref) async {
  final today = DateTime.now().toIso8601String().split('T').first;
  final res = await _api.get('/fuel-pump/issues', queryParameters: {
    'date_from': today,
    'date_to': today,
    'limit': 100,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
});

/// Fuel issues for a specific vehicle registration number (all-time).
final vehicleFuelHistoryProvider =
    FutureProvider.autoDispose.family<List<FuelIssue>, String>((ref, registration) async {
  final res = await _api.get('/fuel-pump/issues', queryParameters: {
    'registration': registration.toUpperCase(),
    'limit': 200,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
});

/// Open mismatch / theft alerts.
final fuelAlertsProvider = FutureProvider.autoDispose<List<FuelTheftAlert>>((ref) async {
  final res = await _api.get('/fuel-pump/alerts', queryParameters: {
    'status': 'OPEN',
    'limit': 50,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelTheftAlert.fromJson(e as Map<String, dynamic>)).toList();
});

/// Vehicle list for the fuel issue form dropdown.
final vehicleListProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/vehicles');
  final payload = res['data'] ?? res;
  if (payload is List) {
    return payload.cast<Map<String, dynamic>>();
  }
  return [];
});

final driversProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/drivers', queryParameters: {'limit': 500});
  final payload = (res['data'] ?? res);
  if (payload is List) {
    return payload.cast<Map<String, dynamic>>();
  }
  return [];
});

/// Notifier to submit a new fuel issue.
class FuelIssueNotifier extends StateNotifier<AsyncValue<void>> {
  FuelIssueNotifier() : super(const AsyncData(null));

  Future<bool> issueFuel({
    int? tankId,
    int? vehicleId,
    int? driverId,
    String? externalVehicleNumber,
    required double quantityLitres,
    required double ratePerLitre,
    String fuelType = 'DIESEL',
    double? odometerReading,
    String? remarks,
    String? receiptNumber,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/issues', data: {
        if (tankId != null) 'tank_id': tankId,
        if (vehicleId != null) 'vehicle_id': vehicleId,
        if (driverId != null) 'driver_id': driverId,
        if (externalVehicleNumber != null) 'external_vehicle_number': externalVehicleNumber,
        'fuel_type': fuelType.toUpperCase(),
        'quantity_litres': quantityLitres,
        'rate_per_litre': ratePerLitre,
        'issued_at': DateTime.now().toIso8601String(),
        if (odometerReading != null) 'odometer_reading': odometerReading,
        if (remarks != null) 'remarks': remarks,
        if (receiptNumber != null) 'receipt_number': receiptNumber,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final fuelIssueNotifierProvider =
    StateNotifierProvider<FuelIssueNotifier, AsyncValue<void>>(
  (ref) => FuelIssueNotifier(),
);

/// Today's diesel rate per litre — set from Dashboard's "Update Rate" sheet.
/// Persists in memory for the session.
final pumpRatePerLitreProvider = StateProvider<double>((ref) => 93.21);

/// Today's petrol rate per litre — set from Dashboard's "Update Rate" sheet.
/// Persists in memory for the session.
final pumpPetrolRatePerLitreProvider = StateProvider<double>((ref) => 103.50);

// ─── Dashboard selected date (today by default) ───────────────────────────
final pumpDashboardDateProvider = StateProvider<DateTime>((ref) => DateTime.now());

// ─── History selected date ────────────────────────────────────────────────
final pumpHistoryDateProvider = StateProvider<DateTime>((ref) => DateTime.now());

/// Fuel issues for a specific date (used by Dashboard and History).
final pumpFuelIssuesByDateProvider =
    FutureProvider.autoDispose.family<List<FuelIssue>, String>((ref, dateStr) async {
  final res = await _api.get('/fuel-pump/issues', queryParameters: {
    'date_from': dateStr,
    'date_to': dateStr,
    'limit': 200,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
});

/// Dashboard stats for a specific date.
final pumpStatsByDateProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, dateStr) async {
  final issues = await ref.watch(pumpFuelIssuesByDateProvider(dateStr).future);
  final totalLitres = issues.fold<double>(0, (sum, i) => sum + i.quantityLitres);
  final totalCost = issues.fold<double>(0, (sum, i) => sum + i.totalAmount);
  // Count unique vehicles from both fleet (vehicleId) and external (vehicleRegistration)
  final uniqueVehicles = issues.map((i) {
    if (i.vehicleId != null) return 'id:${i.vehicleId}';
    final reg = i.vehicleRegistration?.trim();
    if (reg != null && reg.isNotEmpty) return 'ext:$reg';
    return null;
  }).whereType<String>().toSet().length;
  final flagged = issues.where((i) => i.isFlagged).length;
  return {
    'total_litres': totalLitres,
    'total_cost': totalCost,
    'vehicle_count': uniqueVehicles,
    'mismatch_count': flagged,
    'entry_count': issues.length,
  };
});

// ─── Pump Checklist ───────────────────────────────────────────────────────
const kPumpChecklistItems = [
  'Tank level verified',
  'Fuel pump meter reset',
  'Receipt book ready',
  'Dispenser nozzle checked',
  'Shift logbook signed',
];

final pumpChecklistProvider =
    StateNotifierProvider<PumpChecklistNotifier, Set<String>>(
  (_) => PumpChecklistNotifier(),
);

class PumpChecklistNotifier extends StateNotifier<Set<String>> {
  static const _boxName = 'pump_checklist';

  String get _todayKey => DateTime.now().toIso8601String().split('T').first;

  PumpChecklistNotifier() : super({}) {
    _load();
  }

  Future<void> _load() async {
    final box = await Hive.openBox<String>(_boxName);
    final stored = box.get(_todayKey, defaultValue: '');
    if (stored != null && stored.isNotEmpty) {
      if (mounted) state = stored.split(',').toSet();
    }
  }

  Future<void> _save() async {
    final box = await Hive.openBox<String>(_boxName);
    await box.put(_todayKey, state.join(','));
  }

  void toggle(String item) {
    state = state.contains(item)
        ? state.difference({item})
        : {...state, item};
    _save();
  }

  void markDone(String item) {
    state = {...state, item};
    _save();
  }

  void unmark(String item) {
    state = state.difference({item});
    _save();
  }

  bool get allDone => state.length >= kPumpChecklistItems.length;

  void reset() {
    state = {};
    _save();
  }
}

// Per-item photo paths: item label → local file path
final pumpChecklistPhotosProvider =
    StateNotifierProvider<PumpChecklistPhotosNotifier, Map<String, String>>(
  (_) => PumpChecklistPhotosNotifier(),
);

class PumpChecklistPhotosNotifier extends StateNotifier<Map<String, String>> {
  PumpChecklistPhotosNotifier() : super({});

  void setPhoto(String item, String path) => state = {...state, item: path};

  void reset() => state = {};
}

// ─── Company & Market vehicles ────────────────────────────────────────────
final pumpCompanyVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/vehicles', queryParameters: {'limit': 500});
  final payload = res['data'] ?? res;
  final list = payload is List ? payload : (payload['items'] ?? payload['vehicles'] ?? []);
  return (list as List).cast<Map<String, dynamic>>();
});

final pumpMarketVehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/vehicles', queryParameters: {
    'ownership_type': 'MARKET',
    'limit': 500,
  });
  final payload = res['data'] ?? res;
  final list = payload is List ? payload : (payload['items'] ?? payload['vehicles'] ?? []);
  return (list as List).cast<Map<String, dynamic>>();
});

// ─── Branch model + providers ─────────────────────────────────────────────

class Branch {
  final int id;
  final String name;
  final String code;
  final String? city;
  final String? state;
  final bool isActive;

  const Branch({
    required this.id,
    required this.name,
    required this.code,
    this.city,
    this.state,
    this.isActive = true,
  });

  factory Branch.fromJson(Map<String, dynamic> j) => Branch(
        id: j['id'] as int,
        name: j['name'] as String,
        code: j['code'] as String,
        city: j['city'] as String?,
        state: j['state'] as String?,
        isActive: j['is_active'] as bool? ?? true,
      );

  String get displayName => city != null ? '$name ($city)' : name;
}

final branchesProvider = FutureProvider.autoDispose<List<Branch>>((ref) async {
  final res = await _api.get('/fuel-pump/branches');
  final list = (res['data'] ?? res) as List;
  return list.map((e) => Branch.fromJson(e as Map<String, dynamic>)).toList();
});

class CreateBranchNotifier extends StateNotifier<AsyncValue<void>> {
  CreateBranchNotifier() : super(const AsyncData(null));

  Future<bool> create({
    required String name,
    required String code,
    String? city,
    String? stateProvince,
    String? address,
    String? pincode,
    String? phone,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/branches', data: {
        'name': name,
        'code': code,
        if (city != null && city.isNotEmpty) 'city': city,
        if (stateProvince != null && stateProvince.isNotEmpty) 'state': stateProvince,
        if (address != null && address.isNotEmpty) 'address': address,
        if (pincode != null && pincode.isNotEmpty) 'pincode': pincode,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final createBranchProvider =
    StateNotifierProvider.autoDispose<CreateBranchNotifier, AsyncValue<void>>(
  (ref) => CreateBranchNotifier(),
);

class CreateTankNotifier extends StateNotifier<AsyncValue<void>> {
  CreateTankNotifier() : super(const AsyncData(null));

  Future<bool> createTank({
    required String name,
    required int branchId,
    required double capacityLitres,
    String fuelType = 'DIESEL',
    String? location,
    double? minStockAlert,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/tanks', data: {
        'name': name,
        'branch_id': branchId,
        'fuel_type': fuelType,
        'capacity_litres': capacityLitres,
        'current_stock_litres': 0,
        if (location != null && location.isNotEmpty) 'location': location,
        if (minStockAlert != null) 'min_stock_alert': minStockAlert,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final createTankProvider =
    StateNotifierProvider.autoDispose<CreateTankNotifier, AsyncValue<void>>(
  (ref) => CreateTankNotifier(),
);

/// Recent fuel issues for a specific tank (last 50).
final tankIssuesProvider =
    FutureProvider.autoDispose.family<List<FuelIssue>, int>((ref, tankId) async {
  final res = await _api.get('/fuel-pump/issues', queryParameters: {
    'tank_id': tankId,
    'limit': 50,
  });
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
});

/// Notifier to submit a top-up REQUEST (pending finance manager approval).
class TopUpTankNotifier extends StateNotifier<AsyncValue<void>> {
  TopUpTankNotifier() : super(const AsyncData(null));

  Future<bool> topUp({
    required int tankId,
    required double quantityLitres,
    double? totalAmount,
    String? remarks,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/top-up-requests', data: {
        'tank_id': tankId,
        'quantity_litres': quantityLitres,
        if (totalAmount != null) 'total_amount': totalAmount,
        if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final topUpTankProvider =
    StateNotifierProvider.autoDispose<TopUpTankNotifier, AsyncValue<void>>(
  (ref) => TopUpTankNotifier(),
);

// ─── Depot Fuel Pump model ────────────────────────────────────────────────

class DepotPump {
  final int id;
  final String name;
  final String? pumpNumber;
  final String? boothNumber;
  final String? fuelType;
  final bool isActive;
  final int? tankId;
  final int? secondaryTankId;
  final int? branchId;

  const DepotPump({
    required this.id,
    required this.name,
    this.pumpNumber,
    this.boothNumber,
    this.fuelType,
    required this.isActive,
    this.tankId,
    this.secondaryTankId,
    this.branchId,
  });

  factory DepotPump.fromJson(Map<String, dynamic> j) => DepotPump(
        id: j['id'] as int,
        name: j['name'] as String,
        pumpNumber: j['pump_number'] as String?,
        boothNumber: j['booth_number'] as String?,
        fuelType: j['fuel_type'] as String?,
        isActive: j['is_active'] as bool? ?? true,
        tankId: j['tank_id'] as int?,
        secondaryTankId: j['secondary_tank_id'] as int?,
        branchId: j['branch_id'] as int?,
      );
}

/// Pumps for a specific tank.
final pumpsForTankProvider =
    FutureProvider.autoDispose.family<List<DepotPump>, int>((ref, tankId) async {
  final res = await _api.get('/fuel-pump/pumps', queryParameters: {'tank_id': tankId});
  final list = (res['data'] ?? res) as List;
  return list.map((e) => DepotPump.fromJson(e as Map<String, dynamic>)).toList();
});

/// Pumps for a specific branch.
final pumpsForBranchProvider =
    FutureProvider.autoDispose.family<List<DepotPump>, int>((ref, branchId) async {
  final res = await _api.get('/fuel-pump/pumps', queryParameters: {'branch_id': branchId});
  final list = (res['data'] ?? res) as List;
  return list.map((e) => DepotPump.fromJson(e as Map<String, dynamic>)).toList();
});

/// Tanks filtered for a specific branch — fetched directly from API.
final tanksForBranchProvider =
    FutureProvider.autoDispose.family<List<FuelTank>, int>((ref, branchId) async {
  final res = await _api.get('/fuel-pump/tanks', queryParameters: {'branch_id': branchId});
  final list = (res['data'] ?? res) as List;
  return list.map((e) => FuelTank.fromJson(e as Map<String, dynamic>)).toList();
});

// ─── Nozzle info model ────────────────────────────────────────────────────

class NozzleInfo {
  final String nozzleId;     // e.g., "N001"
  final int nozzleNumber;    // e.g., 1
  final int pumpId;
  final String pumpName;     // e.g., "Pump 1"
  final String pumpNumber;   // e.g., "P001"
  final int? tankId;
  final String tankName;     // e.g., "Tank 1"
  final String fuelType;     // e.g., "DIESEL"
  final bool isPrimary;

  const NozzleInfo({
    required this.nozzleId,
    required this.nozzleNumber,
    required this.pumpId,
    required this.pumpName,
    required this.pumpNumber,
    this.tankId,
    required this.tankName,
    required this.fuelType,
    required this.isPrimary,
  });

  String get nozzleLabel =>
      '$nozzleId · ${isPrimary ? 'Primary' : 'Secondary'} (${fuelType[0]}${fuelType.substring(1).toLowerCase()})';
}

/// All nozzles for the current pump operator's branch, derived from dashboard tanks + branch pumps.
final nozzlesForCurrentBranchProvider =
    FutureProvider.autoDispose<List<NozzleInfo>>((ref) async {
  final dashStats = await ref.watch(pumpDashboardProvider.future);
  final tanks = dashStats.tanks;
  if (tanks.isEmpty) return [];

  final branchId = tanks.first.branchId;
  if (branchId == null) return [];

  // Build tank lookup by id
  final tankMap = <int, FuelTank>{for (final t in tanks) t.id: t};

  // Fetch pumps for this branch
  final pumps = await ref.watch(pumpsForBranchProvider(branchId).future);

  final nozzles = <NozzleInfo>[];
  for (int i = 0; i < pumps.length; i++) {
    final pump = pumps[i];
    final primaryNum = i * 2 + 1;
    final secondaryNum = i * 2 + 2;
    final primaryNozzleId = 'N${primaryNum.toString().padLeft(3, '0')}';
    final secondaryNozzleId = 'N${secondaryNum.toString().padLeft(3, '0')}';
    final pNum = pump.pumpNumber ?? 'P${(i + 1).toString().padLeft(3, '0')}';

    // Primary nozzle → primary tank
    final primaryTank = pump.tankId != null ? tankMap[pump.tankId] : null;
    nozzles.add(NozzleInfo(
      nozzleId: primaryNozzleId,
      nozzleNumber: primaryNum,
      pumpId: pump.id,
      pumpName: pump.name,
      pumpNumber: pNum,
      tankId: pump.tankId,
      tankName: primaryTank?.name ?? 'Tank ${pump.tankId}',
      fuelType: primaryTank?.fuelType ?? 'DIESEL',
      isPrimary: true,
    ));

    // Secondary nozzle → secondary tank (only if configured)
    if (pump.secondaryTankId != null) {
      final secondaryTank = tankMap[pump.secondaryTankId];
      nozzles.add(NozzleInfo(
        nozzleId: secondaryNozzleId,
        nozzleNumber: secondaryNum,
        pumpId: pump.id,
        pumpName: pump.name,
        pumpNumber: pNum,
        tankId: pump.secondaryTankId,
        tankName: secondaryTank?.name ?? 'Tank ${pump.secondaryTankId}',
        fuelType: secondaryTank?.fuelType ?? 'DIESEL',
        isPrimary: false,
      ));
    }
  }
  return nozzles;
});

class CreatePumpNotifier extends StateNotifier<AsyncValue<void>> {
  CreatePumpNotifier() : super(const AsyncData(null));

  Future<bool> create({
    required String name,
    String? pumpNumber,
    String? boothNumber,
    String? fuelType,
    int? tankId,
    int? secondaryTankId,
    int? branchId,
  }) async {
    state = const AsyncLoading();
    try {
      await _api.post('/fuel-pump/pumps', data: {
        'name': name,
        if (pumpNumber != null && pumpNumber.isNotEmpty) 'pump_number': pumpNumber,
        if (boothNumber != null && boothNumber.isNotEmpty) 'booth_number': boothNumber,
        if (fuelType != null && fuelType.isNotEmpty) 'fuel_type': fuelType,
        if (tankId != null) 'tank_id': tankId,
        if (secondaryTankId != null) 'secondary_tank_id': secondaryTankId,
        if (branchId != null) 'branch_id': branchId,
      });
      state = const AsyncData(null);
      return true;
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      return false;
    }
  }
}

final createPumpProvider =
    StateNotifierProvider.autoDispose<CreatePumpNotifier, AsyncValue<void>>(
  (ref) => CreatePumpNotifier(),
);

// ─── Top-Up Requests ─────────────────────────────────────────────────────────

final pendingTopUpRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/fuel-pump/top-up-requests', queryParameters: {'status': 'pending'});
  final data = (res is Map) ? res['data'] : res;
  if (data is List) return data.cast<Map<String, dynamic>>();
  return [];
});

/// Paid (completed) top-up requests — shown in Finance Manager's Payments history.
final paidTopUpRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await _api.get('/fuel-pump/top-up-requests', queryParameters: {'status': 'paid'});
  final data = (res is Map) ? res['data'] : res;
  if (data is List) return data.cast<Map<String, dynamic>>();
  return [];
});

class MarkTopUpPaidNotifier extends StateNotifier<AsyncValue<void>> {
  MarkTopUpPaidNotifier() : super(const AsyncData(null));

  Future<String?> markPaid(int requestId) async {
    state = const AsyncLoading();
    try {
      await _api.patch('/fuel-pump/top-up-requests/$requestId/mark-paid');
      state = const AsyncData(null);
      return null; // null = success
    } catch (e) {
      state = AsyncError(e, StackTrace.current);
      // Try to extract the backend error detail
      try {
        final dynamic err = e;
        final detail = err.response?.data?['detail'];
        if (detail is String && detail.isNotEmpty) return detail;
      } catch (_) {}
      return 'Failed to mark as paid';
    }
  }
}

final markTopUpPaidProvider =
    StateNotifierProvider.autoDispose<MarkTopUpPaidNotifier, AsyncValue<void>>(
  (ref) => MarkTopUpPaidNotifier(),
);
