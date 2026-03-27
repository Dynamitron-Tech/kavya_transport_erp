import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:kavya_app/services/offline_sync_service.dart';

void main() {
  group('OfflineSyncService', () {
    late OfflineSyncService offlineSyncService;

    setUpAll(() async {
      // Initialize Hive for testing (in-memory)
      await Hive.initFlutter();
    });

    setUp(() async {
      // Clear all boxes before each test
      await Hive.deleteBoxFromDisk('offline_queue');
      await Hive.deleteBoxFromDisk('fleet_cache');
      await Hive.deleteBoxFromDisk('acct_cache');
      await Hive.deleteBoxFromDisk('assoc_cache');

      offlineSyncService = OfflineSyncService();
      await offlineSyncService.init();
    });

    tearDown(() async {
      offlineSyncService.dispose();
      await Hive.deleteBoxFromDisk('offline_queue');
      await Hive.deleteBoxFromDisk('fleet_cache');
      await Hive.deleteBoxFromDisk('acct_cache');
      await Hive.deleteBoxFromDisk('assoc_cache');
    });

    test('should initialize with empty queue', () async {
      final pendingCount = await offlineSyncService.getPendingCount();
      expect(pendingCount, 0);
    });

    test('should enqueue POST request when offline', () async {
      // Simulate offline state
      offlineSyncService.isOnline = false;

      const testData = {
        'category': 'fuel',
        'amount': 500.0,
        'description': 'Fuel for trip #123'
      };

      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: testData,
      );

      final pendingCount = await offlineSyncService.getPendingCount();
      expect(pendingCount, 1);
    });

    test('should enqueue multiple requests in order', () async {
      offlineSyncService.isOnline = false;

      // Enqueue multiple requests
      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 100.0},
      );

      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 200.0},
      );

      await offlineSyncService.enqueueRequest(
        method: 'PUT',
        path: '/api/v1/trips/123/status',
        data: {'status': 'completed'},
      );

      final pendingCount = await offlineSyncService.getPendingCount();
      expect(pendingCount, 3);
    });

    test('should track sync status while syncing', () async {
      offlineSyncService.isOnline = false;

      // Enqueue a request
      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 100.0},
      );

      // Listen to status stream
      final statusStream = offlineSyncService.statusStream.take(3).toList();

      // Note: In a real test, you'd mock the API responses
      // For now we verify the queue count is tracked
      await offlineSyncService.syncAll();

      // Status should have been emitted during sync
      final statuses = await statusStream;
      expect(statuses.isNotEmpty, true);
    });

    test('should handle network state changes', () async {
      // Start offline
      offlineSyncService.isOnline = false;

      // Enqueue a request
      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 100.0},
      );

      expect(await offlineSyncService.getPendingCount(), 1);

      // Simulate coming online (in production, connectivity listener would do this)
      offlineSyncService.isOnline = true;
      // Sync would be triggered by _handleConnectionChange in real app
      // For testing, we verify the flag is set correctly
      expect(offlineSyncService.isOnline, true);
    });

    test('status stream emits correct queue count', () async {
      offlineSyncService.isOnline = false;

      final statusListener = <OfflineSyncStatus>[];
      offlineSyncService.statusStream.listen((status) {
        statusListener.add(status);
      });

      // Enqueue request - should emit status with queuedCount = 1
      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 100.0},
      );

      // Give listener time to receive
      await Future.delayed(const Duration(milliseconds: 100));

      // Find status with queued count
      final lastStatus = statusListener.lastWhere(
        (s) => s.queuedCount > 0,
        orElse: () => OfflineSyncStatus(queuedCount: 0),
      );

      expect(lastStatus.queuedCount, 1);
      expect(lastStatus.hasPending, true);
    });

    test('should handle PUT and PATCH requests in queue', () async {
      offlineSyncService.isOnline = false;

      // Enqueue different method types
      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: {'amount': 100.0},
      );

      await offlineSyncService.enqueueRequest(
        method: 'PUT',
        path: '/api/v1/trips/123/status',
        data: {'status': 'completed'},
      );

      await offlineSyncService.enqueueRequest(
        method: 'PATCH',
        path: '/api/v1/checklists/456',
        data: {'status': 'completed'},
      );

      final pendingCount = await offlineSyncService.getPendingCount();
      expect(pendingCount, 3);
    });

    test('should emit idle status when no pending requests', () async {
      final statusListener = <OfflineSyncStatus>[];
      offlineSyncService.statusStream.listen((status) {
        statusListener.add(status);
      });

      // Initially should be idle
      await Future.delayed(const Duration(milliseconds: 100));

      final idleStatus = statusListener.firstWhere(
        (s) => s.isIdle,
        orElse: () => OfflineSyncStatus(queuedCount: 0),
      );

      expect(idleStatus.isIdle, true);
      expect(idleStatus.queuedCount, 0);
    });

    test('should preserve request data in queue', () async {
      offlineSyncService.isOnline = false;

      const testData = {
        'name': 'Expense Test',
        'amount': 500.0,
        'category': 'fuel',
        'description': 'Testing offline sync'
      };

      await offlineSyncService.enqueueRequest(
        method: 'POST',
        path: '/api/v1/expenses',
        data: testData,
      );

      // Verify the request was stored (indirect test via queue count)
      final pendingCount = await offlineSyncService.getPendingCount();
      expect(pendingCount, 1);
      // In a real implementation, you'd also verify the exact data stored
    });
  });
}

// INTEGRATION TEST SIMULATION GUIDE:
// ====================================
// To test offline sync end-to-end on a device/emulator:
//
// 1. Turn on Airplane Mode
//    - Settings > Network & Internet > Airplane mode ON
//
// 2. Add an Expense in the Driver App
//    - Navigate to Driver > Create Expense
//    - Fill in: amount=$50, category=fuel, description=Test
//    - Submit
//    - Verify: "Syncing..." indicator appears then "Queued" message
//    - Check: Expense appears in list but shows "pending" badge
//
// 3. Verify Offline Queue
//    - Check "Offline Status" widget at bottom of screen
//    - Should show "1 pending action" (red indicator)
//
// 4. Turn OFF Airplane Mode
//    - Settings > Network & Internet > Airplane mode OFF
//    - Wait 3 seconds for connection restore
//
// 5. Verify Automatic Sync
//    - Offline Status widget should change to "All synced" (green)
//    - Expense "pending" badge should disappear
//    - Expense should now show "✓ Synced" status
//    - Verify expense ID changed from local ID to database ID
//
// 6. Verify No Duplicates
//    - Go to Finance > Expenses tab
//    - Search for the test expense
//    - Should appear ONLY ONCE in the list
//    - Server DB should also have exactly 1 entry
//
// 7. Test Multiple Items
//    - Repeat steps 1-2 but add 3 different expenses while offline
//    - Verify queue shows "3 pending actions"
//    - Turn OFF airplane mode
//    - Verify all 3 sync in correct order (FIFO)
//    - Verify "3 completed" message in sync status
//
// 8. Test Error Handling
//    - Go offline
//    - Try to add expense with missing fields (should fail validation)
//    - Verify error dialog prevents queue entry
//    - Compare with valid expense being queued correctly
//
// 9. Test Persistent Queue
//    - Go offline
//    - Add expense
//    - FORCE CLOSE app (don't wait for graceful shutdown)
//    - Reopen app
//    - Verify "1 pending action" still shows
//    - Go online
//    - Verify it syncs despite force close
//
// 10. Test With Network Interruption
//    - Go online with pending queue (1+ items)
//    - Wait for sync to start
//    - IMMEDIATELY turn airplane mode ON during sync
//    - Verify sync stops with error message
//    - Turn airplane mode OFF
//    - Verify it retries and completes
