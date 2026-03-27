import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState({this.user, this.isLoading = false, this.error});

  AuthState copyWith({User? user, bool? isLoading, String? error}) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  static const _storage = FlutterSecureStorage();

  AuthNotifier(this._authService) : super(AuthState()) {
    // Load persisted user on every app start (handles app-restart case)
    Future.microtask(_loadUserFromStorage);
  }

  Future<void> _loadUserFromStorage() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return; // Not logged in
    if (state.user != null) return; // Already set (e.g. fresh login)

    final id = await _storage.read(key: 'user_id') ?? '';
    final name = await _storage.read(key: 'user_name') ?? '';
    final email = await _storage.read(key: 'user_email') ?? '';
    final phone = await _storage.read(key: 'user_phone');
    final role = await _storage.read(key: 'primary_role') ?? 'unknown';
    final isActive = (await _storage.read(key: 'user_is_active')) != 'false';

    if (!mounted) return;
    state = state.copyWith(
      user: User(
        id: id,
        name: name.isNotEmpty ? name : email,
        email: email,
        roles: [role],
        phone: phone?.isNotEmpty == true ? phone : null,
        isActive: isActive,
      ),
    );
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _authService.login(email, password);
      state = state.copyWith(isLoading: false);
      return true;
    } on DioException catch (e) {
      String message = 'Login failed. Please try again.';
      final responseData = e.response?.data;
      if (responseData is Map<String, dynamic>) {
        message = responseData['detail']?.toString() ??
            responseData['message']?.toString() ??
            message;
      } else if (e.response?.statusCode == 401) {
        message = 'Invalid E-mail or Password';
      }
      state = state.copyWith(isLoading: false, error: message);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Login failed. Please try again.');
      return false;
    }
  }

  Future<void> logout() async {
    state = AuthState();
    await _authService.logout();
  }

  void setUser(User user) {
    state = state.copyWith(user: user);
  }
}