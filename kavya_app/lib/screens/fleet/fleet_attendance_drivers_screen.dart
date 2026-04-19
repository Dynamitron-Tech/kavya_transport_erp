import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final _attendanceDriversProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/drivers', queryParameters: {'limit': 200});
  final payload = res['data'] ?? res;
  if (payload is List) return payload.cast<Map<String, dynamic>>();
  return [];
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class FleetAttendanceDriversScreen extends ConsumerStatefulWidget {
  const FleetAttendanceDriversScreen({super.key});

  @override
  ConsumerState<FleetAttendanceDriversScreen> createState() =>
      _FleetAttendanceDriversScreenState();
}

class _FleetAttendanceDriversScreenState
    extends ConsumerState<FleetAttendanceDriversScreen> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _statusColor(String? status) {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return KTColors.success;
      case 'ON_TRIP':
        return KTColors.info;
      case 'OFF_DUTY':
        return KTColors.textMuted;
      default:
        return KTColors.textMuted;
    }
  }

  String _statusLabel(String? status) {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'Available';
      case 'ON_TRIP':
        return 'On Trip';
      case 'OFF_DUTY':
        return 'Off Duty';
      default:
        return status ?? 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    final driversAsync = ref.watch(_attendanceDriversProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Driver Attendance',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Column(
        children: [
          // ─── Search ──────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search drivers…',
                hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                prefixIcon: const Icon(Icons.search_rounded, color: KTColors.textMuted),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: KTColors.lightBg,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: KTColors.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: KTColors.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: KTColors.primary, width: 1.5),
                ),
              ),
            ),
          ),

          // ─── List ─────────────────────────────────────────────────
          Expanded(
            child: driversAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KTLoadingShimmer(type: ShimmerType.list),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 48, color: KTColors.danger),
                    const SizedBox(height: 12),
                    Text('Failed to load drivers',
                        style: KTTextStyles.body
                            .copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(_attendanceDriversProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (drivers) {
                final filtered = _searchQuery.isEmpty
                    ? drivers
                    : drivers.where((d) {
                        final name =
                            (d['name'] ?? d['full_name'] ?? '').toString().toLowerCase();
                        final phone = (d['phone'] ?? '').toString();
                        final emp = (d['employee_code'] ?? '').toString().toLowerCase();
                        return name.contains(_searchQuery) ||
                            phone.contains(_searchQuery) ||
                            emp.contains(_searchQuery);
                      }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text('No drivers found',
                        style: KTTextStyles.body
                            .copyWith(color: KTColors.textMuted)),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(_attendanceDriversProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final d = filtered[i];
                      final name = (d['name'] ?? d['full_name'] ?? 'Unknown')
                          .toString();
                      final phone = (d['phone'] ?? '—').toString();
                      final emp = (d['employee_code'] ?? '').toString();
                      final status = d['status']?.toString();
                      final vehicle =
                          (d['vehicle_registration'] ?? '').toString();
                      final initials = name.trim().isNotEmpty
                          ? name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
                          : '?';

                      final driverId = d['id'] as int? ?? 0;

                      return GestureDetector(
                        onTap: () => context.push(
                          '/fleet/attendance/driver/$driverId?name=${Uri.encodeComponent(name)}',
                        ),
                        child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: KTColors.borderColor),
                        ),
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            // Avatar
                            CircleAvatar(
                              radius: 24,
                              backgroundColor:
                                  const Color(0xFF5C6BC0).withOpacity(0.12),
                              child: Text(
                                initials,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF5C6BC0),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name,
                                      style: KTTextStyles.bodyMedium.copyWith(
                                          color: KTColors.textHeading,
                                          fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 2),
                                  Text(phone,
                                      style: KTTextStyles.bodySmall.copyWith(
                                          color: KTColors.textMuted)),
                                  if (emp.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(emp,
                                        style: KTTextStyles.labelSmall.copyWith(
                                            color: KTColors.textMuted)),
                                  ],
                                  if (vehicle.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.directions_car_rounded,
                                            size: 13,
                                            color: KTColors.textMuted),
                                        const SizedBox(width: 4),
                                        Text(vehicle,
                                            style:
                                                KTTextStyles.labelSmall.copyWith(
                                                    color:
                                                        KTColors.textMuted)),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            // Status badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _statusColor(status).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                _statusLabel(status),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: _statusColor(status),
                                ),
                              ),
                            ),
                          ],
                        ),
                        ), // GestureDetector child end
                      ); // GestureDetector end
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
