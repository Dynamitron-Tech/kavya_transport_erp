import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../providers/admin_providers.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../widgets/admin_shell_screen.dart';

final adminPendingCompletionsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getAdminPendingTripCompletions();
  if (response is Map && response['data'] is List) return response['data'] as List<dynamic>;
  if (response is List) return response;
  return [];
});

class AdminOperationsScreen extends ConsumerWidget {
  const AdminOperationsScreen({super.key});

  static const _statuses = [null, 'planned', 'in_transit', 'completed', 'cancelled'];
  static const _labels = ['All', 'Unassigned', 'In transit', 'Delivered', 'Closed'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(adminDashboardStatsProvider);
    final filter = ref.watch(adminOpsFilterProvider);
    final trips = ref.watch(adminOperationsTripsProvider);
    final pendingCompletions = ref.watch(adminPendingCompletionsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: KTColors.borderColor, width: 1)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.go('/admin/dashboard'),
                  ),
                  Expanded(
                    child: Text('Operations',
                        style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
                  ),
                  const ComplianceBellButton(),
                ],
              ),
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: KTColors.primary,
        onPressed: () {
          showModalBottomSheet(
            context: context,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (_) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: KTColors.borderColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.local_shipping_outlined, color: KTColors.primary),
                  title: const Text('Create Trip'),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/admin/trip/create');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.receipt_long_outlined, color: KTColors.info),
                  title: const Text('Create LR'),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/admin/lr/create');
                  },
                ),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
        child: const Icon(Icons.add_rounded, color: KTColors.white),
      ),
      body: RefreshIndicator(
        color: KTColors.primary,
        onRefresh: () async {
          ref.invalidate(adminDashboardStatsProvider);
          ref.invalidate(adminOperationsTripsProvider);
          ref.invalidate(adminPendingCompletionsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Pending Completions ──
            pendingCompletions.when(
              data: (list) {
                if (list.isEmpty) return const SizedBox.shrink();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('PENDING COMPLETIONS',
                        style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 8),
                    ...list.map<Widget>((item) {
                      final t = item as Map<String, dynamic>;
                      final tripNo = t['trip_number']?.toString() ?? 'TRP-${t['id']}';
                      final driver = '${t['driver_first_name'] ?? ''} ${t['driver_last_name'] ?? ''}'.trim();
                      final vehicle = t['vehicle_registration']?.toString() ?? '—';
                      final completedAt = t['completed_at']?.toString() ?? '—';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: KTColors.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: KTColors.success.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(tripNo,
                                        style: KTTextStyles.label.copyWith(
                                            fontFamily: 'monospace',
                                            color: KTColors.textHeading)),
                                    const SizedBox(height: 2),
                                    if (driver.isNotEmpty)
                                      Text(driver,
                                          style: KTTextStyles.bodySmall.copyWith(
                                              color: KTColors.textBody)),
                                    Text(vehicle,
                                        style: KTTextStyles.caption.copyWith(
                                            color: KTColors.textMuted)),
                                    if (completedAt != '—')
                                      Text('Completed: $completedAt',
                                          style: KTTextStyles.caption.copyWith(
                                              color: KTColors.textMuted)),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () async {
                                  try {
                                    final api = ref.read(apiServiceProvider);
                                    await api.adminApproveTripCompletion(
                                        (t['id'] as num).toInt());
                                    ref.invalidate(adminPendingCompletionsProvider);
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                            content: Text('Trip completion approved'),
                                            backgroundColor: KTColors.success),
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                            content: Text('Failed: $e'),
                                            backgroundColor: KTColors.danger),
                                      );
                                    }
                                  }
                                },
                                style: TextButton.styleFrom(
                                  backgroundColor:
                                      KTColors.success.withValues(alpha: 0.12),
                                  foregroundColor: KTColors.success,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 8),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Approve',
                                    style: TextStyle(
                                        fontSize: 13, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                  ],
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // ── Search bar ──
            Container(
              decoration: BoxDecoration(
                color: KTColors.lightBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.borderColor, width: 1.5),
              ),
              child: TextField(
                style: KTTextStyles.body.copyWith(color: KTColors.textBody),
                decoration: InputDecoration(
                  hintText: 'Search trips…',
                  hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                  prefixIcon: const Icon(Icons.search_rounded,
                      color: KTColors.textMuted, size: 18),
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // ── KPI mini cards ──
            stats.when(
              data: (d) => _buildKPIRow(d),
              loading: () => const SizedBox(height: 70),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 16),

            // ── Filter chips ──
            Text('FILTER BY STATUS',
                style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: List.generate(_statuses.length, (i) {
                final active = filter == _statuses[i];
                return GestureDetector(
                  onTap: () =>
                      ref.read(adminOpsFilterProvider.notifier).state =
                          _statuses[i],
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KTColors.primary : KTColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active ? KTColors.primary : KTColors.borderColor,
                      ),
                    ),
                    child: Text(
                      _labels[i],
                      style: KTTextStyles.caption.copyWith(
                        color: active ? KTColors.white : KTColors.textBody,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),

            // ── Trip list ──
            trips.when(
              data: (list) {
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 60),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.inbox_rounded,
                              size: 48, color: KTColors.borderColor),
                          const SizedBox(height: 12),
                          Text('No trips found',
                              style: KTTextStyles.body.copyWith(
                                  color: KTColors.textMuted)),
                        ],
                      ),
                    ),
                  );
                }
                return Column(
                  children: list.map<Widget>((item) {
                    final t = item as Map<String, dynamic>;
                    final status = (t['status'] as String? ?? '').toLowerCase();
                    final statusColor = switch (status) {
                      'in_transit' => KTColors.info,
                      'completed'  => KTColors.success,
                      'cancelled'  => KTColors.danger,
                      _            => KTColors.warning,
                    };
                    final statusLabel = switch (status) {
                      'in_transit' => 'In Transit',
                      'completed'  => 'Delivered',
                      'cancelled'  => 'Cancelled',
                      'planned'    => 'Planned',
                      _            => status.toUpperCase(),
                    };
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GestureDetector(
                        onTap: () => context.push('/admin/trips/${t['id']}'),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: KTColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: KTColors.borderColor),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      t['trip_number'] as String? ?? 'TRP-${t['id']}',
                                      style: KTTextStyles.label.copyWith(
                                          fontFamily: 'monospace',
                                          color: KTColors.textHeading),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${t['origin_city'] ?? t['from_city'] ?? '—'} → ${t['destination_city'] ?? t['to_city'] ?? '—'}',
                                      style: KTTextStyles.bodySmall.copyWith(
                                          color: KTColors.textBody),
                                    ),
                                    if (t['vehicle_registration'] != null || t['driver_name'] != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Row(
                                          children: [
                                            if (t['vehicle_registration'] != null) ...[
                                              const Icon(Icons.local_shipping_outlined,
                                                  size: 12, color: KTColors.textMuted),
                                              const SizedBox(width: 3),
                                              Text(t['vehicle_registration'] as String,
                                                  style: KTTextStyles.caption.copyWith(
                                                      color: KTColors.textMuted)),
                                              const SizedBox(width: 10),
                                            ],
                                            if (t['driver_name'] != null) ...[
                                              const Icon(Icons.person_outline,
                                                  size: 12, color: KTColors.textMuted),
                                              const SizedBox(width: 3),
                                              Text(t['driver_name'] as String,
                                                  style: KTTextStyles.caption.copyWith(
                                                      color: KTColors.textMuted)),
                                            ],
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(statusLabel,
                                    style: KTTextStyles.caption.copyWith(
                                        color: statusColor,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
              loading: () => const SizedBox(
                  height: 120,
                  child: Center(
                      child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => Text('Error: $e',
                  style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKPIRow(Map<String, dynamic> d) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _miniKPI('${d['active_trips'] ?? 0}', 'Active trips', KTColors.info),
          _miniKPI('${d['pending_assignment'] ?? 0}', 'Unassigned', KTColors.amber500),
          _miniKPI('—', 'Total this month', KTColors.primary),
          _miniKPI('—', 'Awaiting closure', const Color(0xFF7C3AED)),
        ],
      ),
    );
  }

  Widget _miniKPI(String value, String label, Color color) {
    return Container(
      width: 120,
      margin: const EdgeInsets.only(right: 10),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
        boxShadow: const [
          BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 3, color: color),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(9, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(value,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 20,
                            color: Color(0xFF0D1B2A),
                            height: 1.2)),
                    const SizedBox(height: 2),
                    Text(label,
                        style: const TextStyle(
                            fontWeight: FontWeight.w400,
                            fontSize: 11,
                            color: Color(0xFF8494A4),
                            height: 1.4)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
