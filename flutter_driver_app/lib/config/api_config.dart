class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:8000/api/v1';
  static const String wsUrl = 'ws://10.0.2.2:8000/ws';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 15);
}
