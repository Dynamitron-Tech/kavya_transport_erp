import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum BiometricType { fingerprint, face, iris, unknown }

class BiometricAuthService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<bool> canUseBiometrics() async {
    try {
      final isDeviceSupported = await _localAuth.canCheckBiometrics;
      final isDeviceSecure = await _localAuth.deviceSupportsBiometrics;
      return isDeviceSupported || isDeviceSecure;
    } catch (e) {
      debugPrint('Error checking biometrics: $e');
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      final biometrics = await _localAuth.getAvailableBiometrics();
      final types = <BiometricType>[];

      for (final biometric in biometrics) {
        if (biometric.toString().contains('fingerprint')) {
          types.add(BiometricType.fingerprint);
        } else if (biometric.toString().contains('face')) {
          types.add(BiometricType.face);
        } else if (biometric.toString().contains('iris')) {
          types.add(BiometricType.iris);
        } else {
          types.add(BiometricType.unknown);
        }
      }

      return types;
    } catch (e) {
      debugPrint('Error getting biometrics: $e');
      return [];
    }
  }

  Future<bool> authenticate({
    String reason = 'Authenticate to access Kavya Driver App',
    bool useErrorDialogs = true,
    bool stickyAuth = true,
  }) async {
    try {
      final isAuthenticated = await _localAuth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          stickyAuth: stickyAuth,
          biometricOnly: false,
          useErrorDialogs: useErrorDialogs,
        ),
      );

      if (isAuthenticated) {
        await _storage.write(key: 'biometric_authenticated', value: 'true');
        await _storage.write(
          key: 'biometric_last_auth',
          value: DateTime.now().toIso8601String(),
        );
        debugPrint('Biometric authentication successful');
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Biometric authentication error: $e');
      return false;
    }
  }

  Future<void> enableBiometricAuth(String userId) async {
    final canAuth = await canUseBiometrics();
    if (!canAuth) {
      // FIXED: Don't throw exception - gracefully handle unsupported devices
      debugPrint('Device does not support biometric authentication - falling back to PIN/password');
      
      // Disable biometric for this user since device doesn't support it
      await _storage.write(key: 'biometric_enabled_user_$userId', value: 'false');
      return;
    }
    
    final isAuthenticated = await authenticate(
      reason: 'Enable biometric login for faster access',
    );
    
    if (isAuthenticated) {
      await _storage.write(key: 'biometric_enabled_user_$userId', value: 'true');
      await _storage.write(
        key: 'biometric_enabled_timestamp',
        value: DateTime.now().toIso8601String(),
      );
      debugPrint('Biometric auth enabled for user $userId');
    }
  }

  Future<void> disableBiometricAuth(String userId) async {
    await _storage.delete(key: 'biometric_authenticated');
    await _storage.delete(key: 'biometric_enabled_user_$userId');
    await _storage.delete(key: 'biometric_token_$userId');
    debugPrint('Biometric auth disabled for user $userId');
  }

  Future<bool> isBiometricAuthEnabled(String userId) async {
    final value = await _storage.read(key: 'biometric_enabled_user_$userId');
    return value == 'true';
  }

  Future<bool> isBiometricAuthenticated() async {
    final value = await _storage.read(key: 'biometric_authenticated');
    return value == 'true';
  }

  /// Authenticate and retrieve stored credentials/token
  Future<String?> authenticateAndGetToken({
    String reason = 'Verify identity',
    required String userId,
  }) async {
    final isEnabled = await isBiometricAuthEnabled(userId);
    if (!isEnabled) {
      return null;
    }

    final isAuth = await authenticate(reason: reason);
    if (!isAuth) {
      return null;
    }

    return await _storage.read(key: 'biometric_token_$userId');
  }

  /// Store token for biometric login
  Future<void> storeTokenForBiometric({
    required String userId,
    required String token,
  }) async {
    try {
      await _storage.write(key: 'biometric_token_$userId', value: token);
      debugPrint('Token stored for biometric login');
    } catch (e) {
      debugPrint('Error storing token: $e');
      rethrow;
    }
  }

  /// Quick authenticate (if enabled)
  Future<bool> quickAuthenticate({required String userId}) async {
    final isEnabled = await isBiometricAuthEnabled(userId);
    if (!isEnabled) return true; // Skip if not enabled

    return authenticate(
      reason: 'Quick authentication',
      useErrorDialogs: false,
    );
  }

  /// Get biometric type display name
  String getBiometricTypeName(BiometricType type) {
    switch (type) {
      case BiometricType.fingerprint:
        return 'Fingerprint';
      case BiometricType.face:
        return 'Face ID';
      case BiometricType.iris:
        return 'Iris';
      case BiometricType.unknown:
        return 'Biometric';
    }
  }

  /// Clear all stored biometric data
  Future<void> clearAllBiometricData() async {
    try {
      await _storage.delete(key: 'biometric_authenticated');
      debugPrint('All biometric data cleared');
    } catch (e) {
      debugPrint('Error clearing biometric data: $e');
    }
  }
}

// Riverpod providers
final biometricAuthProvider = Provider<BiometricAuthService>((ref) {
  return BiometricAuthService();
});

// Biometric availability provider
final biometricAvailabilityProvider = FutureProvider<bool>((ref) async {
  final service = ref.read(biometricAuthProvider);
  return service.canUseBiometrics();
});

// Available biometrics provider
final availableBiometricsProvider = FutureProvider<List<BiometricType>>((ref) async {
  final service = ref.read(biometricAuthProvider);
  return service.getAvailableBiometrics();
});

// Biometric enabled state provider (accepts userId)
final biometricEnabledProvider = FutureProvider.family<bool, String>((ref, userId) async {
  final service = ref.read(biometricAuthProvider);
  return service.isBiometricAuthEnabled(userId);
});

// Quick authenticate provider
final quickAuthProvider = FutureProvider.family<bool, String>((ref, userId) async {
  final service = ref.read(biometricAuthProvider);
  return service.quickAuthenticate(userId: userId);
});
