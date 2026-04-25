import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/manager_providers.dart';
import '../widgets/vehicle_tile_widget.dart';
import '../widgets/driver_tile_widget.dart';

class ManagerAssignScreen extends ConsumerStatefulWidget {
  final String jobId;
  const ManagerAssignScreen({super.key, required this.jobId});

  @override
  ConsumerState<ManagerAssignScreen> createState() => _ManagerAssignScreenState();
}

class _ManagerAssignScreenState extends ConsumerState<ManagerAssignScreen> {
  String? _selectedVehicleId;
  String? _selectedDriverId;
  bool _submitting = false;

  Future<void> _confirmAssignment() async {
    if (_selectedVehicleId == null || _selectedDriverId == null) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.put('/jobs/${widget.jobId}/assign', data: {
        'vehicle_id': _selectedVehicleId,
        'driver_id': _selectedDriverId,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vehicle & driver assigned successfully'), backgroundColor: KTColors.success),
        );
        ref.invalidate(managerJobListProvider);
        ref.invalidate(managerUnassignedJobsProvider);
        ref.invalidate(managerDashboardStatsProvider);
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assignment failed. Please try again.'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(managerAvailableVehiclesProvider);
    final driversAsync = ref.watch(managerAvailableDriversProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Assign Vehicle & Driver', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: (_selectedVehicleId != null && _selectedDriverId != null && !_submitting)
                ? _confirmAssignment
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.managerAccent,
              foregroundColor: Colors.white,
              disabledBackgroundColor: KTColors.surface,
              disabledForegroundColor: KTColors.textMuted,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Confirm Assignment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Select Vehicle ───────────────────────
          Text("SELECT VEHICLE", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
          const SizedBox(height: 12),
          vehiclesAsync.when(
            loading: () => const KTLoadingShimmer(type: ShimmerType.list),
            error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerAvailableVehiclesProvider)),
            data: (vehicles) {
              if (vehicles.isEmpty) {
                return Center(child: Text('No available vehicles', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)));
              }
              return Column(
                children: vehicles.map<Widget>((v) {
                  final m = Map<String, dynamic>.from(v as Map);
                  final id = m['id']?.toString();
                  return VehicleTileWidget(
                    vehicle: m,
                    isSelected: id == _selectedVehicleId,
                    onTap: () => setState(() => _selectedVehicleId = id),
                  );
                }).toList(),
              );
            },
          ),
          const SizedBox(height: 24),

          // ── Select Driver ────────────────────────
          Text("SELECT DRIVER", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 1)),
          const SizedBox(height: 12),
          driversAsync.when(
            loading: () => const KTLoadingShimmer(type: ShimmerType.list),
            error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerAvailableDriversProvider)),
            data: (drivers) {
              if (drivers.isEmpty) {
                return Center(child: Text('No available drivers', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)));
              }
              return Column(
                children: drivers.map<Widget>((d) {
                  final m = Map<String, dynamic>.from(d as Map);
                  final id = m['id']?.toString();
                  return DriverTileWidget(
                    driver: m,
                    isSelected: id == _selectedDriverId,
                    onTap: () => setState(() => _selectedDriverId = id),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}
