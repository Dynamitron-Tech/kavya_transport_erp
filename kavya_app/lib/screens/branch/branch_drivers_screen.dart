import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final branchDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>(
  (ref) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/drivers/');
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    return [];
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class BranchDriversScreen extends ConsumerStatefulWidget {
  const BranchDriversScreen({super.key});

  @override
  ConsumerState<BranchDriversScreen> createState() => _BranchDriversScreenState();
}

class _BranchDriversScreenState extends ConsumerState<BranchDriversScreen> {
  final _search = TextEditingController();
  String _statusFilter = 'all';
  final _statusOptions = ['all', 'on_trip', 'available', 'off_duty'];
  final _statusLabels = ['All', 'On Trip', 'Available', 'Off Duty'];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final driversAsync = ref.watch(branchDriversProvider);

    return Column(
      children: [
        // ─── Search ──────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            style: KTTextStyles.body.copyWith(color: KTColors.darkTextPrimary),
            decoration: InputDecoration(
              hintText: 'Search drivers…',
              hintStyle: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary),
              prefixIcon: const Icon(Icons.search, color: KTColors.darkTextSecondary),
              filled: true,
              fillColor: KTColors.navy800,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
        // ─── Filter chips ─────────────────────────────────────────
        SizedBox(
          height: 44,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            itemCount: _statusOptions.length,
            itemBuilder: (_, i) {
              final opt = _statusOptions[i];
              final sel = _statusFilter == opt;
              return GestureDetector(
                onTap: () => setState(() => _statusFilter = opt),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: sel ? KTColors.navy700 : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: sel ? KTColors.amber500 : KTColors.navy700),
                  ),
                  child: Text(
                    _statusLabels[i],
                    style: KTTextStyles.label.copyWith(
                      color: sel ? KTColors.amber500 : KTColors.darkTextSecondary,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        // ─── Driver list ──────────────────────────────────────────
        Expanded(
          child: driversAsync.when(
            loading: () => ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: 5,
              itemBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KTLoadingShimmer(type: ShimmerType.card),
              ),
            ),
            error: (e, _) => Center(
              child: Text('Failed to load: $e',
                  style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            ),
            data: (drivers) {
              final q = _search.text.toLowerCase();
              final filtered = drivers.where((d) {
                final name = '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'.toLowerCase();
                final status = d['status']?.toString() ?? 'available';
                final matchSearch = q.isEmpty || name.contains(q);
                final matchStatus = _statusFilter == 'all' || status == _statusFilter;
                return matchSearch && matchStatus;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text('No drivers found', style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary)),
                );
              }

              return RefreshIndicator(
                color: KTColors.amber500,
                onRefresh: () async => ref.invalidate(branchDriversProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _driverCard(filtered[i]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _driverCard(Map<String, dynamic> driver) {
    final firstName = driver['first_name']?.toString() ?? '';
    final lastName = driver['last_name']?.toString() ?? '';
    final name = '$firstName $lastName'.trim();
    final initials = '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();
    final status = driver['status']?.toString() ?? 'available';
    final vehicle = driver['vehicle_registration']?.toString() ?? 'Unassigned';
    final score = driver['performance_score'];

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'on_trip': statusColor = KTColors.info; statusLabel = 'On Trip'; break;
      case 'available': statusColor = KTColors.success; statusLabel = 'Available'; break;
      case 'off_duty': statusColor = KTColors.darkTextSecondary; statusLabel = 'Off Duty'; break;
      default: statusColor = KTColors.darkTextSecondary; statusLabel = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: KTColors.navy800,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.navy700),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: KTColors.navy700,
            radius: 22,
            child: Text(initials, style: KTTextStyles.label.copyWith(color: KTColors.success)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: KTTextStyles.bodyMedium.copyWith(color: KTColors.darkTextPrimary)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.local_shipping_outlined, size: 12, color: KTColors.darkTextSecondary),
                    const SizedBox(width: 4),
                    Text(vehicle, style: KTTextStyles.caption.copyWith(color: KTColors.darkTextSecondary)),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              KTStatusBadge(label: statusLabel, color: statusColor),
              if (score != null) ...[
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: KTColors.navy700,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '$score%',
                    style: KTTextStyles.mono.copyWith(
                      color: score >= 80 ? KTColors.amber500 : KTColors.danger,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
