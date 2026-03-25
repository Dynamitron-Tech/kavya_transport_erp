import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';

class ManagerShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const ManagerShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        backgroundColor: KTColors.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        indicatorColor: KTColors.managerAccent.withOpacity(0.18),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (i) =>
            navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: KTColors.managerAccent),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.work_outline),
            selectedIcon: Icon(Icons.work, color: KTColors.managerAccent),
            label: 'Jobs',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people, color: KTColors.managerAccent),
            label: 'Clients',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping, color: KTColors.managerAccent),
            label: 'Fleet',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: KTColors.managerAccent),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}
