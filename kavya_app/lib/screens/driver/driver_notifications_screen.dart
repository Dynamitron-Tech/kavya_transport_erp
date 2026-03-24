import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/notification.dart';
import '../../providers/notifications_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/localization/locale_provider.dart';
import '../../core/localization/driver_strings.dart';

class DriverNotificationsScreen extends ConsumerWidget {
  const DriverNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);
    final s = ref.watch(sProvider);

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        title: Text(s.notifications,
            style: const TextStyle(color: KTColors.textPrimary)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (notifications.any((n) => !n.read))
            TextButton.icon(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllAsRead(),
              icon: const Icon(Icons.done_all_rounded,
                  color: KTColors.primary, size: 18),
              label: Text(s.markAllRead,
                  style: const TextStyle(color: KTColors.primary, fontSize: 12)),
            ),
        ],
        elevation: 0,
      ),
      body: notifications.isEmpty
          ? _buildEmpty(s)
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _NotifCard(
                notif: notifications[i],
                onTap: () => ref
                    .read(notificationsProvider.notifier)
                    .markAsRead(notifications[i].id),
              ),
            ),
    );
  }

  Widget _buildEmpty(S s) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: KTColors.darkElevated,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.notifications_off_outlined,
                size: 40, color: KTColors.textMuted),
          ),
          const SizedBox(height: 20),
          Text(s.allCaughtUp,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: KTColors.textPrimary)),
          const SizedBox(height: 8),
          Text(s.tripUpdatesWillAppear,
              style: const TextStyle(fontSize: 14, color: KTColors.textSecondary)),
        ],
      ),
    );
  }
}

class _NotifCard extends StatelessWidget {
  final NotificationModel notif;
  final VoidCallback onTap;

  const _NotifCard({required this.notif, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = _color(notif.type);
    final icon = _icon(notif.type);
    final timeStr = _formatTime(notif.createdAt);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: notif.read
              ? KTColors.darkElevated
              : color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: notif.read
                ? KTColors.darkBorder
                : color.withValues(alpha: 0.35),
          ),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notif.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: notif.read
                                ? FontWeight.w500
                                : FontWeight.w700,
                            color: KTColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!notif.read)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 6),
                          decoration: BoxDecoration(
                              color: color, shape: BoxShape.circle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notif.body,
                    style: const TextStyle(
                        fontSize: 13,
                        color: KTColors.textSecondary,
                        height: 1.4),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(timeStr,
                      style: const TextStyle(
                          fontSize: 11, color: KTColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _color(String? type) {
    switch (type) {
      case 'trip_event':
        return KTColors.primary;
      case 'expense_approved':
        return KTColors.success;
      case 'expense_rejected':
        return KTColors.danger;
      case 'salary_update':
        return KTColors.info;
      case 'trip_assigned':
        return const Color(0xFF60A5FA);
      default:
        return KTColors.primary;
    }
  }

  IconData _icon(String? type) {
    switch (type) {
      case 'trip_event':
        return Icons.local_shipping_rounded;
      case 'expense_approved':
        return Icons.check_circle_rounded;
      case 'expense_rejected':
        return Icons.cancel_rounded;
      case 'salary_update':
        return Icons.account_balance_wallet_rounded;
      case 'trip_assigned':
        return Icons.assignment_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  String _formatTime(String? iso) {
    if (iso == null) return 'Just now';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return 'Just now';
    }
  }
}
