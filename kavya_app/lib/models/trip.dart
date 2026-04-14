class Trip {
  final int id;
  final String tripNumber;
  final String status;
  final String? origin;
  final String? destination;
  final String? vehicleNumber;
  final int? driverId;
  final String? startDate;
  final String? endDate;
  final double? distanceKm;
  final double? freightAmount;
  final String? clientName;
  final String? lrNumber;
  final String? remarks;
  final double? startOdometer;   // departure odometer set by driver at departure
  final double? vehicleOdometer; // vehicle's current odometer reading (from DB)
  // Phase photos
  final String? loadedImageUrl;
  final String? reachedImageUrl;
  final String? unloadedImageUrl;
  final String? podImageUrl;
  // Driver advance payment
  final bool advancePaid;
  final String? advancePaidAt;
  final String? advancePaidByName;

  const Trip({
    required this.id,
    required this.tripNumber,
    required this.status,
    this.origin,
    this.destination,
    this.vehicleNumber,
    this.driverId,
    this.startDate,
    this.endDate,
    this.distanceKm,
    this.freightAmount,
    this.clientName,
    this.lrNumber,
    this.remarks,
    this.startOdometer,
    this.vehicleOdometer,
    this.loadedImageUrl,
    this.reachedImageUrl,
    this.unloadedImageUrl,
    this.podImageUrl,
    this.advancePaid = false,
    this.advancePaidAt,
    this.advancePaidByName,
  });

  factory Trip.fromJson(Map<String, dynamic> json) => Trip(
        id: json['id'] as int,
        tripNumber: json['trip_number'] as String? ?? '',
        status: (json['status'] as String? ?? 'pending').toLowerCase(),
        origin: json['origin'] as String?,
        destination: json['destination'] as String?,
        vehicleNumber: json['vehicle_number'] as String? ?? json['vehicle_registration'] as String?,
        driverId: json['driver_id'] as int?,
        startDate: (json['trip_date'] ?? json['start_date'] ?? json['planned_start']) as String?,
        endDate: json['end_date'] as String?,
        distanceKm: _toDouble(json['distance_km']),
        freightAmount: _toDouble(json['freight_amount']),
        clientName: json['client_name'] as String?,
        lrNumber: json['lr_number'] as String?,
        remarks: json['remarks'] as String?,
        startOdometer: _toDouble(json['start_odometer']),
        vehicleOdometer: _toDouble(json['vehicle_odometer']),
        loadedImageUrl: json['loaded_image_url'] as String?,
        reachedImageUrl: json['reached_image_url'] as String?,
        unloadedImageUrl: json['unloaded_image_url'] as String?,
        podImageUrl: json['pod_image_url'] as String?,
        advancePaid: json['advance_paid'] as bool? ?? false,
        advancePaidAt: json['advance_paid_at'] as String?,
        advancePaidByName: json['advance_paid_by_name'] as String?,
      );

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'trip_number': tripNumber,
        'status': status,
        'origin': origin,
        'destination': destination,
        'vehicle_number': vehicleNumber,
        'driver_id': driverId,
        'start_date': startDate,
        'end_date': endDate,
        'distance_km': distanceKm,
        'freight_amount': freightAmount,
        'client_name': clientName,
        'lr_number': lrNumber,
        'remarks': remarks,
      };

  bool get isActive =>
      status == 'in_transit' || status == 'started' || status == 'loading' || status == 'ready' || status == 'unloading';

  bool get isPendingAcceptance => status == 'driver_assigned';

  bool get isAssigned => status == 'planned' || status == 'vehicle_assigned' || status == 'driver_assigned' || status == 'ready';

  bool get awaitingLoad => status == 'started';

  bool get awaitingReach => status == 'loading' || status == 'in_transit';

  /// True when the truck is at destination and needs to be marked as unloaded.
  bool get awaitingUnload => status == 'unloading' && unloadedImageUrl == null;

  /// True when the truck is unloaded but POD has not yet been uploaded.
  bool get awaitingPOD => status == 'unloading' && unloadedImageUrl != null;
}
