import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../providers/manager_providers.dart';
import '../widgets/vehicle_tile_widget.dart';

class ManagerFleetScreen extends ConsumerWidget {
  const ManagerFleetScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(managerFleetSummaryProvider);
    final vehiclesAsync = ref.watch(managerVehicleListProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text('Fleet', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: RefreshIndicator(
        color: KTColors.managerAccent,
        backgroundColor: KTColors.surface,
        onRefresh: () async {
          ref.invalidate(managerFleetSummaryProvider);
          ref.invalidate(managerVehicleListProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // ── Status Counters ────────────────────
            summaryAsync.when(
              loading: () => const SizedBox(height: 80, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
              error: (e, _) => const SizedBox.shrink(),
              data: (summary) => Row(
                children: [
                  _counter('Available', summary['available'] ?? 0, KTColors.success),
                  const SizedBox(width: 8),
                  _counter('On Trip', summary['on_trip'] ?? 0, KTColors.info),
                  const SizedBox(width: 8),
                  _counter('Maintenance', summary['maintenance'] ?? 0, KTColors.warning),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Map placeholder ────────────────────
            Container(
              height: 180,
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.map_outlined, color: KTColors.textMuted, size: 40),
                    const SizedBox(height: 8),
                    Text('Fleet map coming soon', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Vehicle List ───────────────────────
            Text("VEHICLES", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(height: 12),
            vehiclesAsync.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.list),
              error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerVehicleListProvider)),
              data: (vehicles) {
                if (vehicles.isEmpty) {
                  return Center(child: Text('No vehicles', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)));
                }
                return Column(
                  children: vehicles.map<Widget>((v) {
                    final m = Map<String, dynamic>.from(v as Map);
                    return VehicleTileWidget(
                      vehicle: m,
                      isSelected: false,
                      onTap: () => context.push('/manager/fleet/${m['id']}'),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _counter(String label, dynamic count, Color color) {
    return Expanded(
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Container(height: 3, color: color),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  Text('$count', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                  const SizedBox(height: 4),
                  Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
