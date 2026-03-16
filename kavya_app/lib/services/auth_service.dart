import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/router/app_router.dart';
import 'api_service.dart';

final authServiceProvider = Provider((ref) => AuthService(ref));

class AuthService {
  final Ref _ref;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ApiService _apiService = ApiService();

  AuthService(this._ref);

  Future<void> login(String email, String password) async {
    // 1. Call API
    final response = await _apiService.login(email, password);
    
    // 2. Extract user and tokens [cite: 35]
    final token = response['access_token'];
    final refreshToken = response['refresh_token'];
    final user = response['user'];
    final primaryRole = user['roles'][0]; // Key requirement: roles is an array [cite: 5-6, 35]

    // 3. Save to storage [cite: 35]
    await _storage.write(key: 'access_token', value: token);
    await _storage.write(key: 'refresh_token', value: refreshToken);
    await _storage.write(key: 'primary_role', value: primaryRole);
    await _storage.write(key: 'user_name', value: user['name']);
    await _storage.write(key: 'user_id', value: user['id'].toString());

    // 4. Navigate based on primary role [cite: 35-40]
    _navigateForRole(primaryRole);
  }

  void _navigateForRole(String role) {
    final router = _ref.read(routerProvider);
    switch (role) {
      case 'driver':
        router.go('/home/today'); // [cite: 36]
        break;
      case 'fleet_manager':
        router.go('/fleet/home'); // [cite: 37]
        break;
      case 'accountant':
        router.go('/accountant/home'); // [cite: 38]
        break;
      case 'project_associate':
        router.go('/associate/home'); // [cite: 39]
        break;
      default:
        // admin, manager, auditor → web-only screen [cite: 40]
        router.go('/web-only');
    }
  }

  Future<void> logout() async { // [cite: 41]
    try {
      // Optional: Call POST /auth/logout if implemented on backend
      // await _apiService.logout(); 
    } catch (_) {} 
    
    await _storage.deleteAll();
    _ref.read(routerProvider).go('/login');
  }
}