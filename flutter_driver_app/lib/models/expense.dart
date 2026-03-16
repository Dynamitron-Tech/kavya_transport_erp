class Expense {
  final int? id;
  final int? tripId;
  final String category;
  final double amount;
  final String? description;
  final String? receiptUrl;
  final String? date;
  final String? status;

  const Expense({
    this.id,
    this.tripId,
    required this.category,
    required this.amount,
    this.description,
    this.receiptUrl,
    this.date,
    this.status,
  });

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
        id: json['id'] as int?,
        tripId: json['trip_id'] as int?,
        category: json['category'] as String? ?? 'other',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        description: json['description'] as String?,
        receiptUrl: json['receipt_url'] as String?,
        date: json['date'] as String?,
        status: json['status'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        if (tripId != null) 'trip_id': tripId,
        'category': category,
        'amount': amount,
        if (description != null) 'description': description,
        if (receiptUrl != null) 'receipt_url': receiptUrl,
        if (date != null) 'date': date,
      };
}
