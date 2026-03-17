import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/notification.dart';
import '../services/notification_service.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});

// Watch notifications list
final notificationsProvider = StateNotifierProvider<NotificationsNotifier, List<Notification>>((ref) {
  return NotificationsNotifier(ref.read(notificationServiceProvider));
});

class NotificationsNotifier extends StateNotifier<List<Notification>> {
  final NotificationService _notificationService;

  NotificationsNotifier(this._notificationService) : super([]) {
    // Initialize with existing notifications
    state = _notificationService.getNotifications();
    
    // Listen for new notifications
    _notificationService.setOnNotificationReceivedCallback(() {
      state = _notificationService.getNotifications();
    });
  }

  Future<void> markAsRead(String notificationId) async {
    await _notificationService.markAsRead(notificationId);
    state = _notificationService.getNotifications();
  }

  Future<void> deleteNotification(String notificationId) async {
    await _notificationService.deleteNotification(notificationId);
    state = _notificationService.getNotifications();
  }

  void clearAll() {
    _notificationService.clearAllNotifications();
    state = [];
  }

  int getUnreadCount() {
    return state.where((n) => !n.read).length;
  }
}

// Get unread count
final unreadCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider);
  return notifications.where((n) => !n.read).length;
});
