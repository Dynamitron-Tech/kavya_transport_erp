import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/connectivity_provider.dart';
import '../../../providers/notifications_provider.dart';
import '../../../core/widgets/offline_banner.dart';
import '../../core/localization/locale_provider.dart';

class DriverHomeScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const DriverHomeScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider);
    final user = ref.watch(authProvider).user;
    final s = ref.watch(sProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(s.greeting(user?.fullName ?? 'Driver')),
        actions: [
          Consumer(
            builder: (ctx, ref, _) {
              final unread = ref.watch(unreadCountProvider);
              return Badge(
                isLabelVisible: unread > 0,
                label: Text(
                  '$unread',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                ),
                backgroundColor: KTColors.danger,
                child: IconButton(
                  icon: const Icon(Icons.notifications_outlined),
                  onPressed: () => ctx.push('/driver/notifications'),
                ),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'profile') {
                navigationShell.goBranch(3);
              } else if (value == 'language') {
                context.push('/driver/language-settings');
              } else if (value == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                  value: 'profile', child: Text(s.myProfile)),
              PopupMenuItem(
                  value: 'language',
                  child: Row(
                    children: [
                      const Icon(Icons.language, size: 18),
                      const SizedBox(width: 8),
                      Text(s.languageSettings),
                    ],
                  )),
              PopupMenuItem(
                  value: 'logout', child: Text(s.logout)),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (!isOnline) const OfflineBanner(),
          Expanded(child: navigationShell),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) =>
            navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex),
        indicatorColor: KTColors.primary.withValues(alpha: 0.12),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined),
              selectedIcon: const Icon(Icons.dashboard),
              label: s.today),
          NavigationDestination(
              icon: const Icon(Icons.local_shipping_outlined),
              selectedIcon: const Icon(Icons.local_shipping),
              label: s.trips),
          NavigationDestination(
              icon: const Icon(Icons.receipt_long_outlined),
              selectedIcon: const Icon(Icons.receipt_long),
              label: s.expenses),
          NavigationDestination(
              icon: const Icon(Icons.person_outlined),
              selectedIcon: const Icon(Icons.person),
              label: s.profile),
        ],
      ),
    );
  }
}
