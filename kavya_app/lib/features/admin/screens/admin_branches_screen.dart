import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../providers/admin_providers.dart';

class AdminBranchesScreen extends ConsumerWidget {
  const AdminBranchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(adminBranchesProvider);

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Branches',
            style: TextStyle(color: KTColors.darkTextPrimary)),
      ),
      body: branches.when(
        data: (list) {
          if (list.isEmpty) {
            return const Center(
                child: Text('No branches found',
                    style: TextStyle(color: KTColors.darkTextSecondary)));
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
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: KTColors.darkSurface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: KTColors.info.withAlpha(25),
                      child: const Icon(Icons.store_outlined,
                          color: KTColors.info, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: KTColors.darkTextPrimary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14)),
                          if (code.isNotEmpty || city.isNotEmpty)
                            Text(
                              [code, city, state]
                                  .where((s) => s.isNotEmpty)
                                  .join(' · '),
                              style: const TextStyle(
                                  color: KTColors.darkTextSecondary,
                                  fontSize: 12),
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: (active ? KTColors.success : KTColors.danger)
                            .withAlpha(25),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(active ? 'Active' : 'Inactive',
                          style: TextStyle(
                              color: active
                                  ? KTColors.success
                                  : KTColors.danger,
                              fontSize: 11)),
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(
            child:
                CircularProgressIndicator(color: KTColors.amber600)),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style:
                    const TextStyle(color: KTColors.darkTextSecondary))),
      ),
    );
  }
}
