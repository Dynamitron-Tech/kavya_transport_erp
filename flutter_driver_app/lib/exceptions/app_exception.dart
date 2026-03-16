class AppException implements Exception {
  final String message;
  final String? detail;
  final int? statusCode;

  const AppException(this.message, {this.detail, this.statusCode});

  @override
  String toString() => message;

  String get userMessage {
    if (statusCode == 401) return 'Session expired. Please login again.';
    if (statusCode == 403) return 'You don\'t have permission for this action.';
    if (statusCode == 404) return 'Requested data not found.';
    if (statusCode == 503) return detail ?? 'Service temporarily unavailable.';
    if (statusCode != null && statusCode! >= 500) return 'Server error. Please try again later.';
    return detail ?? message;
  }
}

class NetworkException extends AppException {
  const NetworkException([String message = 'No internet connection. Please check your network.'])
      : super(message);
}

class TimeoutException extends AppException {
  const TimeoutException([String message = 'Request timed out. Please try again.'])
      : super(message);
}

class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Session expired. Please login again.'])
      : super(message, statusCode: 401);
}
