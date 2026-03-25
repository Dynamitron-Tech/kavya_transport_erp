import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../providers/admin_providers.dart';

/// Admin shell with 5-tab bottom navigation (light theme).
class AdminShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const AdminShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = navigationShell.currentIndex;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: KTColors.surface,
          border: Border(top: BorderSide(color: KTColors.borderColor, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _NavItem(icon: Icons.home_outlined, selectedIcon: Icons.home_rounded, label: 'Home', index: 0, selectedIndex: selectedIndex, onTap: () => _goTo(0)),
                _NavItem(icon: Icons.work_outline_rounded, selectedIcon: Icons.work_rounded, label: 'Ops', index: 1, selectedIndex: selectedIndex, onTap: () => _goTo(1)),
                _NavItem(icon: Icons.bar_chart_outlined, selectedIcon: Icons.bar_chart_rounded, label: 'Finance', index: 2, selectedIndex: selectedIndex, onTap: () => _goTo(2)),
                _NavItem(icon: Icons.people_outline_rounded, selectedIcon: Icons.people_rounded, label: 'People', index: 3, selectedIndex: selectedIndex, onTap: () => _goTo(3)),
                _NavItem(icon: Icons.settings_outlined, selectedIcon: Icons.settings_rounded, label: 'Settings', index: 4, selectedIndex: selectedIndex, onTap: () => _goTo(4)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _goTo(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int index;
  final int selectedIndex;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.index,
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = index == selectedIndex;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.topCenter,
              children: [
                // Green dot above selected icon
                if (isSelected)
                  Positioned(
                    top: -6,
                    child: Container(
                      width: 4,
                      height: 4,
                      decoration: const BoxDecoration(
                        color: KTColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                Icon(
                  isSelected ? selectedIcon : icon,
                  size: 20,
                  color: isSelected ? KTColors.primary : KTColors.textMuted,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Poppins',
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                color: isSelected ? KTColors.primary : KTColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compliance bell icon button with badge.
class ComplianceBellButton extends ConsumerWidget {
  const ComplianceBellButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(complianceAlertCountProvider);
    return IconButton(
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text('$count', style: const TextStyle(fontSize: 10)),
        backgroundColor: KTColors.danger,
        child: const Icon(Icons.notifications_outlined, color: KTColors.textMuted, size: 24),
      ),
      onPressed: () => context.push('/admin/compliance'),
    );
  }
}
