import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: KavyaApp()));
}

class KavyaApp extends ConsumerWidget {
  const KavyaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Kavya Transports',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: const SplashTestApp(),
    );
  }
}

/// Test wrapper to showcase splash screen
class SplashTestApp extends StatefulWidget {
  const SplashTestApp({super.key});

  @override
  State<SplashTestApp> createState() => _SplashTestAppState();
}

class _SplashTestAppState extends State<SplashTestApp> {
  bool _showSplash = true;

  void _completeSplash() {
    setState(() => _showSplash = false);
  }

  void _restartSplash() {
    setState(() => _showSplash = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_showSplash) {
      return SplashScreen(
        onComplete: _completeSplash,
        onReadyForLogin: () => debugPrint('✓ Door opened, login card ready!'),
      );
    }

    return LoginTestScreen(onRestart: _restartSplash);
  }
}

/// Simple login screen for testing after splash
class LoginTestScreen extends StatelessWidget {
  final VoidCallback onRestart;

  const LoginTestScreen({super.key, required this.onRestart});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, size: 64, color: Colors.green),
            const SizedBox(height: 24),
            const Text(
              'Splash Complete!',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text(
              'Login screen would appear here',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: onRestart,
              icon: const Icon(Icons.replay),
              label: const Text('Replay Splash'),
            ),
          ],
        ),
      ),
    );
  }
}