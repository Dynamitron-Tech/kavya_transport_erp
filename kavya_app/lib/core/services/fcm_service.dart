import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';

// Riverpod provider so screens can update the badge count
final unreadNotificationCountProvider = StateProvider<int>((ref) => 0);

/// Top-level handler required by Firebase for background messages.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[FCM] Background message: ${message.messageId}');
}

class FCMService {
  FCMService._();
  static final FCMService instance = FCMService._();

  final _messaging = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  static const _storage = FlutterSecureStorage();

  // Channel used for showing heads-up notifications on Android
  static const _androidChannel = AndroidNotificationChannel(
    'kavya_high_importance',
    'Kavya Transport Alerts',
    description: 'Real-time trip, EWB and job alerts',
    importance: Importance.high,
    enableVibration: true,
    playSound: true,
  );

  /// Call once from main.dart after Firebase.initializeApp().
  Future<void> initialize({required WidgetRef ref, required BuildContext context}) async {
    // 1. Register background handler
    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

    // 2. Create Android notification channel
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);

    // 3. Initialise local notifications plugin
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        if (response.payload != null) {
          _handleNavigation(response.payload!, context);
        }
      },
    );

    // 4. Request permission (iOS / Android 13+)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[FCM] Permission: ${settings.authorizationStatus}');
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // 5. Get device token and save to backend
    final token = await _messaging.getToken();
    if (token != null) {
      await _saveTokenToBackend(token);
      await _storage.write(key: 'fcm_token', value: token);
    }

    // 6. Refresh token on rotation
    _messaging.onTokenRefresh.listen((newToken) async {
      await _saveTokenToBackend(newToken);
      await _storage.write(key: 'fcm_token', value: newToken);
    });

    // 7. Foreground message handler — show local notification + increment badge
    FirebaseMessaging.onMessage.listen((message) {
      _showLocalNotification(message);
      ref.read(unreadNotificationCountProvider.notifier).update((c) => c + 1);
    });

    // 8. Opened-from-notification handler (app in background)
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final route = message.data['route'] as String?;
      if (route != null && context.mounted) {
        context.push(route);
      }
    });

    // 9. Handle notification that launched the app from terminated state
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      final route = initial.data['route'] as String?;
      if (route != null && context.mounted) {
        // Delay to let the widget tree settle
        WidgetsBinding.instance.addPostFrameCallback((_) => context.push(route));
      }
    }
  }

  Future<void> _saveTokenToBackend(String token) async {
    try {
      final api = ApiService();
      await api.patch('/users/me/fcm-token', data: {'fcm_token': token});
    } catch (e) {
      debugPrint('[FCM] Token save failed: $e');
    }
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final payload = jsonEncode(message.data);
    await _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: payload,
    );
  }

  void _handleNavigation(String payload, BuildContext context) {
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final route = data['route'] as String?;
      if (route != null && context.mounted) {
        context.push(route);
      }
    } catch (_) {}
  }
}
