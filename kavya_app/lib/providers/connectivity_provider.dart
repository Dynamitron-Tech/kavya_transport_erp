import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityProvider =
    StateNotifierProvider<ConnectivityNotifier, bool>((ref) {
  return ConnectivityNotifier();
});

class ConnectivityNotifier extends StateNotifier<bool> {
  late final StreamSubscription<List<ConnectivityResult>> _subscription;

  ConnectivityNotifier() : super(true) {
    _subscription = Connectivity()
        .onConnectivityChanged
        .listen((results) {
      state = results.any((r) => r != ConnectivityResult.none);
    });
    _checkInitial();
  }

  Future<void> _checkInitial() async {
    final results = await Connectivity().checkConnectivity();
    state = results.any((r) => r != ConnectivityResult.none);
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
