import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/kt_colors.dart'; 
import 'core/router/app_router.dart';
import 'services/offline_sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final offlineSyncService = OfflineSyncService();
  await offlineSyncService.init();

  runApp(
    ProviderScope(
      overrides: [
        offlineSyncProvider.overrideWithValue(offlineSyncService),
      ],
      child: const KavyaApp(),
    ),
  );
}

class KavyaApp extends ConsumerWidget {
  const KavyaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Kavya Transports ERP',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      builder: (context, child) {
        return Scaffold(
          body: Stack(
            children: [
              child!,
              Consumer(
                builder: (context, ref, _) {
                  final isOnline = ref.watch(offlineSyncProvider).isOnline;
                  if (!isOnline) {
                    return Positioned(
                      top: MediaQuery.of(context).padding.top,
                      left: 0, right: 0,
                      child: Container(
                        color: KTColors.danger,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: const Text(
                          "No internet connection. Operating offline.",
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ],
          ),
        );
      },
    );
  }
}