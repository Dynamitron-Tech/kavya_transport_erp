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
  });

  factory Trip.fromJson(Map<String, dynamic> json) => Trip(
        id: json['id'] as int,
        tripNumber: json['trip_number'] as String? ?? '',
        status: (json['status'] as String? ?? 'pending').toLowerCase(),
        origin: json['origin'] as String?,
        destination: json['destination'] as String?,
        vehicleNumber: json['vehicle_number'] as String?,
        driverId: json['driver_id'] as int?,
        startDate: (json['trip_date'] ?? json['start_date'] ?? json['planned_start']) as String?,
        endDate: json['end_date'] as String?,
        distanceKm: (json['distance_km'] as num?)?.toDouble(),
        freightAmount: (json['freight_amount'] as num?)?.toDouble(),
        clientName: json['client_name'] as String?,
        lrNumber: json['lr_number'] as String?,
        remarks: json['remarks'] as String?,
      );

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
      status == 'in_transit' || status == 'started' || status == 'loading' || status == 'ready';

  bool get isPendingAcceptance => status == 'driver_assigned';
}
