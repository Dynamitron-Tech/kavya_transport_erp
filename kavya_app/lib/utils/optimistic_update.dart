import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Optimistic update helper for form submissions
/// Immediately updates UI state before server confirms, with rollback on failure
class OptimisticUpdate {
  /// Apply optimistic update: update UI immediately, send request, rollback on error
  /// 
  /// Usage:
  /// ```dart
  /// final result = await OptimisticUpdate.apply<MyModel>(
  ///   // Optimistic UI update
  ///   onApply: () async {
  ///     ref.read(myProvider.notifier).state = optimisticValue;
  ///   },
  ///   // Server request
  ///   onRequest: () async {
  ///     await api.updateItem(data);
  ///   },
  ///   // Rollback on failure
  ///   onRollback: () async {
  ///     ref.read(myProvider.notifier).state = previousValue;
  ///   },
  /// );
  /// ```
  static Future<T> apply<T>({
    required Future<void> Function() onApply,
    required Future<T> Function() onRequest,
    required Future<void> Function() onRollback,
  }) async {
    try {
      // Apply optimistic update immediately
      await onApply();
      
      // Send request to server
      final result = await onRequest();
      
      // Success - keep optimistic update
      return result;
    } catch (e) {
      // Rollback on failure
      await onRollback();
      rethrow;
    }
  }

  /// Apply update with UI feedback
  static Future<T> withFeedback<T>({
    required Future<void> Function() onApply,
    required Future<T> Function() onRequest,
    required Future<void> Function() onRollback,
    required void Function(bool isLoading) onLoading,
    required void Function(Object error) onError,
  }) async {
    try {
      onLoading(true);
      
      // Apply optimistic update
      await onApply();
      
      // Send request
      final result = await onRequest();
      
      onLoading(false);
      return result;
    } catch (e) {
      onLoading(false);
      onError(e);
      
      // Rollback
      await onRollback();
      rethrow;
    }
  }
}

/// Mixin for StateNotifier to support optimistic updates
mixin OptimisticUpdateMixin<T> on StateNotifier<T> {
  T? _previousState;

  /// Save current state before optimistic update
  void saveState() {
    _previousState = state;
  }

  /// Restore to previous state (rollback)
  void restorePreviousState() {
    if (_previousState != null) {
      state = _previousState!;
    }
  }

  /// Apply optimistic update with auto-rollback
  Future<R> optimisticUpdate<R>({
    required Future<void> Function() updateFn,
    required Future<R> Function() requestFn,
  }) async {
    saveState();
    
    try {
      // Apply update
      await updateFn();
      
      // Send request
      final result = await requestFn();
      
      return result;
    } catch (e) {
      // Rollback
      restorePreviousState();
      rethrow;
    }
  }
}

/// Extension for StateNotifierProvider to easily apply optimistic updates
extension OptimisticUpdateExt<T, N extends StateNotifier<T>> 
    on StateNotifierProvider<N, T> {
  
  /// Apply optimistic update to this provider
  Future<R> optimisticUpdate<R>(
    WidgetRef ref, {
    required Future<void> Function() onApply,
    required Future<R> Function() onRequest,
    required Future<void> Function() onRollback,
  }) async {
    return OptimisticUpdate.apply(
      onApply: onApply,
      onRequest: onRequest,
      onRollback: onRollback,
    );
  }
}

/// Form submission helper with optimistic updates
class OptimisticFormSubmit {
  /// Submit form with optimistic update
  static Future<T> submit<T>({
    required Future<void> Function() optimisticUpdate,
    required Future<T> Function() submit,
    required Future<void> Function() rollback,
    bool skipOptimistic = false,
  }) async {
    if (!skipOptimistic) {
      await optimisticUpdate();
    }
    
    try {
      return await submit();
    } catch (e) {
      await rollback();
      rethrow;
    }
  }

  /// Submit with error and loading state handling
  static Future<T> submitWithFeedback<T>({
    required Future<void> Function() optimisticUpdate,
    required Future<T> Function() submit,
    required Future<void> Function() rollback,
    required void Function(bool) onLoading,
    required void Function(String) onError,
    bool skipOptimistic = false,
  }) async {
    try {
      onLoading(true);
      
      if (!skipOptimistic) {
        await optimisticUpdate();
      }
      
      final result = await submit();
      onLoading(false);
      return result;
    } catch (e) {
      onLoading(false);
      onError(e.toString());
      await rollback();
      rethrow;
    }
  }
}
