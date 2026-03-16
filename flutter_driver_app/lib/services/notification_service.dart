import 'package:firebase_messaging/firebase_messaging.dart';
import 'auth_service.dart';

class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final AuthService _authService = AuthService();

  Future<void> init() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      final token = await _messaging.getToken();
      if (token != null) {
        try {
          await _authService.updateFcmToken(token);
        } catch (_) {
          // FCM token update failure is non-critical
        }
      }

      _messaging.onTokenRefresh.listen((newToken) async {
        try {
          await _authService.updateFcmToken(newToken);
        } catch (_) {}
      });
    }
  }

  void onMessageReceived(void Function(RemoteMessage) handler) {
    FirebaseMessaging.onMessage.listen(handler);
  }

  void onMessageOpenedApp(void Function(RemoteMessage) handler) {
    FirebaseMessaging.onMessageOpenedApp.listen(handler);
  }
}
