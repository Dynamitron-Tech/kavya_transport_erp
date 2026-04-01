import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/admin_providers.dart';

final _employeeDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, userId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/users/$userId');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

class AdminEmployeeDetailScreen extends ConsumerWidget {
  final String userId;
  const AdminEmployeeDetailScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_employeeDetailProvider(userId));

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
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Text('Employee',
                        style: TextStyle(color: KTColors.textHeading, fontSize: 17, fontWeight: FontWeight.w600)),
                  ),
                  detail.whenOrNull(
                    data: (d) {
                      final isActive = d['is_active'] == true;
                      return Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: (isActive ? KTColors.success : KTColors.danger).withAlpha(20),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isActive ? 'Active' : 'Inactive',
                            style: TextStyle(
                              color: isActive ? KTColors.success : KTColors.danger,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      );
                    },
                  ) ?? const SizedBox.shrink(),
                ],
              ),
            ),
          ),
        ),
      ),
      body: detail.when(
        data: (d) {
          if (d.isEmpty) {
            return const Center(
                child: Text('Employee not found',
                    style: TextStyle(color: KTColors.textMuted)));
          }
          return _buildBody(context, ref, d);
        },
        loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.primary)),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style:
                    const TextStyle(color: KTColors.textMuted))),
      ),
    );
  }

  Widget _buildBody(
      BuildContext context, WidgetRef ref, Map<String, dynamic> d) {
    final name =
        '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'.trim();
    final role = d['role'] as String? ?? d['primary_role'] as String? ?? '—';
    final email = d['email'] as String? ?? '—';
    final phone = d['phone'] as String? ?? '—';
    final isActive = d['is_active'] == true;
    final branch = d['branch_name'] as String? ?? d['branch'] as String? ?? '—';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Profile card ──
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: KTColors.info.withAlpha(30),
                child: Text(
                  name.isNotEmpty
                      ? name.substring(0, name.length.clamp(0, 2)).toUpperCase()
                      : '?',
                  style: const TextStyle(
                      color: KTColors.info,
                      fontWeight: FontWeight.bold,
                      fontSize: 22),
                ),
              ),
              const SizedBox(height: 12),
              Text(name,
                  style: const TextStyle(
                      color: KTColors.textHeading,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(role,
                  style: const TextStyle(
                      color: KTColors.textMuted, fontSize: 13)),
              const SizedBox(height: 12),
              _infoRow(Icons.email_outlined, email),
              _infoRow(Icons.phone_outlined, phone),
              _infoRow(Icons.business_outlined, branch),
              if (d['last_login'] != null) ...[                const SizedBox(height: 4),
                _infoRow(Icons.access_time, 'Last login: ${_fmtDate(d['last_login'])}'),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Activity Stats ──
        _buildActivityStats(d, role),
        const SizedBox(height: 16),

        // ── Actions ──
        _actionBtn('Edit role', Icons.admin_panel_settings, KTColors.amber600, () {
          _showEditRole(context, ref, d, role);
        }),
        const SizedBox(height: 10),
        _actionBtn('Reset password', Icons.lock_reset, KTColors.info,
            () async {
          final api = ref.read(apiServiceProvider);
          try {
            await api.post('/users/$userId/reset-password');
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Password reset email sent')),
              );
            }
          } catch (_) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Failed to reset password')),
              );
            }
          }
        }),
        const SizedBox(height: 10),
        _actionBtn(
          isActive ? 'Deactivate' : 'Reactivate',
          isActive ? Icons.block : Icons.check_circle_outline,
          isActive ? KTColors.danger : KTColors.success,
          () => _toggleActive(context, ref, d, isActive),
        ),
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: KTColors.textMuted, size: 16),
          const SizedBox(width: 8),
          Text(text,
              style: const TextStyle(
                  color: KTColors.textMuted, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _actionBtn(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 14)),
          ],
        ),
      ),
    );
  }

  void _toggleActive(BuildContext context, WidgetRef ref,
      Map<String, dynamic> d, bool isActive) {
    final name =
        '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'.trim();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KTColors.surface,
        title: Text(
          isActive ? 'Deactivate $name?' : 'Reactivate $name?',
          style: const TextStyle(color: KTColors.textHeading),
        ),
        content: Text(
          isActive
              ? 'They will be logged out immediately.'
              : 'They will regain access.',
          style: const TextStyle(color: KTColors.textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final api = ref.read(apiServiceProvider);
              try {
                await api.put('/users/$userId', data: {'is_active': !isActive});
                ref.invalidate(_employeeDetailProvider(userId));
                ref.invalidate(adminEmployeesProvider);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text(
                            isActive ? 'Deactivated' : 'Reactivated')),
                  );
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to update')),
                  );
                }
              }
            },
            child: Text(
              isActive ? 'Deactivate' : 'Reactivate',
              style: TextStyle(
                  color: isActive ? KTColors.danger : KTColors.success),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityStats(Map<String, dynamic> d, String role) {
    final r = role.toUpperCase();
    final List<_StatItem> items;
    switch (r) {
      case 'MANAGER':
        items = [
          _StatItem('Jobs created', d['jobs_created'] ?? d['job_count'] ?? 0),
          _StatItem('Active trips', d['active_trips'] ?? 0),
        ];
        break;
      case 'PROJECT_ASSOCIATE':
        items = [
          _StatItem('LRs created', d['lrs_created'] ?? d['lr_count'] ?? 0),
          _StatItem('Trips completed', d['trips_completed'] ?? 0),
        ];
        break;
      case 'FLEET_MANAGER':
        items = [
          _StatItem('Vehicles managed', d['vehicles_managed'] ?? d['vehicle_count'] ?? 0),
          _StatItem('Alerts resolved', d['alerts_resolved'] ?? 0),
        ];
        break;
      case 'ACCOUNTANT':
        items = [
          _StatItem('Invoices raised', d['invoices_raised'] ?? d['invoice_count'] ?? 0),
          _StatItem('Payments recorded', d['payments_recorded'] ?? 0),
        ];
        break;
      case 'DRIVER':
        items = [
          _StatItem('Trips completed', d['trips_completed'] ?? d['total_trips'] ?? 0),
          _StatItem('Total km', d['total_km'] ?? d['distance_km'] ?? 0),
        ];
        break;
      default:
        items = [];
    }
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('ACTIVITY',
            style: TextStyle(
                color: KTColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
        const SizedBox(height: 8),
        Row(
          children: items.map((s) {
            return Expanded(
              child: Container(
                margin: const EdgeInsets.only(right: 10),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(width: 3, color: KTColors.amber600),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${s.value}',
                                  style: const TextStyle(
                                      color: KTColors.textHeading,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(s.label,
                                  style: const TextStyle(
                                      color: KTColors.textMuted, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  void _showEditRole(BuildContext context, WidgetRef ref,
      Map<String, dynamic> d, String currentRole) {
    const roles = ['MANAGER', 'PROJECT_ASSOCIATE', 'FLEET_MANAGER', 'ACCOUNTANT', 'DRIVER', 'ADMIN'];
    String selected = currentRole.toUpperCase();

    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Change role',
                    style: TextStyle(
                        color: KTColors.textHeading,
                        fontSize: 16,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                ...roles.map((r) => RadioListTile<String>(
                      title: Text(r,
                          style: const TextStyle(
                              color: KTColors.textHeading, fontSize: 14)),
                      value: r,
                      groupValue: selected,
                      activeColor: KTColors.primary,
                      onChanged: (v) => setState(() => selected = v!),
                    )),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: KTColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      final api = ref.read(apiServiceProvider);
                      try {
                        await api.put('/users/$userId', data: {'role_names': [selected]});
                        ref.invalidate(_employeeDetailProvider(userId));
                        ref.invalidate(adminEmployeesProvider);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Role updated to $selected')),
                          );
                        }
                      } catch (_) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Failed to update role')),
                          );
                        }
                      }
                    },
                    child: const Text('Save',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _fmtDate(dynamic val) {
    if (val == null) return '—';
    try {
      return DateFormat('dd MMM yyyy, HH:mm')
          .format(DateTime.parse(val.toString()));
    } catch (_) {
      return val.toString();
    }
  }
}

class _StatItem {
  final String label;
  final dynamic value;
  const _StatItem(this.label, this.value);
}
