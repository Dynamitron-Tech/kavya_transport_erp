import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/notification.dart' as models;

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();

  factory NotificationService() => _instance;

  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final List<models.NotificationModel> _notifications = [];
  VoidCallback? _onNotificationReceived;
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    const androidChannel = AndroidNotificationChannel(
      'kavya_transport_notifications',
      'Kavya Transport Notifications',
      description: 'Trip updates and alerts for Kavya Transport drivers',
      importance: Importance.high,
      enableVibration: true,
      playSound: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: true,
          requestBadgePermission: true,
          requestSoundPermission: true,
        ),
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint('[Notifications] Tapped: ${response.payload}');
      },
    );

    _initialized = true;
    debugPrint('[Notifications] Local notifications initialized');
  }

  /// Post a system banner AND add to the in-app notification list.
  Future<void> showTripEvent({
    required String title,
    required String body,
  }) async {
    // 1. Add to in-app list
    final notif = models.NotificationModel(
      id: 'trip_event_${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      body: body,
      type: 'trip_event',
      createdAt: DateTime.now().toIso8601String(),
      read: false,
    );
    _notifications.insert(0, notif);
    _onNotificationReceived?.call();

    // 2. Show system banner
    if (!_initialized) await initialize();
    try {
      await _localNotifications.show(
        id: notif.id.hashCode,
        title: title,
        body: body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'kavya_transport_notifications',
            'Kavya Transport Notifications',
            channelDescription:
                'Trip updates and alerts for Kavya Transport drivers',
            importance: Importance.high,
            priority: Priority.high,
            showWhen: true,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );
    } catch (e) {
      debugPrint('[Notifications] System banner failed: $e');
    }
  }

  // Public API
  List<models.NotificationModel> getNotifications() =>
      List.unmodifiable(_notifications);

  Future<void> markAsRead(String notificationId) async {
    final index = _notifications.indexWhere((n) => n.id == notificationId);
    if (index >= 0) {
      _notifications[index] = _notifications[index].copyWith(read: true);
      _onNotificationReceived?.call();
    }
  }

  void markAllAsRead() {
    for (int i = 0; i < _notifications.length; i++) {
      _notifications[i] = _notifications[i].copyWith(read: true);
    }
    _onNotificationReceived?.call();
  }

  Future<void> deleteNotification(String notificationId) async {
    _notifications.removeWhere((n) => n.id == notificationId);
    _onNotificationReceived?.call();
  }

  void clearAllNotifications() {
    _notifications.clear();
    _onNotificationReceived?.call();
  }

  void setOnNotificationReceivedCallback(VoidCallback callback) {
    _onNotificationReceived = callback;
  }
}
