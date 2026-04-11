import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/router/app_router.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import 'api_service.dart';

final authServiceProvider = Provider((ref) => AuthService(ref));

class AuthService {
  final Ref _ref;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ApiService _apiService = ApiService();

  AuthService(this._ref);

  Future<void> login(String email, String password) async {
    final response = await _apiService.login(email, password);
    final data = response['data'] as Map<String, dynamic>? ?? response;
    await _saveTokensAndNavigate(data);
  }

  /// Phone OTP login for market (hired) drivers.
  /// [sessionId], [accessToken], [otpCode] come from the OTP flow.
  Future<void> loginMarketDriver({
    required String sessionId,
    required String accessToken,
    required String otpCode,
  }) async {
    final response = await _apiService.post('/auth/market-driver/verify-otp', data: {
      'session_id': sessionId,
      'access_token': accessToken,
      'otp_code': otpCode,
    });
    final data = response['data'] as Map<String, dynamic>? ?? response;
    await _saveTokensAndNavigate(data);
  }

  Future<void> _saveTokensAndNavigate(Map<String, dynamic> data) async {
    final token = data['access_token'] as String?;
    final refreshToken = data['refresh_token'] as String?;
    final user = data['user'] as Map<String, dynamic>?;

    if (token == null || user == null) {
      throw Exception('Invalid login response');
    }

    final roles = user['roles'] as List<dynamic>? ?? [];
    final primaryRole = roles.isNotEmpty ? roles[0].toString() : 'unknown';
    // For market drivers name comes from backend user.name field directly
    final phoneRaw = user['phone']?.toString() ?? '';
    final userName = primaryRole == 'market_driver'
        ? (user['name']?.toString() ?? 'Driver')
        : '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final resolvedName = userName.isNotEmpty ? userName : user['email']?.toString() ?? 'User';

    await _storage.write(key: 'access_token', value: token);
    if (refreshToken != null) {
      await _storage.write(key: 'refresh_token', value: refreshToken);
    }
    await _storage.write(key: 'primary_role', value: primaryRole);
    await _storage.write(key: 'user_name', value: resolvedName);
    await _storage.write(key: 'user_id', value: user['id'].toString());
    await _storage.write(key: 'user_email', value: user['email']?.toString() ?? '');
    await _storage.write(key: 'user_phone', value: user['phone']?.toString() ?? phoneRaw);
    await _storage.write(key: 'user_is_active', value: (user['is_active'] as bool? ?? true).toString());

    _ref.read(authProvider.notifier).setUser(User(
      id: user['id'].toString(),
      name: resolvedName,
      email: user['email']?.toString() ?? '',
      roles: roles.map((r) => r.toString()).toList(),
      phone: user['phone']?.toString(),
      isActive: user['is_active'] as bool? ?? true,
    ));

    _navigateForRole(primaryRole);
  }

  void _navigateForRole(String role) {
    final router = _ref.read(routerProvider);
    switch (role) {
      case 'driver':
        router.go('/driver/today');
        break;
      case 'fleet_manager':
        router.go('/fleet/home');
        break;
      case 'accountant':
        router.go('/accountant/home');
        break;
      case 'project_associate':
        router.go('/pa/dashboard');
        break;
      case 'admin':
      case 'super_admin':
        router.go('/admin/dashboard');
        break;
      case 'pump_operator':
        router.go('/pump/home');
        break;
      case 'branch_manager':
        router.go('/branch/home');
        break;
      case 'manager':
        router.go('/manager/dashboard');
        break;
      case 'market_driver':
        router.go('/market-driver/trips');
        break;
      default:
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