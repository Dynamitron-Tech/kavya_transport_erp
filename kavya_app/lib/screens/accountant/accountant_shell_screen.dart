import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/notifications_provider.dart';

class AccountantShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const AccountantShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: Text(user?.fullName ?? 'Accountant',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        actions: [
          Consumer(builder: (ctx, ref, _) {
            final unread = ref.watch(unreadCountProvider);
            return Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
              backgroundColor: KTColors.danger,
              child: IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () => ctx.push('/notifications'),
              ),
            );
          }),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (v) {
              if (v == 'logout') ref.read(authProvider.notifier).logout();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'logout', child: Text('Logout')),
            ],
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          indicatorColor: KTColors.acctAccent.withValues(alpha: 0.15),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: KTColors.acctAccent, size: 20);
            }
            return const IconThemeData(color: KTColors.textMuted, size: 20);
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                  color: KTColors.acctAccent,
                  fontWeight: FontWeight.w500,
                  fontSize: 10);
            }
            return const TextStyle(color: KTColors.textMuted, fontSize: 10);
          }),
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (i) =>
              navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Dashboard'),
          NavigationDestination(
              icon: Icon(Icons.description_outlined),
              selectedIcon: Icon(Icons.description),
              label: 'Invoices'),
          NavigationDestination(
              icon: Icon(Icons.book_outlined),
              selectedIcon: Icon(Icons.book),
              label: 'Ledger'),
          NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined),
              selectedIcon: Icon(Icons.bar_chart),
              label: 'Reports'),
          NavigationDestination(
              icon: Icon(Icons.apps_outlined),
              selectedIcon: Icon(Icons.apps),
              label: 'More'),
        ],
        ),
      ),
    );
  }
}
