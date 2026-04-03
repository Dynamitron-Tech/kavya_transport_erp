class DriverLeave {
  final int id;
  final String startDate;
  final String endDate;
  final String? reason;
  final String status; // PENDING | APPROVED | REJECTED | CANCELLED
  final String? reviewNote;
  final String? createdAt;

  const DriverLeave({
    required this.id,
    required this.startDate,
    required this.endDate,
    this.reason,
    required this.status,
    this.reviewNote,
    this.createdAt,
  });

  factory DriverLeave.fromJson(Map<String, dynamic> json) => DriverLeave(
        id: json['id'] as int,
        startDate: json['start_date'] as String,
        endDate: json['end_date'] as String,
        reason: json['reason'] as String?,
        status: json['status'] as String? ?? 'PENDING',
        reviewNote: json['review_note'] as String?,
        createdAt: json['created_at'] as String?,
      );
}

class DriverAdvanceRequest {
  final int id;
  final int? tripId;
  final double amount;
  final String status; // PENDING | APPROVED | REJECTED
  final String? reviewNote;
  final String? createdAt;

  const DriverAdvanceRequest({
    required this.id,
    this.tripId,
    required this.amount,
    required this.status,
    this.reviewNote,
    this.createdAt,
  });

  factory DriverAdvanceRequest.fromJson(Map<String, dynamic> json) =>
      DriverAdvanceRequest(
        id: json['id'] as int,
        tripId: json['trip_id'] as int?,
        amount: (json['amount'] as num?)?.toDouble() ?? 1500.0,
        status: json['status'] as String? ?? 'PENDING',
        reviewNote: json['review_note'] as String?,
        createdAt: json['created_at'] as String?,
      );
}
