import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthState {
  final User? user; //
  final bool isLoading; //
  final String? error; //

  AuthState({this.user, this.isLoading = false, this.error});

  AuthState copyWith({User? user, bool? isLoading, String? error}) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error, // Allow nulling out error
    );
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) { //
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _authService.login(email, password);
      // user data is handled by storage in auth_service, but we clear loading state here
      state = state.copyWith(isLoading: false);
      return true; // Success
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString()); //
      return false; // Failed
    }
  }
}