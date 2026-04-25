// Payment Service — API calls for UPI / NEFT / RTGS recording
// Transport ERP Flutter App

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/payment_models.dart';
import '../providers/fleet_dashboard_provider.dart'; // apiServiceProvider
import '../services/api_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Exceptions
// ─────────────────────────────────────────────────────────────────────────────

class PaymentValidationException implements Exception {
  final String message;
  const PaymentValidationException(this.message);
  @override
  String toString() => message;
}

class PaymentNetworkException implements Exception {
  const PaymentNetworkException();
  @override
  String toString() => 'Network error. Payment was NOT recorded. Please try again.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

final paymentServiceProvider = Provider<PaymentService>((ref) {
  return PaymentService(ref.read(apiServiceProvider));
});

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class PaymentService {
  final ApiService _api;
  const PaymentService(this._api);

  /// GET /clients/{clientId}/payment-info
  Future<ClientPaymentInfo> getClientPaymentInfo(int clientId) async {
    try {
      final resp = await _api.get('/clients/$clientId/payment-info');
      final data = _unwrap(resp);
      return ClientPaymentInfo.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }

  /// POST /receivables/record-payment
  Future<RecordPaymentResponse> recordPayment(
    RecordPaymentRequest request,
  ) async {
    try {
      final resp = await _api.post(
        '/receivables/record-payment',
        data: request.toJson(),
      );
      final data = _unwrap(resp);
      return RecordPaymentResponse.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }

  /// GET /receivables/{invoiceId}/payments
  Future<List<PaymentRecord>> getPaymentHistory(int invoiceId) async {
    try {
      final resp = await _api.get('/receivables/$invoiceId/payments');
      final data = _unwrap(resp);
      if (data is! List) return [];
      return data
          .cast<Map<String, dynamic>>()
          .map(PaymentRecord.fromJson)
          .toList();
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Extracts the `data` field from an APIResponse envelope.
  dynamic _unwrap(dynamic resp) {
    if (resp is Map && resp['data'] != null) return resp['data'];
    return resp;
  }

  /// Converts DioException to typed exceptions.
  Never _handleDioError(DioException e) {
    final statusCode = e.response?.statusCode;
    if (statusCode == 422 || statusCode == 400) {
      final body = e.response?.data;
      String msg = 'Validation error';
      if (body is Map) {
        final detail = body['detail'];
        if (detail is String) {
          msg = detail;
        } else if (detail is List && detail.isNotEmpty) {
          // FastAPI returns list of validation error objects
          final first = detail.first;
          if (first is Map) msg = first['msg']?.toString() ?? msg;
        }
      }
      throw PaymentValidationException(msg);
    }
    // Network / timeout / server errors
    throw const PaymentNetworkException();
  }
}
