import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/connectivity_provider.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/theme/kt_colors.dart';

/// Tyre Inspector shell — light background with deep teal accent.
/// Four-tab NavigationBar shared across all tyre-inspector screens.
class TyreShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const TyreShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.tire_repair_rounded, color: _accent, size: 18),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Tyre Inspector',
                  style: TextStyle(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    decoration: TextDecoration.none,
                  ),
                ),
                if (user?.fullName != null)
                  Text(
                    user!.fullName,
                    style: const TextStyle(
                      color: KTColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      decoration: TextDecoration.none,
                    ),
                  ),
              ],
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: KTColors.textHeading),
            color: KTColors.surface,
            elevation: 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: KTColors.borderColor),
            ),
            onSelected: (value) {
              if (value == 'profile') {
                context.push('/tyre/profile');
              } else if (value == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    const Icon(Icons.person_outline_rounded,
                        color: KTColors.textMuted, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'My Profile',
                      style: TextStyle(
                        color: KTColors.textHeading,
                        fontSize: 14,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 1),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, color: KTColors.danger, size: 18),
                    SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: TextStyle(
                        color: KTColors.danger,
                        fontSize: 14,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
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
        backgroundColor: KTColors.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: _accent.withValues(alpha: 0.12),
        selectedIndex: navigationShell.currentIndex,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.dashboard_outlined, color: KTColors.textMuted),
            selectedIcon: Icon(Icons.dashboard_rounded, color: _accent),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: const Icon(Icons.directions_car_outlined, color: KTColors.textMuted),
            selectedIcon: Icon(Icons.directions_car_filled, color: _accent),
            label: 'Vehicles',
          ),
          NavigationDestination(
            icon: const Icon(Icons.tire_repair_outlined, color: KTColors.textMuted),
            selectedIcon: Icon(Icons.tire_repair_rounded, color: _accent),
            label: 'Inspections',
          ),
          NavigationDestination(
            icon: const Icon(Icons.history_outlined, color: KTColors.textMuted),
            selectedIcon: Icon(Icons.history_rounded, color: _accent),
            label: 'History',
          ),
          NavigationDestination(
            icon: const Icon(Icons.inventory_2_outlined, color: KTColors.textMuted),
            selectedIcon: Icon(Icons.inventory_2_rounded, color: _accent),
            label: 'Inventory',
          ),
        ],
      ),
    );
  }

  static const Color _accent = Color(0xFF0F766E); // deep teal
}
