import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../providers/manager_providers.dart';
import '../widgets/job_card_widget.dart';

class ManagerJobListScreen extends ConsumerWidget {
  const ManagerJobListScreen({super.key});

  static const _filters = ['all', 'PENDING_APPROVAL', 'DRAFT', 'IN_PROGRESS', 'COMPLETED'];
  static const _filterLabels = ['All', 'Pending', 'Draft', 'In transit', 'Completed'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentFilter = ref.watch(managerJobFilterProvider);
    final jobsAsync = ref.watch(managerJobListProvider);
    final currentStatus = currentFilter.status;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text('Jobs', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: KTColors.managerAccent),
            onPressed: () => context.push('/manager/jobs/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Filter chips ─────────────────────────────
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _filters.length,
              itemBuilder: (_, i) {
                final filterStatus = _filters[i] == 'all' ? null : _filters[i];
                final sel = currentStatus == filterStatus;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(_filterLabels[i]),
                    selected: sel,
                    selectedColor: KTColors.managerAccent,
                    backgroundColor: KTColors.surface,
                    labelStyle: TextStyle(color: sel ? Colors.white : KTColors.textMuted, fontSize: 13),
                    onSelected: (_) => ref.read(managerJobFilterProvider.notifier).state = ManagerJobFilter(status: filterStatus),
                    side: BorderSide.none,
                  ),
                );
              },
            ),
          ),

          // ── Job list ─────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              color: KTColors.managerAccent,
              backgroundColor: KTColors.surface,
              onRefresh: () async => ref.invalidate(managerJobListProvider),
              child: jobsAsync.when(
                loading: () => const KTLoadingShimmer(type: ShimmerType.list),
                error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerJobListProvider)),
                data: (jobs) {
                  if (jobs.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.inbox_outlined, color: KTColors.textMuted, size: 48),
                          const SizedBox(height: 12),
                          Text('No jobs found', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: jobs.length,
                    itemBuilder: (_, i) => JobCardWidget(job: Map<String, dynamic>.from(jobs[i] as Map), useLightTheme: true),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
