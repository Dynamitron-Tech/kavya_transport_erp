import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_theme.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/empty_state.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifState = ref.watch(notificationListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.read(notificationListProvider.notifier).fetch(),
        child: notifState.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child:
                LoadingSkeletonWidget(itemCount: 6, variant: LoadingVariant.list),
          ),
          error: (e, _) => ErrorStateWidget(
            error: e,
            onRetry: () => ref.read(notificationListProvider.notifier).fetch(),
          ),
          data: (notifications) {
            if (notifications.isEmpty) {
              return const EmptyStateWidget(
                icon: Icons.notifications_none,
                title: 'No notifications',
                message: 'You\'re all caught up!',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final notif = notifications[index];
                return Card(
                  color: notif.read ? null : AppTheme.info.withValues(alpha: 0.04),
                  child: ListTile(
                    leading: CircleAvatar(
                      radius: 18,
                      backgroundColor: notif.read
                          ? AppTheme.border
                          : AppTheme.info.withValues(alpha: 0.12),
                      child: Icon(
                        _typeIcon(notif.type),
                        size: 18,
                        color: notif.read ? AppTheme.textMuted : AppTheme.info,
                      ),
                    ),
                    title: Text(notif.title,
                        style: TextStyle(
                            fontWeight:
                                notif.read ? FontWeight.w400 : FontWeight.w600,
                            fontSize: 14)),
                    subtitle: Text(notif.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12)),
                    onTap: () => ref
                        .read(notificationListProvider.notifier)
                        .markRead(notif.id),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  IconData _typeIcon(String? type) {
    switch (type) {
      case 'trip':
        return Icons.local_shipping;
      case 'expense':
        return Icons.receipt_long;
      case 'alert':
        return Icons.warning_amber;
      default:
        return Icons.notifications;
    }
  }
}
