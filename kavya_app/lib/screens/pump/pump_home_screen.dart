import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/connectivity_provider.dart';
import '../../core/widgets/offline_banner.dart';

/// Pump Operator shell — dark slate with amber accents.
/// Industrial, functional, high contrast for outdoor/standing use.
class PumpHomeScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const PumpHomeScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Hi, ${user?.fullName ?? 'Operator'}',
          style: const TextStyle(color: Color(0xFF0D1B2A), fontWeight: FontWeight.w600),
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Color(0xFF0D1B2A)),
            onSelected: (value) {
              if (value == 'logout') {
                ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'logout', child: Text('Logout')),
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
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: const Color(0xFFEA580C).withValues(alpha: 0.12),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined, color: Color(0xFF8494A4)),
            selectedIcon: Icon(Icons.dashboard, color: Color(0xFFEA580C)),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_gas_station_outlined, color: Color(0xFF8494A4)),
            selectedIcon: Icon(Icons.local_gas_station, color: Color(0xFFEA580C)),
            label: 'Dispense',
          ),
          NavigationDestination(
            icon: Icon(Icons.list_alt_outlined, color: Color(0xFF8494A4)),
            selectedIcon: Icon(Icons.list_alt, color: Color(0xFFEA580C)),
            label: 'Log',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined, color: Color(0xFF8494A4)),
            selectedIcon: Icon(Icons.bar_chart, color: Color(0xFFEA580C)),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}
