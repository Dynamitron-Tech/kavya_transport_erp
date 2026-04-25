import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final fleetDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fleet/drivers', queryParameters: {'limit': 200});
  final payload = res['data'] ?? res;
  if (payload is List) return payload.cast<Map<String, dynamic>>();
  return [];
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class FleetDriverListScreen extends ConsumerStatefulWidget {
  const FleetDriverListScreen({super.key});

  @override
  ConsumerState<FleetDriverListScreen> createState() => _FleetDriverListScreenState();
}

class _FleetDriverListScreenState extends ConsumerState<FleetDriverListScreen> {
  String _filter = 'All';
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  static const _filters = ['All', 'On Trip', 'Available', 'Off Duty'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final driversAsync = ref.watch(fleetDriversProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Text('Drivers', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Column(
        children: [
          // ─── Search Bar ───────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search drivers…',
                hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                prefixIcon: const Icon(Icons.search, color: KTColors.fleetAccent),
                filled: true,
                fillColor: KTColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.fleetAccent),
                ),
              ),
            ),
          ),

          // ─── Filter Chips ─────────────────────────────────────────
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _filters[i];
                final selected = _filter == f;
                return FilterChip(
                  label: Text(f),
                  selected: selected,
                  onSelected: (_) => setState(() => _filter = f),
                  labelStyle: KTTextStyles.label.copyWith(
                    color: selected ? Colors.white : KTColors.textMuted,
                  ),
                  selectedColor: KTColors.fleetAccent,
                  backgroundColor: KTColors.surface,
                  side: BorderSide(
                    color: selected ? KTColors.fleetAccent : KTColors.borderColor,
                  ),
                  showCheckmark: false,
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ─── Driver List ──────────────────────────────────────────
          Expanded(
            child: driversAsync.when(
              loading: () => ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 6,
                itemBuilder: (_, __) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: KTLoadingShimmer(type: ShimmerType.card),
                ),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
                    const SizedBox(height: 12),
                    Text('Failed to load drivers', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 16),
                    KTButton.secondary(
                      onPressed: () => ref.invalidate(fleetDriversProvider),
                      label: 'Retry',
                    ),
                  ],
                ),
              ),
              data: (drivers) {
                final filtered = _applyFilters(drivers);
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_off, color: KTColors.textMuted, size: 64),
                        const SizedBox(height: 16),
                        Text('No Drivers Found', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                        const SizedBox(height: 8),
                        Text('Try adjusting your search or filters.',
                            style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: KTColors.fleetAccent,
                  onRefresh: () async => ref.invalidate(fleetDriversProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _driverCard(context, filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> drivers) {
    var list = drivers;

    if (_searchQuery.isNotEmpty) {
      list = list.where((d) {
        final name = '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'.toLowerCase();
        final vehicle = (d['vehicle_registration'] ?? '').toString().toLowerCase();
        return name.contains(_searchQuery) || vehicle.contains(_searchQuery);
      }).toList();
    }

    if (_filter != 'All') {
      final statusMap = {
        'On Trip': 'on_trip',
        'Available': 'available',
        'Off Duty': 'off_duty',
      };
      final target = statusMap[_filter];
      if (target != null) {
        list = list.where((d) => d['status']?.toString() == target).toList();
      }
    }

    return list;
  }

  Widget _driverCard(BuildContext context, Map<String, dynamic> driver) {
    final firstName = driver['first_name']?.toString() ?? '';
    final lastName = driver['last_name']?.toString() ?? '';
    final name = '$firstName $lastName'.trim();
    final initials = '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();
    final vehicleReg = driver['vehicle_registration']?.toString() ?? 'No vehicle';
    final lastTrip = driver['last_trip_date']?.toString() ?? '';
    final status = driver['status']?.toString() ?? 'available';
    final score = (driver['driver_score'] as num?)?.toInt() ?? 0;
    final driverId = driver['id'];

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'on_trip':
        statusColor = KTColors.info;
        statusLabel = 'On Trip';
        break;
      case 'off_duty':
        statusColor = KTColors.textMuted;
        statusLabel = 'Off Duty';
        break;
      default:
        statusColor = KTColors.success;
        statusLabel = 'Available';
    }

    final scoreColor = score >= 80 ? KTColors.fleetAccent : (score < 60 ? KTColors.danger : KTColors.success);
    final accent = KTColors.getRoleColor('fleet_manager');

    return GestureDetector(
      onTap: () {
        if (driverId != null) context.push('/fleet/driver/$driverId');
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 24,
              backgroundColor: accent.withValues(alpha: 0.2),
              child: Text(
                initials.isNotEmpty ? initials : '?',
                style: KTTextStyles.h3.copyWith(color: accent),
              ),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name.isNotEmpty ? name : 'Driver #$driverId',
                      style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                  const SizedBox(height: 2),
                  Text('$vehicleReg${lastTrip.isNotEmpty ? ' · Last: $lastTrip' : ''}',
                      style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
                ],
              ),
            ),

            // Status + Score
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                KTStatusBadge(label: statusLabel, color: statusColor),
                if (score > 0) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: scoreColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Score: $score',
                      style: KTTextStyles.caption.copyWith(color: scoreColor, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
