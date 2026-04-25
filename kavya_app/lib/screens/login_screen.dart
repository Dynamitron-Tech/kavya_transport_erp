import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/kt_colors.dart';
import '../core/theme/kt_text_styles.dart';

/// Login state provider
final loginStateProvider = StateNotifierProvider<LoginStateNotifier, LoginState>(
  (ref) => LoginStateNotifier(),
);

class LoginState {
  final String employeeId;
  final String password;
  final bool isLoading;
  final String? error;
  final bool showPassword;

  LoginState({
    this.employeeId = '',
    this.password = '',
    this.isLoading = false,
    this.error,
    this.showPassword = false,
  });

  LoginState copyWith({
    String? employeeId,
    String? password,
    bool? isLoading,
    String? error,
    bool? showPassword,
  }) {
    return LoginState(
      employeeId: employeeId ?? this.employeeId,
      password: password ?? this.password,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      showPassword: showPassword ?? this.showPassword,
    );
  }
}

class LoginStateNotifier extends StateNotifier<LoginState> {
  LoginStateNotifier() : super(LoginState());

  void setEmployeeId(String id) {
    state = state.copyWith(employeeId: id, error: null);
  }

  void setPassword(String pwd) {
    state = state.copyWith(password: pwd, error: null);
  }

  void toggleShowPassword() {
    state = state.copyWith(showPassword: !state.showPassword);
  }

  Future<void> login() async {
    // Validate input
    if (state.employeeId.isEmpty) {
      state = state.copyWith(error: 'Please enter your employee ID');
      return;
    }
    if (state.password.isEmpty) {
      state = state.copyWith(error: 'Please enter your password');
      return;
    }

    state = state.copyWith(isLoading: true, error: null);

    try {
      // TODO: Call actual login API
      await Future.delayed(const Duration(seconds: 2)); // Simulate API call

      // For now, just simulate success
      // In real app, this would navigate to home screen
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Invalid credentials. Please try again.',
      );
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loginState = ref.watch(loginStateProvider);
    final notifier = ref.read(loginStateProvider.notifier);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: MediaQuery.of(context).size.width < 600 ? 24 : 48,
              vertical: 32,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ── Logo ──
                  Hero(
                    tag: 'kavya-logo',
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: KTColors.primary,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: KTColors.primary.withValues(alpha: 0.30),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.local_shipping_rounded,
                        size: 40,
                        color: KTColors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Company name ──
                  Text(
                    'Kavya Transports',
                    style: KTTextStyles.displayMedium.copyWith(
                      color: KTColors.textHeading,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Employee Portal',
                    style: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                  ),
                  const SizedBox(height: 36),

                  // ── Card ──
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: KTColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: KTColors.borderColor),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 16,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Employee ID
                        Text('Employee ID',
                            style: KTTextStyles.label.copyWith(color: KTColors.textHeading)),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: notifier.setEmployeeId,
                          enabled: !loginState.isLoading,
                          style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                          decoration: InputDecoration(
                            hintText: 'Enter your employee ID',
                            hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                            prefixIcon: const Icon(Icons.person_outline,
                                color: KTColors.textMuted, size: 20),
                            fillColor: KTColors.lightBg,
                            filled: true,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.borderColor),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.borderColor),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.primary, width: 1.5),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 14),
                          ),
                        ),
                        const SizedBox(height: 18),

                        // Password
                        Text('Password',
                            style: KTTextStyles.label.copyWith(color: KTColors.textHeading)),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: notifier.setPassword,
                          enabled: !loginState.isLoading,
                          obscureText: !loginState.showPassword,
                          style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                          decoration: InputDecoration(
                            hintText: 'Enter your password',
                            hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                            prefixIcon: const Icon(Icons.lock_outline,
                                color: KTColors.textMuted, size: 20),
                            suffixIcon: GestureDetector(
                              onTap: loginState.isLoading
                                  ? null
                                  : notifier.toggleShowPassword,
                              child: Icon(
                                loginState.showPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: KTColors.textMuted,
                                size: 20,
                              ),
                            ),
                            fillColor: KTColors.lightBg,
                            filled: true,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.borderColor),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.borderColor),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: KTColors.primary, width: 1.5),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 14),
                          ),
                        ),
                        const SizedBox(height: 22),

                        // Error
                        if (loginState.error != null)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            margin: const EdgeInsets.only(bottom: 14),
                            decoration: BoxDecoration(
                              color: KTColors.dangerBg,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: KTColors.danger.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.warning_rounded,
                                    color: KTColors.danger, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    loginState.error!,
                                    style: KTTextStyles.caption
                                        .copyWith(color: KTColors.danger),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        // Sign In button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: loginState.isLoading ? null : notifier.login,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: KTColors.primary,
                              foregroundColor: KTColors.white,
                              disabledBackgroundColor:
                                  KTColors.primary.withValues(alpha: 0.5),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            child: loginState.isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      color: KTColors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(
                                    'Sign In',
                                    style: KTTextStyles.label.copyWith(
                                      color: KTColors.white,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Footer
                  Text(
                    'Kavya Transports © 2025 · All rights reserved',
                    style: KTTextStyles.caption.copyWith(color: KTColors.textMuted),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
