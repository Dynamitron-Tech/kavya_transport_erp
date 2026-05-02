class Attendance {
  final int? id;
  final int userId;
  final String date;
  final String? checkInTime;
  final String status; // present, late, absent
  final String? checkInPhotoUrl;
  final String? remarks;

  const Attendance({
    this.id,
    required this.userId,
    required this.date,
    this.checkInTime,
    this.status = 'present',
    this.checkInPhotoUrl,
    this.remarks,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) => Attendance(
        id: json['id'] as int?,
        userId: json['user_id'] as int? ?? 0,
        date: json['date'] as String? ?? '',
        checkInTime: json['check_in_time'] as String?,
        status: json['status'] as String? ?? 'present',
        checkInPhotoUrl: json['check_in_photo_url'] as String?,
        remarks: json['remarks'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'user_id': userId,
        'date': date,
        if (checkInTime != null) 'check_in_time': checkInTime,
        'status': status,
        if (checkInPhotoUrl != null) 'check_in_photo_url': checkInPhotoUrl,
        if (remarks != null) 'remarks': remarks,
      };
}
