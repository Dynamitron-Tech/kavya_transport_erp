import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../providers/fleet_dashboard_provider.dart';

class ManagerVehicleDetailScreen extends ConsumerWidget {
  final String vehicleId;
  const ManagerVehicleDetailScreen({super.key, required this.vehicleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleAsync = ref.watch(_vehicleDetailProvider(vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Vehicle Details', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: vehicleAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(_vehicleDetailProvider(vehicleId))),
        data: (v) {
          final status = (v['status'] ?? '').toString();
          Color statusColor;
          switch (status) {
            case 'AVAILABLE':
              statusColor = KTColors.success;
              break;
            case 'ON_TRIP':
              statusColor = KTColors.info;
              break;
            case 'MAINTENANCE':
              statusColor = KTColors.warning;
              break;
            default:
              statusColor = KTColors.textMuted;
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text(v['registration_number'] ?? '-',
                            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                        child: Text(status.replaceAll('_', ' '),
                            style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ]),
                    const SizedBox(height: 16),
                    _row('Make/Model', '${v['make'] ?? '-'} ${v['model'] ?? ''}'),
                    _row('Type', v['vehicle_type'] ?? v['type'] ?? '-'),
                    _row('Capacity', '${v['capacity_tons'] ?? '-'} tons'),
                    _row('Year', '${v['year'] ?? '-'}'),
                    if (v['current_driver'] != null) _row('Current Driver', v['current_driver']['name'] ?? '-'),
                    if (v['current_trip'] != null) ...[
                      const SizedBox(height: 12),
                      Text('Current Trip', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      _row('Route', '${v['current_trip']['origin_city'] ?? '-'} → ${v['current_trip']['destination_city'] ?? '-'}'),
                      _row('Status', v['current_trip']['status'] ?? '-'),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted))),
          Expanded(child: Text(value, style: KTTextStyles.body.copyWith(color: KTColors.textHeading))),
        ],
      ),
    );
  }
}

final _vehicleDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, vehicleId) async {
  final api = ref.watch(apiServiceProvider);
  final resp = await api.get('/vehicles/$vehicleId');
  if (resp is Map && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  return Map<String, dynamic>.from(resp as Map);
});
