import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/vehicles_provider.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);

// ─── Provider for inspection flags ────────────────────────────────────────────
final inspectionFlagsProvider =
    FutureProvider.autoDispose<Set<int>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre/inspection-flags');
  final data = (res is Map) ? (res['data'] ?? res) : res;
  if (data is Map) {
    final ids = data['flagged_vehicle_ids'];
    if (ids is List) {
      return ids.map((e) => e as int).toSet();
    }
  }
  return <int>{};
});

class TyreInspectionsScreen extends ConsumerStatefulWidget {
  const TyreInspectionsScreen({super.key});

  @override
  ConsumerState<TyreInspectionsScreen> createState() =>
      _TyreInspectionsScreenState();
}

class _TyreInspectionsScreenState
    extends ConsumerState<TyreInspectionsScreen> {
  String _query = '';

  String _formatVehicleType(String? raw) {
    if (raw == null || raw.isEmpty) return 'Vehicle';
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  String _formatSizeClass(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    const map = {
      'mini_pickup': 'Mini Pickup',
      'lcv': 'LCV',
      'mcv': 'MCV',
      'hcv': 'HCV',
      'trailer_articulated': 'Trailer / Articulated',
    };
    return map[raw.toLowerCase()] ?? raw.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(vehiclesProvider);
    final flaggedIds = ref.watch(inspectionFlagsProvider).valueOrNull ?? <int>{};

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.borderColor),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search,
                      color: KTColors.textMuted, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      onChanged: (v) =>
                          setState(() => _query = v.toLowerCase()),
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Search vehicle…',
                        hintStyle: KTTextStyles.body.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Vehicle list
          Expanded(
            child: vehiclesAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: _accent),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.wifi_off_rounded,
                        size: 40, color: KTColors.textMuted),
                    const SizedBox(height: 12),
                    Text(
                      'Failed to load vehicles',
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textMuted,
                        decoration: TextDecoration.none,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => ref.invalidate(vehiclesProvider),
                      child: const Text('Retry',
                          style: TextStyle(color: _accent)),
                    ),
                  ],
                ),
              ),
              data: (vehicles) {
                final filtered = _query.isEmpty
                    ? vehicles
                    : vehicles.where((v) {
                        final reg =
                            (v['registration_number'] as String? ?? '')
                                .toLowerCase();
                        final make =
                            (v['make'] as String? ?? '').toLowerCase();
                        final model =
                            (v['model'] as String? ?? '').toLowerCase();
                        return reg.contains(_query) ||
                            make.contains(_query) ||
                            model.contains(_query);
                      }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(
                      _query.isEmpty
                          ? 'No vehicles found'
                          : 'No results for "$_query"',
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textMuted,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  color: _accent,
                  onRefresh: () async {
                      ref.invalidate(vehiclesProvider);
                      ref.invalidate(inspectionFlagsProvider);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final v = filtered[i] as Map<String, dynamic>;
                      final reg =
                          v['registration_number'] as String? ?? '—';
                      final type = _formatVehicleType(
                          v['vehicle_type'] as String?);
                      final sizeClass = _formatSizeClass(
                          v['vehicle_size_class'] as String?);
                      final axle =
                          (v['axle_wheel_type'] as String? ?? '')
                              .toUpperCase();
                      final make = v['make'] as String? ?? '';
                      final model = v['model'] as String? ?? '';
                      final vehicleId = v['id'] as int?;
                      final needsInspection =
                          vehicleId != null && flaggedIds.contains(vehicleId);

                      return _InspectionVehicleCard(
                        reg: reg,
                        type: type,
                        sizeClass: sizeClass,
                        axle: axle,
                        makeModel: [make, model]
                            .where((s) => s.isNotEmpty)
                            .join(' '),
                        needsInspection: needsInspection,
                        onTap: () {
                          if (vehicleId != null) {
                            context.push('/tyre/vehicle/$vehicleId', extra: {
                              'registration_number': reg,
                              'axle_wheel_type':
                                  v['axle_wheel_type'] ?? '',
                              'source': 'inspections',
                            });
                          }
                        },
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

// ─── Vehicle card for inspections ──────────────────────────────────────────────

class _InspectionVehicleCard extends StatelessWidget {
  final String reg;
  final String type;
  final String sizeClass;
  final String axle;
  final String makeModel;
  final bool needsInspection;
  final VoidCallback onTap;

  const _InspectionVehicleCard({
    required this.reg,
    required this.type,
    required this.sizeClass,
    required this.axle,
    required this.makeModel,
    this.needsInspection = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.tire_repair_rounded,
                  color: _accent, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reg,
                    style: KTTextStyles.body.copyWith(
                      color: KTColors.textHeading,
                      fontWeight: FontWeight.w700,
                      decoration: TextDecoration.none,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    type,
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.none,
                    ),
                  ),
                  if (sizeClass.isNotEmpty || axle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (sizeClass.isNotEmpty) _Tag(label: sizeClass),
                        if (sizeClass.isNotEmpty && axle.isNotEmpty)
                          const SizedBox(width: 5),
                        if (axle.isNotEmpty) _Tag(label: axle),
                      ],
                    ),
                  ],
                  if (makeModel.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      makeModel,
                      style: KTTextStyles.labelSmall.copyWith(
                        color: KTColors.textMuted,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (needsInspection)
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                          color: const Color(0xFFDC2626).withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'Needs Inspection',
                      style: TextStyle(
                        color: Color(0xFFDC2626),
                        fontSize: 8,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                Icon(Icons.chevron_right_rounded,
                    color: KTColors.textMuted, size: 22),
                const SizedBox(height: 4),
                Text(
                  'Inspect',
                  style: TextStyle(
                    color: _accent,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  const _Tag({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          color: _accent,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

