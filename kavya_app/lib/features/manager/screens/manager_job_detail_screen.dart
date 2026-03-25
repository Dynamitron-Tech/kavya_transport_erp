import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../providers/fleet_dashboard_provider.dart';

class ManagerJobDetailScreen extends ConsumerWidget {
  final String jobId;
  const ManagerJobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobAsync = ref.watch(_jobDetailProvider(jobId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Job Details', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: jobAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(_jobDetailProvider(jobId))),
        data: (job) {
          final status = (job['status'] ?? '').toString();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Header ─────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(job['job_number'] ?? '#${job['id']}',
                              style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                        ),
                        _StatusPill(status: status),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _infoRow(Icons.business, 'Client', job['client']?['name'] ?? job['client_id']?.toString() ?? '-'),
                    _infoRow(Icons.location_on, 'Route', '${job['origin_city'] ?? '-'} → ${job['destination_city'] ?? '-'}'),
                    _infoRow(Icons.scale, 'Weight', '${job['quantity'] ?? '-'} tons'),
                    _infoRow(Icons.local_shipping, 'Vehicle type', job['vehicle_type_required'] ?? '-'),
                    _infoRow(Icons.currency_rupee, 'Freight', '₹${job['total_amount'] ?? 0}'),
                    _infoRow(Icons.calendar_today, 'Pickup', job['pickup_date'] ?? '-'),
                    _infoRow(Icons.payment, 'Payment terms', job['payment_terms'] ?? '-'),
                    if ((job['notes'] ?? '').toString().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('Notes', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                      const SizedBox(height: 4),
                      Text(job['notes'].toString(), style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Vehicle/Driver Assignment ──────────
              if (job['vehicle'] != null || job['driver'] != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Assignment', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 10),
                      if (job['vehicle'] != null)
                        _infoRow(Icons.local_shipping, 'Vehicle', job['vehicle']['registration_number'] ?? '-'),
                      if (job['driver'] != null)
                        _infoRow(Icons.person, 'Driver', job['driver']['name'] ?? '-'),
                    ],
                  ),
                ),
              const SizedBox(height: 24),

              // ── Action Buttons ─────────────────────
              if (status == 'PENDING_APPROVAL' || status == 'DRAFT' || status == 'APPROVED')
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => context.push('/manager/jobs/$jobId/assign'),
                    icon: const Icon(Icons.assignment_ind),
                    label: const Text('Assign Vehicle & Driver'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: KTColors.managerAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: KTColors.textMuted),
          const SizedBox(width: 8),
          Text('$label: ', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
          Expanded(child: Text(value, style: KTTextStyles.body.copyWith(color: KTColors.textHeading))),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status) {
      case 'DELIVERED':
      case 'COMPLETED':
        color = KTColors.success;
        break;
      case 'IN_PROGRESS':
      case 'IN_TRANSIT':
        color = KTColors.info;
        break;
      case 'PENDING_APPROVAL':
      case 'DRAFT':
        color = KTColors.warning;
        break;
      case 'CANCELLED':
        color = KTColors.danger;
        break;
      default:
        color = KTColors.textMuted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
      child: Text(status.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

final _jobDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, jobId) async {
  final api = ref.watch(apiServiceProvider);
  final resp = await api.get('/jobs/$jobId');
  if (resp is Map && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  return Map<String, dynamic>.from(resp as Map);
});
