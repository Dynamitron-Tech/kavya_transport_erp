import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/notification_bell_widget.dart';
import 'pa_providers.dart';

const _kPaAccent = KTColors.paAccent;

class PAJobListScreen extends ConsumerWidget {
  const PAJobListScreen({super.key});

  static const _filters = [
    ('All', null),
    ('LR Needed', 'IN_PROGRESS'),
    ('LR Created', 'TRIP_CREATED'),
    ('In Transit', 'IN_TRANSIT'),
    ('Completed', 'COMPLETED'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(paJobFilterProvider);
    final jobsAsync = ref.watch(paJobListProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('Jobs', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: const [NotificationBellWidget()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: _filters.map((f) {
                final isActive = filter.status == f.$2;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => ref.read(paJobFilterProvider.notifier).state =
                        PAJobFilter(status: f.$2, page: 1),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding:
                          const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isActive ? _kPaAccent : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isActive ? _kPaAccent : KTColors.borderColor,
                        ),
                      ),
                      child: Text(
                        f.$1,
                        style: TextStyle(
                          color:
                              isActive ? Colors.white : KTColors.textMuted,
                          fontSize: 12,
                          fontWeight:
                              isActive ? FontWeight.w700 : FontWeight.w400,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
      body: jobsAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(paJobListProvider),
        ),
        data: (jobs) {
          if (jobs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.work_off_outlined,
                      size: 52,
                      color: KTColors.textMuted.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text('No jobs found',
                      style: KTTextStyles.body
                          .copyWith(color: KTColors.textMuted)),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: _kPaAccent,
            backgroundColor: KTColors.surface,
            onRefresh: () async => ref.invalidate(paJobListProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              itemCount: jobs.length,
              itemBuilder: (context, i) {
                final job = Map<String, dynamic>.from(jobs[i] as Map);
                return _JobCard(job: job);
              },
            ),
          );
        },
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  final Map<String, dynamic> job;
  const _JobCard({required this.job});

  Color _statusColor(String? s) {
    switch (s) {
      case 'IN_PROGRESS': return KTColors.warning;
      case 'TRIP_CREATED': return KTColors.info;
      case 'IN_TRANSIT': return KTColors.success;
      case 'COMPLETED': return const Color(0xFF64748B);
      default: return KTColors.textMuted;
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'IN_PROGRESS': return 'Vehicle Assigned';
      case 'TRIP_CREATED': return 'LR Created';
      case 'IN_TRANSIT': return 'In Transit';
      case 'COMPLETED': return 'Completed';
      case 'DRAFT': return 'Draft';
      default: return s ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = job['status'] as String?;
    final jobId = job['id'];
    final color = _statusColor(status);

    return GestureDetector(
      onTap: () => context.push('/pa/jobs/$jobId'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
            // Left color rail
            Container(
              width: 5,
              decoration: BoxDecoration(
                color: color,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                ),
              ),
            ),
              // Content
              Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          job['job_number'] ?? 'JOB-???',
                          style: KTTextStyles.mono.copyWith(
                              color: color, fontWeight: FontWeight.bold),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _statusLabel(status),
                            style: TextStyle(
                                color: color,
                                fontSize: 10,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      (job['client_name'] as String?) ?? '',
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Row(children: [
                      Expanded(
                        child: Row(children: [
                          const Icon(Icons.location_on_outlined,
                              size: 12, color: KTColors.textMuted),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              job['origin_city'] ?? '',
                              style: KTTextStyles.caption.copyWith(
                                  color: KTColors.textMuted),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ]),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6),
                        child: Icon(Icons.arrow_forward,
                            size: 12, color: KTColors.textMuted),
                      ),
                      Expanded(
                        child: Text(
                          job['destination_city'] ?? '',
                          style: KTTextStyles.caption.copyWith(
                              color: KTColors.textMuted),
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ]),
                    if (status == 'VEHICLE_ASSIGNED' ||
                        status == 'IN_PROGRESS') ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () =>
                              context.push('/pa/jobs/$jobId/lr'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kPaAccent,
                            foregroundColor: Colors.white,
                            padding:
                                const EdgeInsets.symmetric(vertical: 8),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          icon: const Icon(Icons.add_circle_outline,
                              size: 16),
                          label: const Text('Create LR + EWB',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}


