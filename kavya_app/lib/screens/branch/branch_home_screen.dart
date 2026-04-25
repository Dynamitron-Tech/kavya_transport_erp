import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_role_badge.dart';
import '../../core/widgets/offline_banner.dart';
import '../../providers/auth_provider.dart';
import '../../providers/connectivity_provider.dart';

class BranchHomeScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const BranchHomeScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: KTColors.navy950,
      appBar: AppBar(
        backgroundColor: KTColors.navy900,
        elevation: 0,
        title: Row(
          children: [
            Expanded(
              child: Text(
                'Hi, ${user?.fullName ?? 'Manager'}',
                style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            const KTRoleBadge(role: 'manager'),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: KTColors.darkTextPrimary),
            color: KTColors.navy800,
            onSelected: (value) {
              if (value == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'logout',
                child: Text('Logout', style: KTTextStyles.body.copyWith(color: KTColors.darkTextPrimary)),
              ),
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
        backgroundColor: KTColors.navy900,
        indicatorColor: KTColors.amber500.withValues(alpha: 0.15),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined, color: KTColors.darkTextSecondary),
            selectedIcon: Icon(Icons.dashboard, color: KTColors.amber500),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined, color: KTColors.darkTextSecondary),
            selectedIcon: Icon(Icons.local_shipping, color: KTColors.amber500),
            label: 'Trips',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline, color: KTColors.darkTextSecondary),
            selectedIcon: Icon(Icons.people, color: KTColors.amber500),
            label: 'Drivers',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined, color: KTColors.darkTextSecondary),
            selectedIcon: Icon(Icons.bar_chart, color: KTColors.amber500),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}
