import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../providers/admin_providers.dart';
import '../widgets/admin_shell_screen.dart';
import '../widgets/role_health_tile.dart';
import '../widgets/quick_action_tile.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(adminDashboardStatsProvider);
    final roleHealth = ref.watch(adminRoleHealthProvider);
    final today = DateFormat('dd MMM yyyy').format(DateTime.now());

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                color: KTColors.surface,
                border: Border(bottom: BorderSide(color: KTColors.borderColor, width: 1)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Kavya Transports',
                            style: KTTextStyles.h1.copyWith(
                              color: KTColors.textHeading,
                              fontSize: 17,
                            )),
                        Text('Admin · $today',
                            style: KTTextStyles.caption.copyWith(
                              color: KTColors.textMuted,
                            )),
                      ],
                    ),
                  ),
                  const ComplianceBellButton(),
                  const SizedBox(width: 4),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: KTColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text('AD',
                          style: KTTextStyles.labelCaps.copyWith(
                            color: KTColors.white,
                            letterSpacing: 0.5,
                          )),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: KTColors.primary,
        onRefresh: () async {
          ref.invalidate(adminDashboardStatsProvider);
          ref.invalidate(adminRoleHealthProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── KPI Grid 2×2 ──
            stats.when(
              data: (d) => _buildKPIGrid(context, d, ref),
              loading: () => const SizedBox(
                  height: 120,
                  child: Center(
                      child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => _kpiErrorFallback(ref, e),
            ),

            const SizedBox(height: 16),

            // ── Alert banner ──
            stats.when(
              data: (d) {
                final alerts = d['compliance_alerts'] as int? ?? 0;
                if (alerts == 0) return const SizedBox.shrink();
                return GestureDetector(
                  onTap: () => context.push('/admin/compliance'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: KTColors.dangerBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: KTColors.danger, width: 1),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: KTColors.danger, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '$alerts compliance alert${alerts > 1 ? 's' : ''} — action needed',
                            style: KTTextStyles.body.copyWith(color: KTColors.danger),
                          ),
                        ),
                        const Icon(Icons.chevron_right,
                            color: KTColors.danger, size: 18),
                      ],
                    ),
                  ),
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // ── Role Health section header ──
            _sectionHeader(context, 'ROLE HEALTH STATUS'),
            const SizedBox(height: 10),
            roleHealth.when(
              data: (list) {
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text('No role data available',
                        style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                  );
                }
                return Column(
                  children: list.map<Widget>((r) {
                    final m = r as Map<String, dynamic>;
                    return RoleHealthTile(
                      role: m['role'] as String? ?? '',
                      label: m['label'] as String? ?? '',
                      detailText: m['detail_text'] as String? ?? '',
                      statusLabel: m['status_label'] as String? ?? 'Active',
                      statusColor: _statusColor(m['status_label'] as String?),
                    );
                  }).toList(),
                );
              },
              loading: () => const SizedBox(
                  height: 80,
                  child: Center(
                      child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => GestureDetector(
                onTap: () => ref.invalidate(adminRoleHealthProvider),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Column(children: [
                    Text('Could not load role data',
                        style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 4),
                    Text('Tap to retry',
                        style: KTTextStyles.caption.copyWith(color: KTColors.primary)),
                  ]),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── Quick Actions section header ──
            _sectionHeader(context, 'QUICK ACTIONS'),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.75,
              children: [
                QuickActionTile(
                    color: KTColors.info,
                    label: 'Create LR',
                    icon: Icons.receipt_long_outlined,
                    onTap: () => context.push('/admin/lr/create')),
                QuickActionTile(
                    color: KTColors.primary,
                    label: 'New Trip',
                    icon: Icons.local_shipping_outlined,
                    onTap: () => context.push('/admin/trip/create')),
                QuickActionTile(
                    color: KTColors.primaryDark,
                    label: 'Upload Doc',
                    icon: Icons.cloud_upload_outlined,
                    onTap: () => context.push('/admin/upload-doc')),
                QuickActionTile(
                    color: const Color(0xFF6366F1),
                    label: 'EWB',
                    icon: Icons.qr_code_outlined,
                    onTap: () => context.push('/admin/ewb')),
                QuickActionTile(
                    color: KTColors.gray500,
                    label: 'Add User',
                    icon: Icons.person_add_outlined,
                    onTap: () => context.push('/admin/employees/create')),
                QuickActionTile(
                    color: KTColors.danger,
                    label: 'Finance',
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: () => context.go('/admin/finance')),
                QuickActionTile(
                    color: const Color(0xFF0EA5E9),
                    label: 'Live Map',
                    icon: Icons.map_outlined,
                    onTap: () => context.push('/fleet/map')),
                QuickActionTile(
                    color: KTColors.amber500,
                    label: 'Reports',
                    icon: Icons.bar_chart_rounded,
                    onTap: () => context.push('/admin/reports')),
              ],
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Row(
      children: [
        Text(title.toUpperCase(),
            style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
      ],
    );
  }

  Widget _buildKPIGrid(
      BuildContext context, Map<String, dynamic> d, WidgetRef ref) {
    final alertCount = d['compliance_alerts'] as int? ?? 0;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(complianceAlertCountProvider.notifier).state = alertCount;
    });

    return Column(
      children: [
        Row(
          children: [
            _kpi(context, '${d['active_trips'] ?? 0}', 'Active trips',
                KTColors.info, () => context.go('/admin/operations')),
            const SizedBox(width: 12),
            _kpi(context, _fmtCurrency(d['month_revenue']), 'Month revenue',
                KTColors.primary, () => context.go('/admin/finance')),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _kpi(context, '${d['compliance_alerts'] ?? 0}',
                'Compliance alerts', KTColors.danger,
                () => context.push('/admin/compliance')),
            const SizedBox(width: 12),
            _kpi(context, '${d['active_employees'] ?? 0}',
                'Active employees', KTColors.amber500,
                () => context.go('/admin/employees')),
          ],
        ),
      ],
    );
  }

  Widget _kpi(BuildContext context, String value, String label, Color color,
      VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: KTColors.borderColor),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 8,
                  offset: Offset(0, 2)),
            ],
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(width: 3, color: color),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(value,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 22,
                                color: Color(0xFF0D1B2A),
                                height: 1.2)),
                        const SizedBox(height: 4),
                        Text(label,
                            style: const TextStyle(
                                fontWeight: FontWeight.w400,
                                fontSize: 12,
                                color: Color(0xFF8494A4),
                                height: 1.4)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _statusColor(String? label) {
    switch (label?.toLowerCase()) {
      case 'active':
        return KTColors.success;
      case 'busy':
        return KTColors.amber500;
      case 'overdue':
        return KTColors.danger;
      default:
        return KTColors.info;
    }
  }

  Widget _kpiErrorFallback(WidgetRef ref, Object error) {
    return GestureDetector(
      onTap: () => ref.invalidate(adminDashboardStatsProvider),
      child: Column(
        children: [
          Row(children: [
            _greyKpi('—', 'Active trips'),
            const SizedBox(width: 12),
            _greyKpi('—', 'Month revenue'),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            _greyKpi('—', 'Compliance alerts'),
            const SizedBox(width: 12),
            _greyKpi('—', 'Active employees'),
          ]),
          const SizedBox(height: 6),
          Text('Could not load stats · Tap to retry',
              style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
        ],
      ),
    );
  }

  Widget _greyKpi(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 22,
                    color: Color(0xFF3A4A5C),
                    height: 1.2)),
            const SizedBox(height: 4),
            Text(label,
                style: const TextStyle(
                    fontWeight: FontWeight.w400,
                    fontSize: 12,
                    color: Color(0xFF8494A4),
                    height: 1.4)),
          ],
        ),
      ),
    );
  }

  String _fmtCurrency(dynamic val) {
    final v = (val is num) ? val.toDouble() : 0.0;
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(0)}K';
    return '₹${v.toStringAsFixed(0)}';
  }
}

