import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) { // Validate before submit [cite: 116]
      final success = await ref.read(authProvider.notifier).login(
            _emailController.text.trim(),
            _passwordController.text,
          ); // POST /api/v1/auth/login [cite: 53]

      if (!success && mounted) {
        final errorMsg = ref.read(authProvider).error ?? 'Login failed';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: KTColors.danger, // red SnackBar with message [cite: 52]
            duration: const Duration(seconds: 3),
          ),
        );
      }
      // Routing is handled automatically by AuthService on success [cite: 52]
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: KTColors.primary,
      body: Stack(
        children: [
          // Top Brand Area
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: MediaQuery.of(context).size.height * 0.4, // 40% of screen [cite: 51]
            child: SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.local_shipping, size: 64, color: Colors.white), // Placeholder for KT Logo
                  const SizedBox(height: 8),
                  Text("KT ERP", style: KTTextStyles.h2.copyWith(color: Colors.white)), // "KT ERP" label [cite: 51]
                ],
              ),
            ),
          ),
          
          // Bottom Card Area
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: MediaQuery.of(context).size.height * 0.65,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white, // White card slides up from bottom [cite: 51]
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)), // radius 28 [cite: 51]
              ),
              padding: const EdgeInsets.all(32.0),
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text("Welcome back", style: KTTextStyles.h1),
                      const SizedBox(height: 24),
                      
                      // Email Field
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress, // [cite: 51]
                        autofillHints: const [AutofillHints.email], // [cite: 51]
                        decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                        validator: (value) => value!.isEmpty ? 'Please enter your email' : null, // Show validation errors [cite: 116]
                      ),
                      const SizedBox(height: 16),
                      
                      // Password Field
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword, // obscure toggle [cite: 51]
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword), // eye icon [cite: 51]
                          ),
                        ),
                        validator: (value) => value!.isEmpty ? 'Please enter your password' : null,
                      ),
                      
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => launchUrl(Uri.parse('https://erp.kavyatransports.com/forgot-password')), // navigates to web URL [cite: 53]
                          child: Text('Forgot password?', style: KTTextStyles.label.copyWith(color: KTColors.primary)), // [cite: 52-53]
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Login Button
                      ElevatedButton(
                        onPressed: authState.isLoading ? null : _handleLogin, // Disable while loading [cite: 116]
                        child: authState.isLoading
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2), // CircularProgressIndicator inside buttons [cite: 110]
                              )
                            : const Text("LOGIN"),
                      ),
                    ],
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