import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/localization/driver_strings.dart';
import '../../core/localization/locale_provider.dart';

class LanguageSettingsScreen extends ConsumerWidget {
  const LanguageSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider);
    final s = ref.watch(sProvider);

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        title: Text(s.languageSettings,
            style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(s.choosePreferredLanguage,
                style: KTTextStyles.body
                    .copyWith(color: KTColors.darkTextSecondary)),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.separated(
                itemCount: AppLocale.values.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final locale = AppLocale.values[i];
                  final isSelected = locale == current;
                  return _LocaleTile(
                    locale: locale,
                    isSelected: isSelected,
                    onTap: () async {
                      await ref.read(localeProvider.notifier).setLocale(locale);
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(
                            content: Text(
                                '${S(locale).languageChanged} — ${localeLabels[locale]}'),
                            backgroundColor: KTColors.success,
                            duration: const Duration(seconds: 1),
                          ),
                        );
                      }
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocaleTile extends StatelessWidget {
  final AppLocale locale;
  final bool isSelected;
  final VoidCallback onTap;

  const _LocaleTile({
    required this.locale,
    required this.isSelected,
    required this.onTap,
  });

  static const _flags = {
    AppLocale.en: '🇬🇧',
    AppLocale.ta: '🇮🇳',
    AppLocale.hi: '🇮🇳',
    AppLocale.kn: '🇮🇳',
    AppLocale.te: '🇮🇳',
    AppLocale.ml: '🇮🇳',
  };

  static const _englishNames = {
    AppLocale.en: 'English',
    AppLocale.ta: 'Tamil',
    AppLocale.hi: 'Hindi',
    AppLocale.kn: 'Kannada',
    AppLocale.te: 'Telugu',
    AppLocale.ml: 'Malayalam',
  };

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected
          ? KTColors.primary.withValues(alpha: 0.12)
          : KTColors.darkSurface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? KTColors.primary : KTColors.darkBorder,
              width: isSelected ? 1.6 : 1,
            ),
          ),
          child: Row(
            children: [
              Text(_flags[locale] ?? '🌐', style: const TextStyle(fontSize: 28)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localeLabels[locale] ?? locale.name,
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.darkTextPrimary,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    Text(
                      _englishNames[locale] ?? '',
                      style: KTTextStyles.caption
                          .copyWith(color: KTColors.darkTextSecondary),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(Icons.check_circle, color: KTColors.primary, size: 24),
            ],
          ),
        ),
      ),
    );
  }
}
