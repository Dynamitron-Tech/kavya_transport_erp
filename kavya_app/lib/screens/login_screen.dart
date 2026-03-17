import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/kt_colors.dart';
import '../core/theme/kt_text_styles.dart';
import '../core/widgets/kt_button.dart';

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
  const LoginScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loginState = ref.watch(loginStateProvider);
    final notifier = ref.read(loginStateProvider.notifier);

    return Scaffold(
      backgroundColor: KTColors.navy900,
      body: Stack(
        children: [
          // ============= BACKGROUND WITH PATTERN =============
          Container(
            color: KTColors.navy900,
            child: CustomPaint(
              painter: LoginBackgroundPainter(),
              size: Size.infinite,
            ),
          ),

          // ============= WATERMARK TRUCK =============
          Positioned(
            bottom: -50,
            right: -80,
            child: Opacity(
              opacity: 0.12,
              child: Transform.scale(
                scale: 3,
                child: Icon(
                  Icons.local_shipping_outlined,
                  size: 200,
                  color: KTColors.navy800,
                ),
              ),
            ),
          ),

          // ============= LOGIN CARD =============
          Center(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: MediaQuery.of(context).size.width < 600 ? 16 : 32,
                  vertical: 24,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Card(
                    elevation: 24,
                    shadowColor: Colors.black.withOpacity(0.6),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(
                        color: KTColors.navy800,
                        width: 1,
                      ),
                    ),
                    color: KTColors.navy800,
                    child: Padding(
                      padding: const EdgeInsets.all(48),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // ============= LOGO =============
                          Hero(
                            tag: 'kavya-logo',
                            child: Container(
                              width: 96,
                              height: 96,
                              decoration: BoxDecoration(
                                color: KTColors.amber500.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.local_shipping,
                                  size: 56,
                                  color: KTColors.amber500,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // ============= COMPANY NAME =============
                          Text(
                            'Kavya Transports',
                            style: KTTextStyles.displayMedium.copyWith(
                              color: KTColors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 8),

                          // ============= SUBTITLE =============
                          Text(
                            'Employee Portal',
                            style: KTTextStyles.labelSmall.copyWith(
                              color: KTColors.gray400,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(height: 28),

                          // ============= DIVIDER =============
                          Container(
                            height: 1,
                            color: KTColors.navy700,
                            margin: const EdgeInsets.symmetric(vertical: 24),
                          ),

                          // ============= EMPLOYEE ID FIELD =============
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Employee ID',
                              style: KTTextStyles.label.copyWith(
                                color: KTColors.white,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),

                          TextField(
                            onChanged: (value) => notifier.setEmployeeId(value),
                            enabled: !loginState.isLoading,
                            style: KTTextStyles.mono.copyWith(
                              color: KTColors.white,
                              fontSize: 14,
                            ),
                            decoration: InputDecoration(
                              hintText: 'Enter your employee ID',
                              prefixIcon: Icon(
                                Icons.person_outline,
                                color: KTColors.gray400,
                                size: 20,
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // ============= PASSWORD FIELD =============
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Password',
                              style: KTTextStyles.label.copyWith(
                                color: KTColors.white,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),

                          TextField(
                            onChanged: (value) => notifier.setPassword(value),
                            enabled: !loginState.isLoading,
                            obscureText: !loginState.showPassword,
                            style: KTTextStyles.body.copyWith(
                              color: KTColors.white,
                            ),
                            decoration: InputDecoration(
                              hintText: 'Enter your password',
                              prefixIcon: Icon(
                                Icons.lock_outline,
                                color: KTColors.gray400,
                                size: 20,
                              ),
                              suffixIcon: GestureDetector(
                                onTap: loginState.isLoading
                                    ? null
                                    : () => notifier.toggleShowPassword(),
                                child: Icon(
                                  loginState.showPassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  color: KTColors.gray400,
                                  size: 20,
                                ),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // ============= ERROR MESSAGE =============
                          if (loginState.error != null)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                color: KTColors.dangerBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: KTColors.danger.withOpacity(0.5),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.warning_outlined,
                                    color: KTColors.danger,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      loginState.error!,
                                      style: KTTextStyles.bodySmall.copyWith(
                                        color: KTColors.danger,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          // ============= SIGN IN BUTTON =============
                          KTButton.primary(
                            onPressed: loginState.isLoading
                                ? null
                                : () => notifier.login(),
                            isLoading: loginState.isLoading,
                            label: 'Sign In',
                          ),

                          // ============= FOOTER =============
                          const SizedBox(height: 40),
                          Text(
                            'Kavya Transports © 2025 · All rights reserved',
                            style: KTTextStyles.caption.copyWith(
                              color: KTColors.gray400,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Paints the login background pattern (diagonal hatching)
class LoginBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Diagonal hatching pattern
    const spacing = 40.0;
    const angle = -0.2; // Diagonal angle

    for (double i = -size.height; i < size.width + size.height; i += spacing) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i + size.height, size.height),
        Paint()
          ..color = Colors.white.withOpacity(0.02)
          ..strokeWidth = 0.5,
      );
    }

    // Bottom gradient bar
    const barHeight = 3.0;
    final barRectangle = Rect.fromLTWH(
      0,
      size.height - barHeight,
      size.width,
      barHeight,
    );

    canvas.drawRect(
      barRectangle,
      Paint()
        ..shader = LinearGradient(
          colors: [
            KTColors.amber600,
            KTColors.amber500,
          ],
        ).createShader(barRectangle),
    );
  }

  @override
  bool shouldRepaint(LoginBackgroundPainter oldDelegate) => false;
}
