import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/services/fcm_service.dart'; // unreadNotificationCountProvider

const _kPaAccent = KTColors.paAccent;

class PAShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const PAShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: navigationShell,
      bottomNavigationBar: _PABottomNav(
        currentIndex: navigationShell.currentIndex,
        unreadCount: unread,
        onTap: (i) =>
            navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
      ),
    );
  }
}

class _PABottomNav extends StatelessWidget {
  final int currentIndex;
  final int unreadCount;
  final void Function(int) onTap;

  const _PABottomNav({
    required this.currentIndex,
    required this.unreadCount,
    required this.onTap,
  });

  static const _items = [
    (Icons.home_rounded, Icons.home_outlined, 'Home'),
    (Icons.work_rounded, Icons.work_outline, 'Jobs'),
    (Icons.timer_rounded, Icons.timer_outlined, 'EWB'),
    (Icons.account_balance_rounded, Icons.account_balance_outlined, 'Banking'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        border: Border(
          top: BorderSide(color: _kPaAccent.withValues(alpha: 0.35), width: 1.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
          child: Row(
            children: List.generate(_items.length, (i) {
              final item = _items[i];
              final isSelected = i == currentIndex;
              final showBadge = i == 2 && unreadCount > 0;

              return Expanded(
                child: GestureDetector(
                  onTap: () => onTap(i),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? _kPaAccent.withValues(alpha: 0.14)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(
                              isSelected ? item.$1 : item.$2,
                              color: isSelected ? _kPaAccent : KTColors.textMuted,
                              size: 22,
                            ),
                            if (showBadge)
                              Positioned(
                                top: -5,
                                right: -8,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: const BoxDecoration(
                                    color: KTColors.danger,
                                    shape: BoxShape.circle,
                                  ),
                                  constraints:
                                      const BoxConstraints(minWidth: 16, minHeight: 16),
                                  child: Text(
                                    unreadCount > 9 ? '9+' : '$unreadCount',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                        fontSize: 9,
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight:
                                isSelected ? FontWeight.w700 : FontWeight.w400,
                            color: isSelected
                                ? _kPaAccent
                                : KTColors.textMuted,
                          ),
                          child: Text(item.$3),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
