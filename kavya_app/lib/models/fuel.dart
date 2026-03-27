/// Fuel tank model matching backend DepotFuelTank schema.
class FuelTank {
  final int id;
  final String name;
  final String fuelType;
  final double capacityLitres;
  final double currentStockLitres;
  final double? minStockAlert;
  final String? location;
  final int? branchId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  FuelTank({
    required this.id,
    required this.name,
    required this.fuelType,
    required this.capacityLitres,
    required this.currentStockLitres,
    this.minStockAlert,
    this.location,
    this.branchId,
    this.createdAt,
    this.updatedAt,
  });

  double get stockPercent =>
      capacityLitres > 0 ? (currentStockLitres / capacityLitres) * 100 : 0;

  bool get isLowStock =>
      minStockAlert != null && currentStockLitres <= minStockAlert!;

  factory FuelTank.fromJson(Map<String, dynamic> json) {
    return FuelTank(
      id: json['id'] as int,
      name: json['name'] as String,
      fuelType: json['fuel_type']?.toString() ?? 'DIESEL',
      capacityLitres: _toDouble(json['capacity_litres']),
      currentStockLitres: _toDouble(json['current_stock_litres']),
      minStockAlert: json['min_stock_alert'] != null
          ? _toDouble(json['min_stock_alert'])
          : null,
      location: json['location'] as String?,
      branchId: json['branch_id'] as int?,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
    );
  }
}

/// Fuel issue record matching backend FuelIssue schema.
class FuelIssue {
  final int id;
  final int tankId;
  final int vehicleId;
  final int? driverId;
  final int? tripId;
  final String fuelType;
  final double quantityLitres;
  final double ratePerLitre;
  final double totalAmount;
  final double? odometerReading;
  final int issuedBy;
  final DateTime issuedAt;
  final String? receiptNumber;
  final String? remarks;
  final bool isFlagged;
  final String? flagReason;
  // Joined fields
  final String? vehicleRegistration;
  final String? driverName;
  final String? tankName;
  final String? issuerName;

  FuelIssue({
    required this.id,
    required this.tankId,
    required this.vehicleId,
    this.driverId,
    this.tripId,
    required this.fuelType,
    required this.quantityLitres,
    required this.ratePerLitre,
    required this.totalAmount,
    this.odometerReading,
    required this.issuedBy,
    required this.issuedAt,
    this.receiptNumber,
    this.remarks,
    this.isFlagged = false,
    this.flagReason,
    this.vehicleRegistration,
    this.driverName,
    this.tankName,
    this.issuerName,
  });

  factory FuelIssue.fromJson(Map<String, dynamic> json) {
    return FuelIssue(
      id: json['id'] as int,
      tankId: json['tank_id'] as int,
      vehicleId: json['vehicle_id'] as int,
      driverId: json['driver_id'] as int?,
      tripId: json['trip_id'] as int?,
      fuelType: json['fuel_type']?.toString() ?? 'DIESEL',
      quantityLitres: _toDouble(json['quantity_litres']),
      ratePerLitre: _toDouble(json['rate_per_litre']),
      totalAmount: _toDouble(json['total_amount']),
      odometerReading: json['odometer_reading'] != null
          ? _toDouble(json['odometer_reading'])
          : null,
      issuedBy: json['issued_by'] as int,
      issuedAt: DateTime.parse(json['issued_at'].toString()),
      receiptNumber: json['receipt_number'] as String?,
      remarks: json['remarks'] as String?,
      isFlagged: json['is_flagged'] as bool? ?? false,
      flagReason: json['flag_reason'] as String?,
      vehicleRegistration: json['vehicle_registration'] as String?,
      driverName: json['driver_name'] as String?,
      tankName: json['tank_name'] as String?,
      issuerName: json['issuer_name'] as String?,
    );
  }
}

/// Fuel theft / anomaly alert.
class FuelTheftAlert {
  final int id;
  final int? fuelIssueId;
  final int vehicleId;
  final int? driverId;
  final String alertType;
  final String severity;
  final String description;
  final double? expectedLitres;
  final double? actualLitres;
  final double? deviationPct;
  final String status;
  final String? vehicleRegistration;
  final String? driverName;
  final DateTime? createdAt;

  FuelTheftAlert({
    required this.id,
    this.fuelIssueId,
    required this.vehicleId,
    this.driverId,
    required this.alertType,
    required this.severity,
    required this.description,
    this.expectedLitres,
    this.actualLitres,
    this.deviationPct,
    required this.status,
    this.vehicleRegistration,
    this.driverName,
    this.createdAt,
  });

  factory FuelTheftAlert.fromJson(Map<String, dynamic> json) {
    return FuelTheftAlert(
      id: json['id'] as int,
      fuelIssueId: json['fuel_issue_id'] as int?,
      vehicleId: json['vehicle_id'] as int,
      driverId: json['driver_id'] as int?,
      alertType: json['alert_type'] as String,
      severity: json['severity'] as String,
      description: json['description'] as String,
      expectedLitres: json['expected_litres'] != null
          ? _toDouble(json['expected_litres'])
          : null,
      actualLitres: json['actual_litres'] != null
          ? _toDouble(json['actual_litres'])
          : null,
      deviationPct: json['deviation_pct'] != null
          ? _toDouble(json['deviation_pct'])
          : null,
      status: json['status'] as String,
      vehicleRegistration: json['vehicle_registration'] as String?,
      driverName: json['driver_name'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }
}

/// Dashboard stats matching backend FuelDashboardStats.
class FuelDashboardStats {
  final double totalStockLitres;
  final double todayIssuedLitres;
  final int todayIssuedCount;
  final double monthIssuedLitres;
  final double monthCost;
  final int openAlerts;
  final List<FuelTank> tanks;

  FuelDashboardStats({
    required this.totalStockLitres,
    required this.todayIssuedLitres,
    required this.todayIssuedCount,
    required this.monthIssuedLitres,
    required this.monthCost,
    required this.openAlerts,
    required this.tanks,
  });

  factory FuelDashboardStats.fromJson(Map<String, dynamic> json) {
    return FuelDashboardStats(
      totalStockLitres: _toDouble(json['total_stock_litres']),
      todayIssuedLitres: _toDouble(json['today_issued_litres']),
      todayIssuedCount: json['today_issued_count'] as int? ?? 0,
      monthIssuedLitres: _toDouble(json['month_issued_litres']),
      monthCost: _toDouble(json['month_cost']),
      openAlerts: json['open_alerts'] as int? ?? 0,
      tanks: (json['tanks'] as List<dynamic>?)
              ?.map((t) => FuelTank.fromJson(t as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

double _toDouble(dynamic v) {
  if (v == null) return 0.0;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0.0;
}
