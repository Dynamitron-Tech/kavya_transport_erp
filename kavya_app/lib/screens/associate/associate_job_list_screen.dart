import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../providers/jobs_provider.dart';

class AssociateJobListScreen extends ConsumerStatefulWidget {
  const AssociateJobListScreen({super.key});

  @override
  ConsumerState<AssociateJobListScreen> createState() => _AssociateJobListScreenState();
}

class _AssociateJobListScreenState extends ConsumerState<AssociateJobListScreen> {
  String _selectedFilter = 'All'; // [cite: 89]
  final List<String> _filters = ['All', 'Needs LR', 'In Progress', 'Completed']; // 

  @override
  Widget build(BuildContext context) {
    // Watch the filtered provider
    final jobsState = ref.watch(jobsProvider); // [cite: 50, 89]

    return Scaffold(
      appBar: AppBar(title: const Text("Jobs")),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _filters.map((f) => Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: FilterChip(
                  label: Text(f),
                  selected: _selectedFilter == f,
                  onSelected: (val) {
                    setState(() => _selectedFilter = f);
                    // Update provider filter params
                    String? statusFilter;
                    bool? noLrFilter;
                    if (f == 'Needs LR') noLrFilter = true;
                    if (f == 'In Progress') statusFilter = 'in_progress';
                    if (f == 'Completed') statusFilter = 'completed';
                    
                    ref.read(jobsFilterProvider.notifier).state = JobsFilter(status: statusFilter, noLr: noLrFilter);
                  },
                ),
              )).toList(),
            ),
          ),
          
          Expanded(
            child: jobsState.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list), // [cite: 109-110]
              error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(jobsProvider)), // [cite: 111-113]
              data: (jobs) {
                if (jobs.isEmpty) return const KTEmptyState(title: "No jobs found", subtitle: "Try adjusting your filters.", lottieAsset: 'assets/lottie/empty_box.json'); // [cite: 114-115]

                return RefreshIndicator(
                  color: KTColors.primary,
                  onRefresh: () async => ref.invalidate(jobsProvider), // [cite: 118]
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: jobs.length,
                    itemBuilder: (context, index) {
                      final job = jobs[index];
                      // Dummy mappings
                      final jobNo = job['job_number'] ?? 'KT-2026-0089';
                      final client = job['client_name'] ?? 'Acme Corp';
                      final route = job['route'] ?? 'Chennai → Coimbatore';
                      final vehicle = job['vehicle_number'] ?? 'TN01AB1234';
                      final status = job['status'] ?? 'vehicle_assigned';
                      final hasLr = job['has_lr'] ?? false;
                      final dateStr = job['created_at'] ?? DateTime.now().toIso8601String();
                      final dateFormatted = DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr));

                      // (visible only if status = vehicle_assigned and no LR exists) [cite: 90]
                      final showCreateLrBtn = status == 'vehicle_assigned' && !hasLr;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(jobNo, style: KTTextStyles.mono.copyWith(fontWeight: FontWeight.bold)), // [cite: 90]
                                  KTStatusBadge(label: status.replaceAll('_', ' '), color: KTColors.info), // [cite: 90]
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text("$client ($route)", style: KTTextStyles.h3), // [cite: 90]
                              const SizedBox(height: 4),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text("Vehicle: $vehicle", style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[700])), // [cite: 90]
                                  Text(dateFormatted, style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])), // [cite: 90]
                                ],
                              ),
                              if (showCreateLrBtn) ...[
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: () => context.push('/associate/lr/create?job_id=${job['id'] ?? 1}'),
                                  icon: const Icon(Icons.receipt),
                                  label: const Text("Create LR"), // [cite: 90]
                                )
                              ]
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}