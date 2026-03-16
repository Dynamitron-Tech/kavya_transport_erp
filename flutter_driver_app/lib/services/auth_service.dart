import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<User> login(String email, String password) async {
    final response = await _api.post<Map<String, dynamic>>('/auth/login', data: {
      'email': email,
      'password': password,
    });

    final data = response['data'] as Map<String, dynamic>? ?? response;

    await _storage.write(key: 'access_token', value: data['access_token']);
    if (data['refresh_token'] != null) {
      await _storage.write(key: 'refresh_token', value: data['refresh_token']);
    }

    return User.fromJson(data['user'] ?? data);
  }

  Future<User?> getCurrentUser() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return null;

    final response = await _api.get<Map<String, dynamic>>('/auth/me');
    final userData = response['data'] as Map<String, dynamic>? ?? response;
    return User.fromJson(userData);
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout', data: {});
    } catch (_) {
      // Logout locally even if API fails
    }
    await _storage.deleteAll();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

  Future<void> updateFcmToken(String fcmToken) async {
    await _api.post('/auth/fcm-token', data: {'fcm_token': fcmToken});
  }
}
