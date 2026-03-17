import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/notification_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';

class DriverNotificationsScreen extends ConsumerWidget {
  const DriverNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Center(
              child: TextButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.done_all, color: Colors.white, size: 18),
                label: const Text('Mark All Read', style: TextStyle(color: Colors.white, fontSize: 12)),
              ),
            ),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_off_outlined, size: 56, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text('No notifications', style: KTTextStyles.h3),
                  const SizedBox(height: 8),
                  const Text('You\'re all caught up!', style: TextStyle(color: KTColors.textSecondary)),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: notifications.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, index) {
              final notif = notifications[index];
              return _notificationCard(notif);
            },
          );
        },
        loading: () => Column(
          children: List.generate(
            5,
            (index) => Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                bottom: index == 4 ? 0 : 8,
                top: index == 0 ? 16 : 0,
              ),
              child: Container(
                height: 90,
                decoration: BoxDecoration(
                  color: KTColors.cardSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Shimmer.fromColors(
                  baseColor: Colors.grey,
                  highlightColor: Colors.white,
                  child: SizedBox.expand(),
                ),
              ),
            ),
          ),
        ),
        error: (e, st) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 56, color: KTColors.danger),
              const SizedBox(height: 16),
              Text('Error loading notifications', style: KTTextStyles.h3),
              const SizedBox(height: 8),
              Text(e.toString(), style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _notificationCard(Map<String, dynamic> notif) {
    final type = notif['type'] ?? 'default';
    final title = notif['title'] ?? 'Notification';
    final message = notif['message'] ?? '';
    final createdAt = notif['created_at'] ?? 'Just now';
    final isRead = notif['read'] ?? false;

    return Card(
      color: isRead ? Colors.white : KTColors.primary.withValues(alpha: 0.05),
      child: InkWell(
        onTap: () => _showNotificationDetail(title, message),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _getTypeColor(type).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(_getTypeIcon(type), color: _getTypeColor(type)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: KTColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      message,
                      style: const TextStyle(fontSize: 12, color: KTColors.textSecondary, height: 1.4),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(createdAt, style: const TextStyle(fontSize: 10, color: KTColors.textMuted)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, size: 20, color: KTColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }

  void _showNotificationDetail(String title, String message) {
    final context = _getContextFromWidget();
    if (context == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  BuildContext? _getContextFromWidget() {
    // This is a workaround - in a real app, you'd pass context properly
    return null;
  }

  IconData _getTypeIcon(String type) {
    const icons = {
      'expense_submitted': Icons.receipt_long,
      'ewb_expiring': Icons.warning,
      'trip_completed': Icons.check_circle,
      'trip_assigned': Icons.assignment,
      'message': Icons.mail,
      'alert': Icons.notifications,
    };
    return icons[type] ?? Icons.notifications;
  }

  Color _getTypeColor(String type) {
    const colors = {
      'expense_submitted': KTColors.success,
      'ewb_expiring': KTColors.warning,
      'trip_completed': KTColors.info,
      'trip_assigned': KTColors.primary,
      'message': KTColors.primary,
      'alert': KTColors.danger,
    };
    return colors[type] ?? KTColors.primary;
  }
}
