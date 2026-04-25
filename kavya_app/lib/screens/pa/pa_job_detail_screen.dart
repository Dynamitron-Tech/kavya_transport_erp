import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

final _jobDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/jobs/$id');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

class PAJobDetailScreen extends ConsumerWidget {
  final int jobId;
  const PAJobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobAsync = ref.watch(_jobDetailProvider(jobId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('Job Detail', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        leading: const BackButton(color: KTColors.textHeading),
      ),
      body: jobAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.card),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_jobDetailProvider(jobId)),
        ),
        data: (job) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header card ───────────────────────────────────────────
              _DetailCard(children: [
                _Row('Job Number', job['job_number'] ?? ''),
                _Row('Status', job['status'] ?? ''),
                _Row('Client', job['client_name'] ?? ''),
                _Row('Vehicle', job['vehicle_reg_number'] ?? '—'),
                _Row('Driver', job['driver_name'] ?? '—'),
              ]),
              const SizedBox(height: 14),

              // ── Route & Cargo ─────────────────────────────────────────
              Text('Route & Cargo', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
              const SizedBox(height: 8),
              _DetailCard(children: [
                _Row('From', job['origin'] ?? ''),
                _Row('To', job['destination'] ?? ''),
                _Row('Weight (kg)', '${job['total_weight_kg'] ?? '—'}'),
                _Row('Freight (₹)', '${job['freight_amount'] ?? '—'}'),
                _Row('Commodity', job['commodity_description'] ?? '—'),
              ]),
              const SizedBox(height: 20),

              // ── Actions ───────────────────────────────────────────────
              if (job['status'] == 'IN_PROGRESS' || job['status'] == 'DOCUMENTATION')
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.receipt_long),
                    label: const Text('Create LR + EWB'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: KTColors.paAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () => context.push('/pa/jobs/$jobId/lr'),
                  ),
                ),
              if (job['trip_id'] != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.upload_file),
                    label: const Text('Upload Documents'),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: KTColors.paAccent),
                      foregroundColor: KTColors.paAccent,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () => context.push('/pa/trips/${job['trip_id']}/docs'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final List<Widget> children;
  const _DetailCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(children: children),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
          Text(value, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading)),
        ],
      ),
    );
  }
}
