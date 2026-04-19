import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../providers/admin_providers.dart';

class AdminBranchesScreen extends ConsumerWidget {
  const AdminBranchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(adminBranchesProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: KTColors.surface,
      ),
      child: Scaffold(
        backgroundColor: KTColors.lightBg,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Container(
            color: KTColors.surface,
            child: SafeArea(
              bottom: false,
              child: Container(
                height: 56,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: const BoxDecoration(
                  border: Border(
                      bottom: BorderSide(color: KTColors.borderColor, width: 1)),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded,
                          color: KTColors.textHeading, size: 22),
                      onPressed: () => context.pop(),
                    ),
                    Text('Branches',
                        style: KTTextStyles.h1
                            .copyWith(color: KTColors.textHeading)),
                  ],
                ),
              ),
            ),
          ),
        ),
        body: branches.when(
          data: (list) {
            if (list.isEmpty) {
              return Center(
                child: Text('No branches found',
                    style: KTTextStyles.body
                        .copyWith(color: KTColors.textMuted)),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final b = list[i];
                final name = b['name'] ?? '—';
                final code = b['code'] ?? '';
                final city = b['city'] ?? '';
                final state = b['state'] ?? '';
                final active = b['is_active'] == true;
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 13),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.store_outlined,
                          color: KTColors.textMuted, size: 18),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name,
                                style: KTTextStyles.body.copyWith(
                                    color: KTColors.textHeading,
                                    fontWeight: FontWeight.w500)),
                            if (code.isNotEmpty || city.isNotEmpty)
                              Text(
                                [code, city, state]
                                    .where((s) => s.isNotEmpty)
                                    .join(' · '),
                                style: KTTextStyles.caption
                                    .copyWith(color: KTColors.textMuted),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (active
                                  ? KTColors.success
                                  : KTColors.danger)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          active ? 'Active' : 'Inactive',
                          style: KTTextStyles.labelCaps.copyWith(
                              color: active
                                  ? KTColors.success
                                  : KTColors.danger),
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
          loading: () => const Center(
              child: CircularProgressIndicator(color: KTColors.primary)),
          error: (e, _) => Center(
              child: Text('Error: $e',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted))),
        ),
      ),
    );
  }
}
