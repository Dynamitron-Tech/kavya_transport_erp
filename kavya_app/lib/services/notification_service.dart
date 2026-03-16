import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
// import 'package:firebase_messaging/firebase_messaging.dart'; // Uncomment when Firebase is configured
// import 'package:flutter_local_notifications/flutter_local_notifications.dart'; // Uncomment for local notifications

class NotificationService {
  final GoRouter router;
  
  NotificationService(this.router);

  // Call this during app initialization
  Future<void> initialize() async {
    // 1. Request permissions (FirebaseMessaging.instance.requestPermission())
    // 2. Setup foreground handlers (flutter_local_notifications banner) [cite: 104]
    // 3. Setup background/terminated handlers
    
    /* FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationTap(message.data);
    });
    */
  }

  // Handle routing based on notification type [cite: 102-104]
  void handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type'];
    final entityId = data['entity_id']; // Can be passed as query param if needed

    switch (type) {
      case 'expense_submitted':
        router.push('/fleet/expenses');
        break;
      case 'ewb_expiring':
        router.push('/associate/home'); // or directly to EWB list
        break;
      case 'document_expiring':
        router.push('/fleet/vehicles');
        break;
      case 'approval_required':
        // Route based on role (could check authProvider here)
        router.push('/fleet/expenses'); 
        break;
      case 'payment_received':
        router.push('/accountant/receivables');
        break;
      default:
        router.push('/notifications');
    }
  }
}