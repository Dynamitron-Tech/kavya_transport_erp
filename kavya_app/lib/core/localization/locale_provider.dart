import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'driver_strings.dart';

const _kStorageKey = 'driver_locale';
const _storage = FlutterSecureStorage();

/// Provides the current [AppLocale].
final localeProvider = StateNotifierProvider<LocaleNotifier, AppLocale>((ref) {
  return LocaleNotifier();
});

/// Convenience: provides the already-built [S] translation object.
final sProvider = Provider<S>((ref) => S(ref.watch(localeProvider)));

class LocaleNotifier extends StateNotifier<AppLocale> {
  LocaleNotifier() : super(AppLocale.en) {
    _load();
  }

  Future<void> _load() async {
    final saved = await _storage.read(key: _kStorageKey);
    if (saved != null) {
      final match = AppLocale.values.where((l) => l.name == saved);
      if (match.isNotEmpty) state = match.first;
    }
  }

  Future<void> setLocale(AppLocale locale) async {
    state = locale;
    await _storage.write(key: _kStorageKey, value: locale.name);
  }
}
