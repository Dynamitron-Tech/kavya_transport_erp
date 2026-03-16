import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<User> login(String username, String password) async {
    final data = await _api.post<Map<String, dynamic>>('/auth/login', data: {
      'username': username,
      'password': password,
    });

    await _storage.write(key: 'access_token', value: data['access_token']);
    if (data['refresh_token'] != null) {
      await _storage.write(key: 'refresh_token', value: data['refresh_token']);
    }

    return User.fromJson(data['user'] ?? data);
  }

  Future<User?> getCurrentUser() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return null;

    return _api.get<User>('/auth/me', fromJson: (d) => User.fromJson(d));
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
