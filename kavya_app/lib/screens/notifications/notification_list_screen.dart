import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/notification.dart';
import '../../providers/notifications_provider.dart';

class NotificationListScreen extends ConsumerWidget {
  const NotificationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (notifications.any((n) => !n.read))
            TextButton(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllAsRead(),
              child: const Text('Mark all read',
                  style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: notifications.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_outlined,
                      size: 56, color: KTColors.textMuted),
                  SizedBox(height: 16),
                  Text('No new notifications',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: KTColors.textPrimary)),
                  SizedBox(height: 8),
                  Text("You're all caught up!",
                      style: TextStyle(color: KTColors.textSecondary)),
                ],
              ),
            )
          : ListView.separated(
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final n = notifications[index];
                return _NotifTile(notif: n, onTap: () {
                  ref.read(notificationsProvider.notifier).markAsRead(n.id);
                  _navigate(context, n.type);
                });
              },
            ),
    );
  }

  void _navigate(BuildContext context, String? type) {
    switch (type) {
      case 'expense_submitted':
        context.push('/fleet/expenses');
        break;
      case 'ewb_expiring':
        context.push('/pa/ewb');
        break;
    }
  }
}

class _NotifTile extends StatelessWidget {
  final NotificationModel notif;
  final VoidCallback onTap;

  const _NotifTile({required this.notif, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _iconAndColor(notif.type);
    return ListTile(
      contentPadding: const EdgeInsets.all(16),
      tileColor: notif.read ? null : KTColors.primary.withValues(alpha: 0.05),
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(icon, color: color),
      ),
      title: Text(
        notif.title,
        style: KTTextStyles.label.copyWith(
            fontWeight: notif.read ? FontWeight.w500 : FontWeight.w700),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(notif.body, style: KTTextStyles.body),
            const SizedBox(height: 6),
            Text(_formatTime(notif.createdAt),
                style: KTTextStyles.bodySmall
                    .copyWith(color: KTColors.textMuted)),
          ],
        ),
      ),
      trailing: notif.read
          ? null
          : Container(
              width: 8,
              height: 8,
              decoration:
                  const BoxDecoration(color: KTColors.primary, shape: BoxShape.circle),
            ),
      onTap: onTap,
    );
  }

  (IconData, Color) _iconAndColor(String? type) {
    switch (type) {
      case 'trip_event':
        return (Icons.local_shipping_rounded, KTColors.primary);
      case 'expense_approved':
        return (Icons.check_circle_rounded, KTColors.success);
      case 'expense_rejected':
        return (Icons.cancel_rounded, KTColors.danger);
      case 'expense_submitted':
        return (Icons.receipt_long_rounded, KTColors.warning);
      case 'ewb_expiring':
        return (Icons.timer_rounded, KTColors.danger);
      case 'payment_received':
        return (Icons.account_balance_wallet_rounded, KTColors.success);
      default:
        return (Icons.notifications_rounded, KTColors.info);
    }
  }

  String _formatTime(String? iso) {
    if (iso == null) return 'Just now';
    try {
      final diff = DateTime.now().difference(DateTime.parse(iso).toLocal());
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return 'Just now';
    }
  }
}
