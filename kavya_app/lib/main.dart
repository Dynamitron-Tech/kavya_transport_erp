import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'services/offline_sync_service.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive (offline cache + queue)
  final offlineSync = OfflineSyncService();
  await offlineSync.init();

  // Initialize local notifications (system banners)
  await NotificationService().initialize();

  runApp(ProviderScope(
    overrides: [
      offlineSyncProvider.overrideWithValue(offlineSync),
    ],
    child: const KavyaApp(),
  ));
}

class KavyaApp extends ConsumerWidget {
  const KavyaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Kavya Transports',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }
}