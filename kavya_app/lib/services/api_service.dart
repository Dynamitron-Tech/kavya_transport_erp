import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  // Base URL from environment [cite: 31]
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiService() : _dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        // Request interceptor: adds Authorization header [cite: 32]
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        // Response interceptor: on 401 -> calls refresh token endpoint [cite: 32]
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            final refreshToken = await _storage.read(key: 'refresh_token');
            if (refreshToken != null) {
              try {
                // Retry refresh [cite: 32]
                final refreshResponse = await Dio().post(
                  '$baseUrl/auth/refresh',
                  data: {'refresh_token': refreshToken},
                );
                final newAccessToken = refreshResponse.data['access_token'];
                await _storage.write(key: 'access_token', value: newAccessToken);
                
                // Retry original request [cite: 32]
                e.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                final retryResponse = await Dio().fetch(e.requestOptions);
                return handler.resolve(retryResponse);
              } catch (refreshError) {
                // If refresh fails -> clear storage [cite: 32]
                await _storage.deleteAll();
                // Redirection to login handled by router guard
              }
            } else {
              await _storage.deleteAll();
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  // --- Auth & Profile ---
  Future<Map<String, dynamic>> login(String email, String password) async { // [cite: 32-33]
    final response = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    return response.data;
  }

  Future<Map<String, dynamic>> getMe() async { // [cite: 33]
    final response = await _dio.get('/auth/me');
    return response.data;
  }

  Future<Map<String, dynamic>> refreshToken(String token) async { // [cite: 33]
    final response = await _dio.post('/auth/refresh', data: {'refresh_token': token});
    return response.data;
  }

  // --- Dashboards ---
  Future<Map<String, dynamic>> getDashboardFleet() async { // [cite: 33]
    final response = await _dio.get('/dashboard/fleet-manager');
    return response.data;
  }

  Future<Map<String, dynamic>> getDashboardAccountant() async { // [cite: 33]
    final response = await _dio.get('/dashboard/accountant');
    return response.data;
  }

  Future<Map<String, dynamic>> getDashboardAssociate() async { // [cite: 33]
    final response = await _dio.get('/dashboard/associate');
    return response.data;
  }

  // --- Jobs & Documents ---
  Future<List<dynamic>> getJobs({String? status, bool? noLr}) async { // [cite: 33]
    final response = await _dio.get('/jobs', queryParameters: {
      if (status != null) 'status': status,
      if (noLr != null) 'noLr': noLr,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> createLR(Map<String, dynamic> data) async { // [cite: 33]
    final response = await _dio.post('/lr', data: data);
    return response.data;
  }

  Future<List<dynamic>> getLRs({bool? noEwb}) async { // [cite: 33]
    final response = await _dio.get('/lr', queryParameters: {
      if (noEwb != null) 'noEwb': noEwb,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> generateEWB(Map<String, dynamic> data) async { // [cite: 33]
    final response = await _dio.post('/eway-bills/generate', data: data);
    return response.data;
  }

  Future<Map<String, dynamic>> extendEWB(String ewbId) async { // [cite: 33]
    final response = await _dio.patch('/eway-bills/$ewbId/extend');
    return response.data;
  }

  Future<Map<String, dynamic>> uploadDocument(File file, String type, String linkedId) async { // [cite: 34]
    String fileName = file.path.split('/').last;
    FormData formData = FormData.fromMap({
      "file": await MultipartFile.fromFile(file.path, filename: fileName),
      "type": type,
      "linked_id": linkedId,
    });
    final response = await _dio.post('/documents/upload', data: formData);
    return response.data;
  }

  // --- Expenses & Finance ---
  Future<List<dynamic>> getExpensesPending() async { // [cite: 33]
    final response = await _dio.get('/trips', queryParameters: {'status': 'in_progress'});
    return response.data;
  }

  Future<void> approveExpense(String id) async { // [cite: 33]
    await _dio.patch('/expenses/$id/status', data: {'status': 'approved'});
  }

  Future<void> rejectExpense(String id, String reason) async { // [cite: 33]
    await _dio.patch('/expenses/$id/status', data: {'status': 'rejected', 'reason': reason});
  }

  Future<List<dynamic>> getInvoices() async { // [cite: 34]
    final response = await _dio.get('/finance/invoices');
    return response.data;
  }

  Future<Map<String, dynamic>> getInvoiceDetail(String id) async { // [cite: 34]
    final response = await _dio.get('/finance/invoices/$id');
    return response.data;
  }

  Future<void> recordPayment(String invoiceId, Map<String, dynamic> data) async { // [cite: 34]
    await _dio.post('/finance/payments', data: data);
  }

  Future<List<dynamic>> getReceivables() async { // [cite: 34]
    final response = await _dio.get('/finance/receivables');
    return response.data;
  }

  // --- Vehicles & Trips ---
  Future<List<dynamic>> getVehicles() async { // [cite: 33]
    final response = await _dio.get('/vehicles');
    return response.data;
  }

  Future<Map<String, dynamic>> getVehicleDetail(String id) async { // [cite: 33]
    final response = await _dio.get('/vehicles/$id');
    return response.data;
  }

  Future<void> logService(Map<String, dynamic> data) async { // [cite: 33]
    await _dio.post('/services', data: data);
  }

  Future<void> recordTyreEvent(Map<String, dynamic> data) async { // [cite: 33]
    final tyreId = data['tyre_id'];
    await _dio.post('/tyres/$tyreId/events', data: data);
  }

  Future<List<dynamic>> getTrips({String? status}) async { // [cite: 34]
    final response = await _dio.get('/trips', queryParameters: {
      if (status != null) 'status': status,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> getTripDetail(String id) async { // [cite: 34]
    final response = await _dio.get('/trips/$id');
    return response.data;
  }

  Future<void> closeTrip(String id) async { // [cite: 34]
    await _dio.patch('/trips/$id/status', data: {'status': 'completed'});
  }
}