import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/notification.dart' as models;

/// Background message handler - called when app is terminated
void firebaseMessagingBackgroundHandler(RemoteMessage message) {
  debugPrint('Handling background message: ${message.messageId}');
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  
  factory NotificationService() {
    return _instance;
  }
  
  NotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  late FlutterLocalNotificationsPlugin _localNotifications;
  final List<models.Notification> _notifications = [];
  VoidCallback? _onNotificationReceived;

  Future<void> initialize() async {
    debugPrint('[FCM] Initializing Firebase Messaging...');

    // Request permissions
    final settings = await _fcm.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carryForward: true,
      criticalSound: false,
      provisional: false,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] User denied notification permissions');
      return;
    }

    if (settings.authorizationStatus == AuthorizationStatus.provisional) {
      debugPrint('[FCM] Provisional permission granted');
    }

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      debugPrint('[FCM] Full permission granted');
    }

    // Get FCM token
    final token = await _fcm.getToken();
    debugPrint('[FCM] Device token: $token');

    // Setup local notifications for foreground display
    _initializeLocalNotifications();

    // Handle notification when app is in foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM] Message received in foreground: ${message.messageId}');
      _handleForegroundMessage(message);
    });

    // Handle notification when app is opened from terminated state
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[FCM] Message opened from terminated state: ${message.messageId}');
      _handleNotificationTap(message.data);
    });

    // Set background message handler BEFORE app starts receiving background messages
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Check if app was opened with a notification
    final initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[FCM] App opened with initial message: ${initialMessage.messageId}');
      _handleNotificationTap(initialMessage.data);
    }

    debugPrint('[FCM] Firebase Messaging initialized successfully');
  }

  void _initializeLocalNotifications() {
    _localNotifications = FlutterLocalNotificationsPlugin();

    const androidChannel = AndroidNotificationChannel(
      id: 'kavya_transport_notifications',
      name: 'Kavya Transport Notifications',
      description: 'Notifications for Kavya Transport ERP',
      importance: Importance.high,
      enableVibration: true,
      playSound: true,
    );

    _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint('[Local] Notification tapped: ${response.payload}');
        if (response.payload != null) {
          final data = _parsePayload(response.payload!);
          _handleNotificationTap(data);
        }
      },
    );
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = models.Notification(
      id: message.messageId ?? '',
      title: message.notification?.title ?? 'Kavya Transport',
      body: message.notification?.body ?? '',
      type: message.data['type'] ?? 'default',
      data: message.data,
      timestamp: DateTime.now(),
      read: false,
    );

    _notifications.insert(0, notification);

    // Show local notification banner
    _showLocalNotification(
      title: notification.title,
      body: notification.body,
      payload: _encodePayload(message.data),
    );

    // Trigger callback if listener is attached
    _onNotificationReceived?.call();
  }

  Future<void> _showLocalNotification({
    required String title,
    required String body,
    required String payload,
  }) async {
    try {
      await _localNotifications.show(
        title.hashCode,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'kavya_transport_notifications',
            'Kavya Transport Notifications',
            channelDescription: 'Notifications for Kavya Transport ERP',
            importance: Importance.high,
            priority: Priority.high,
            showWhen: true,
          ),
          iOS: DarwinNotificationDetails(
            critical: false,
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: payload,
      );
    } catch (e) {
      debugPrint('[Local Notifications] Error showing notification: $e');
    }
  }

  // Handle routing based on notification type
  void _handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type'] ?? 'default';
    final entityId = data['entity_id'];

    debugPrint('[FCM] Handling notification tap - type: $type, entityId: $entityId');

    switch (type) {
      case 'trip_assigned':
        // Trip assigned to driver
        if (entityId != null) {
          // TODO: Navigate to trip detail
        }
        break;

      case 'expense_approved':
      case 'expense_rejected':
        // Expense approval status changed
        // TODO: Navigate to expense list/detail
        break;

      case 'ewb_expiring':
        // E-way bill expiring soon
        // TODO: Navigate to e-way bill list
        break;

      case 'checklist_reminder':
        // Reminder to complete checklist
        // TODO: Navigate to checklist
        break;

      case 'payment_received':
        // Payment received notification (for accountant)
        // TODO: Navigate to receivables/invoices
        break;

      case 'location_report':
        // Location report for fleet manager
        // TODO: Navigate to fleet analytics
        break;

      default:
        debugPrint('[FCM] Unknown notification type: $type');
    }
  }

  String _encodePayload(Map<String, dynamic> data) {
    return data.entries.map((e) => '${e.key}=${e.value}').join('&');
  }

  Map<String, dynamic> _parsePayload(String payload) {
    final result = <String, dynamic>{};
    final pairs = payload.split('&');
    for (final pair in pairs) {
      final split = pair.split('=');
      if (split.length == 2) {
        result[split[0]] = split[1];
      }
    }
    return result;
  }

  // Public API
  List<models.Notification> getNotifications() => _notifications;

  Future<void> markAsRead(String notificationId) async {
    final index = _notifications.indexWhere((n) => n.id == notificationId);
    if (index >= 0) {
      _notifications[index] = _notifications[index].copyWith(read: true);
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    _notifications.removeWhere((n) => n.id == notificationId);
  }

  void clearAllNotifications() {
    _notifications.clear();
  }

  void setOnNotificationReceivedCallback(VoidCallback callback) {
    _onNotificationReceived = callback;
  }

  Future<String?> getFCMToken() => _fcm.getToken();
}