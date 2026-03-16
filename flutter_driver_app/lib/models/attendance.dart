class Attendance {
  final int? id;
  final int driverId;
  final String date;
  final String? checkIn;
  final String? checkOut;
  final String status; // present, absent, on_trip, leave
  final double? checkInLat;
  final double? checkInLng;

  const Attendance({
    this.id,
    required this.driverId,
    required this.date,
    this.checkIn,
    this.checkOut,
    this.status = 'present',
    this.checkInLat,
    this.checkInLng,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) => Attendance(
        id: json['id'] as int?,
        driverId: json['driver_id'] as int? ?? 0,
        date: json['date'] as String? ?? '',
        checkIn: json['check_in'] as String?,
        checkOut: json['check_out'] as String?,
        status: json['status'] as String? ?? 'present',
        checkInLat: (json['check_in_lat'] as num?)?.toDouble(),
        checkInLng: (json['check_in_lng'] as num?)?.toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'driver_id': driverId,
        'date': date,
        if (checkIn != null) 'check_in': checkIn,
        if (checkOut != null) 'check_out': checkOut,
        'status': status,
        if (checkInLat != null) 'check_in_lat': checkInLat,
        if (checkInLng != null) 'check_in_lng': checkInLng,
      };
}
