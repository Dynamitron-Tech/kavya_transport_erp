// Payment Models — UPI / NEFT / RTGS / Cheque / Cash recording
// Transport ERP Flutter App

class ClientPaymentInfo {
  final bool upiAvailable;
  final String? upiId;
  final String? phone;
  final String name;

  const ClientPaymentInfo({
    required this.upiAvailable,
    this.upiId,
    this.phone,
    required this.name,
  });

  factory ClientPaymentInfo.fromJson(Map<String, dynamic> json) {
    return ClientPaymentInfo(
      upiAvailable: json['upi_available'] as bool? ?? false,
      upiId: json['upi_id'] as String?,
      phone: json['phone'] as String?,
      name: json['name'] as String? ?? '',
    );
  }
}

class RecordPaymentRequest {
  final int invoiceId;
  final double amountPaid;
  final String paymentMode; // UPI | NEFT | RTGS | CHEQUE | CASH
  final String? referenceNumber;
  final String? upiTxnId;
  final DateTime paymentDate;
  final String? notes;

  const RecordPaymentRequest({
    required this.invoiceId,
    required this.amountPaid,
    required this.paymentMode,
    this.referenceNumber,
    this.upiTxnId,
    required this.paymentDate,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
        'invoice_id': invoiceId,
        'amount_paid': amountPaid,
        'payment_mode': paymentMode,
        if (referenceNumber != null && referenceNumber!.isNotEmpty)
          'reference_number': referenceNumber,
        if (upiTxnId != null && upiTxnId!.isNotEmpty) 'upi_txn_id': upiTxnId,
        'payment_date':
            '${paymentDate.year.toString().padLeft(4, '0')}-'
            '${paymentDate.month.toString().padLeft(2, '0')}-'
            '${paymentDate.day.toString().padLeft(2, '0')}',
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

class RecordPaymentResponse {
  final bool success;
  final int paymentId;
  final int invoiceId;
  final String newStatus;   // UNPAID | PARTIAL | PAID
  final double outstandingBalance;

  const RecordPaymentResponse({
    required this.success,
    required this.paymentId,
    required this.invoiceId,
    required this.newStatus,
    required this.outstandingBalance,
  });

  factory RecordPaymentResponse.fromJson(Map<String, dynamic> json) {
    return RecordPaymentResponse(
      success: json['success'] as bool? ?? true,
      paymentId: json['payment_id'] as int,
      invoiceId: json['invoice_id'] as int,
      newStatus: json['new_status'] as String? ?? 'UNKNOWN',
      outstandingBalance:
          (json['outstanding_balance'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class PaymentRecord {
  final int paymentId;
  final double amountPaid;
  final String paymentMode;
  final String? referenceNumber;
  final String paymentDate;
  final String? recordedByName;

  const PaymentRecord({
    required this.paymentId,
    required this.amountPaid,
    required this.paymentMode,
    this.referenceNumber,
    required this.paymentDate,
    this.recordedByName,
  });

  factory PaymentRecord.fromJson(Map<String, dynamic> json) {
    return PaymentRecord(
      paymentId: json['payment_id'] as int,
      amountPaid: (json['amount_paid'] as num?)?.toDouble() ?? 0.0,
      paymentMode: json['payment_mode'] as String? ?? '',
      referenceNumber: json['reference_number'] as String?,
      paymentDate: json['payment_date'] as String? ?? '',
      recordedByName: json['recorded_by_name'] as String?,
    );
  }
}
