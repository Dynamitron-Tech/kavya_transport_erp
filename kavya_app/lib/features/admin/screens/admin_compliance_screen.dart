import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/admin_providers.dart';
import '../widgets/compliance_alert_card.dart';

class AdminComplianceScreen extends ConsumerStatefulWidget {
  const AdminComplianceScreen({super.key});

  @override
  ConsumerState<AdminComplianceScreen> createState() =>
      _AdminComplianceScreenState();
}

class _AdminComplianceScreenState
    extends ConsumerState<AdminComplianceScreen> {
  String? _severityFilter;
  String? _categoryFilter;

  static const _severities = [null, 'CRITICAL', 'URGENT', 'WARNING'];
  static const _sevLabels = ['All', 'Critical', 'Urgent', 'Warning'];
  static const _categories = [null, 'VEHICLE', 'DRIVER', 'GST'];
  static const _catLabels = ['All', 'Vehicle', 'Driver', 'GST'];

  @override
  Widget build(BuildContext context) {
    final alerts = ref.watch(adminComplianceAlertsProvider);

    // Update badge count
    alerts.whenData((list) {
      final count = list
          .where((a) {
            final m = a as Map<String, dynamic>;
            return m['severity'] == 'CRITICAL' || m['severity'] == 'URGENT';
          })
          .length;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(complianceAlertCountProvider.notifier).state = count;
      });
    });

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
                border: Border(bottom: BorderSide(color: KTColors.borderColor)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded,
                        color: KTColors.textHeading, size: 22),
                    onPressed: () => context.pop(),
                  ),
                  Expanded(
                    child: Row(
                      children: [
                        Text('Compliance alerts',
                            style: KTTextStyles.h1
                                .copyWith(color: KTColors.textHeading)),
                        const SizedBox(width: 8),
                        alerts.when(
                          data: (list) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: KTColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text('${list.length}',
                                style: TextStyle(
                                    color: KTColors.primary, fontSize: 12, fontWeight: FontWeight.w700)),
                          ),
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                      ],
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
          ref.invalidate(adminComplianceAlertsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Severity filter ──
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: List.generate(_severities.length, (i) {
                final active = _severityFilter == _severities[i];
                return GestureDetector(
                  onTap: () {
                    setState(() => _severityFilter = _severities[i]);
                    ref.read(adminComplianceSeverityFilter.notifier).state =
                        _severities[i];
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KTColors.amber500 : KTColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active
                            ? KTColors.amber500
                            : KTColors.borderColor,
                      ),
                    ),
                    child: Text(
                      _sevLabels[i],
                      style: KTTextStyles.caption.copyWith(
                        color: active ? KTColors.white : KTColors.textBody,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 6),
            // ── Category filter ──
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: List.generate(_categories.length, (i) {
                final active = _categoryFilter == _categories[i];
                return GestureDetector(
                  onTap: () {
                    setState(() => _categoryFilter = _categories[i]);
                    ref.read(adminComplianceCategoryFilter.notifier).state =
                        _categories[i];
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KTColors.info : KTColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color:
                            active ? KTColors.info : KTColors.borderColor,
                      ),
                    ),
                    child: Text(
                      _catLabels[i],
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

            // ── Alert list ──
            alerts.when(
              data: (list) {
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 60),
                    child: Column(
                      children: [
                        Icon(Icons.check_circle_outline,
                            color: KTColors.primary, size: 48),
                        const SizedBox(height: 12),
                        Text('All compliance up to date',
                            style: KTTextStyles.body
                                .copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }

                // Group by category sections
                final vehicleAlerts = list.where((a) => (a as Map)['entity_type'] == 'VEHICLE').toList();
                final driverAlerts = list.where((a) => (a as Map)['entity_type'] == 'DRIVER').toList();
                final gstAlerts = list.where((a) => (a as Map)['entity_type'] == 'GST').toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (vehicleAlerts.isNotEmpty) ...[
                      _sectionHead('VEHICLE COMPLIANCE'),
                      ...vehicleAlerts.map<Widget>((a) => _alertCard(context, ref, a as Map<String, dynamic>)),
                    ],
                    if (driverAlerts.isNotEmpty) ...[
                      _sectionHead('DRIVER COMPLIANCE'),
                      ...driverAlerts.map<Widget>((a) => _alertCard(context, ref, a as Map<String, dynamic>)),
                    ],
                    if (gstAlerts.isNotEmpty) ...[
                      _sectionHead('GST & FINANCE'),
                      ...gstAlerts.map<Widget>((a) => _alertCard(context, ref, a as Map<String, dynamic>)),
                    ],
                  ],
                );
              },
              loading: () => const SizedBox(
                  height: 120,
                  child: Center(
                      child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => Center(
                  child: Text('Failed to load: $e',
                      style: TextStyle(color: KTColors.danger))),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _sectionHead(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 8),
        child: Text(title,
            style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
      );

  Widget _alertCard(
      BuildContext context, WidgetRef ref, Map<String, dynamic> alert) {
    final cat = alert['category'] as String? ?? '';
    final entityId = alert['entity_id'];

    return ComplianceAlertCard(
      alert: alert,
      onAction: () async {
        if (cat == 'GST') {
          context.push('/accountant/gst');
        } else if (cat == 'DRIVER_LICENSE') {
          // Send reminder — just show snackbar for now
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Reminder sent to driver')),
          );
        } else if (cat.startsWith('VEHICLE_')) {
          // Mark renewed — call compliance update API
          final api = ref.read(apiServiceProvider);
          try {
            await api.patch(
              '/admin/vehicles/$entityId/compliance',
              data: {
                'compliance_type': cat,
                'expiry_date':
                    DateTime.now().add(const Duration(days: 365)).toIso8601String().split('T')[0],
              },
            );
            ref.invalidate(adminComplianceAlertsProvider);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Compliance marked as renewed')),
              );
            }
          } catch (_) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Failed to update')),
              );
            }
          }
        }
      },
      onDetail: () {
        final alertId = alert['id']?.toString();
        if (alertId != null) {
          context.push('/admin/compliance/$alertId');
        } else if (alert['entity_type'] == 'VEHICLE') {
          context.push('/admin/vehicles/$entityId');
        } else if (alert['entity_type'] == 'DRIVER') {
          context.push('/admin/drivers/$entityId');
        }
      },
    );
  }
}
