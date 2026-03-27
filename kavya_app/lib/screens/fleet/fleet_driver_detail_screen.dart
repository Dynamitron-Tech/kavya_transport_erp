import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

final _driverDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/drivers/$id');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  },
);

class FleetDriverDetailScreen extends ConsumerWidget {
  final int driverId;
  const FleetDriverDetailScreen({super.key, required this.driverId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driverAsync = ref.watch(_driverDetailProvider(driverId));
    final accent = KTColors.getRoleColor('fleet_manager');

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('Driver Details',
            style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none)),
      ),
      body: driverAsync.when(
        loading: () =>
            const Center(child: KTLoadingShimmer(type: ShimmerType.card)),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load driver',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 8),
              Text('$e',
                  style: KTTextStyles.bodySmall
                      .copyWith(color: KTColors.textMuted),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () =>
                    ref.invalidate(_driverDetailProvider(driverId)),
                style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.fleetAccent,
                    foregroundColor: Colors.white),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (d) {
          final firstName = d['first_name']?.toString() ?? '';
          final lastName = d['last_name']?.toString() ?? '';
          final name = '$firstName $lastName'.trim();
          final initials =
              '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'
                  .toUpperCase();
          final status = d['status']?.toString() ?? 'available';
          final phone = d['phone']?.toString() ?? '—';
          final email = d['email']?.toString() ?? '—';
          final empCode = d['employee_code']?.toString() ?? '—';
          final dob = d['date_of_birth']?.toString() ?? '—';
          final doj = d['date_of_joining']?.toString() ?? '—';
          final designation = d['designation']?.toString() ?? '—';
          final salaryType = d['salary_type']?.toString() ?? '—';
          final baseSalary = d['base_salary'];
          final bloodGroup = d['blood_group']?.toString() ?? '—';
          final emergName = d['emergency_contact_name']?.toString() ?? '—';
          final emergPhone =
              d['emergency_contact_phone']?.toString() ?? '—';

          // Licenses
          final licenses = (d['licenses'] as List?)
                  ?.cast<Map<String, dynamic>>() ??
              [];

          Color statusColor;
          String statusLabel;
          switch (status) {
            case 'on_trip':
              statusColor = KTColors.info;
              statusLabel = 'On Trip';
              break;
            case 'on_leave':
              statusColor = KTColors.warning;
              statusLabel = 'On Leave';
              break;
            case 'suspended':
              statusColor = KTColors.danger;
              statusLabel = 'Suspended';
              break;
            case 'inactive':
              statusColor = KTColors.textMuted;
              statusLabel = 'Inactive';
              break;
            default:
              statusColor = KTColors.success;
              statusLabel = 'Available';
          }

          return RefreshIndicator(
            color: KTColors.fleetAccent,
            onRefresh: () async =>
                ref.invalidate(_driverDetailProvider(driverId)),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Avatar + Name + Status
                  CircleAvatar(
                    radius: 38,
                    backgroundColor: accent.withValues(alpha: 0.2),
                    child: Text(initials,
                        style: KTTextStyles.h1.copyWith(
                            color: accent,
                            decoration: TextDecoration.none)),
                  ),
                  const SizedBox(height: 12),
                  Text(
                      name.isNotEmpty ? name : 'Driver #$driverId',
                      style: KTTextStyles.h2.copyWith(
                          color: KTColors.textHeading,
                          decoration: TextDecoration.none)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: statusColor.withValues(alpha: 0.4)),
                    ),
                    child: Text(statusLabel,
                        style: KTTextStyles.label.copyWith(
                            color: statusColor,
                            decoration: TextDecoration.none)),
                  ),
                  const SizedBox(height: 20),

                  // Contact
                  _card('Contact', [
                    _row('Phone', phone),
                    _row('Email', email),
                    _row('Employee Code', empCode),
                  ]),
                  const SizedBox(height: 12),

                  // Personal
                  _card('Personal Info', [
                    _row('Date of Birth', dob),
                    _row('Blood Group', bloodGroup),
                    _row('Designation',
                        designation.replaceAll('_', ' ')),
                    _row('Joined', doj),
                  ]),
                  const SizedBox(height: 12),

                  // Salary
                  _card('Salary', [
                    _row('Type',
                        salaryType.replaceAll('_', ' ')),
                    if (baseSalary != null)
                      _row('Base Salary', '₹$baseSalary'),
                  ]),
                  const SizedBox(height: 12),

                  // Emergency Contact
                  _card('Emergency Contact', [
                    _row('Name', emergName),
                    _row('Phone', emergPhone),
                  ]),

                  // Licenses
                  if (licenses.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _card(
                      'Licenses',
                      licenses
                          .map((l) => _row(
                              l['license_type']?.toString() ?? '—',
                              '${l['license_number'] ?? '—'} (exp: ${l['expiry_date'] ?? '—'})'))
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _card(String title, List<Widget> rows) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding:
                const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Text(title,
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.fleetAccent,
                    fontSize: 13,
                    decoration: TextDecoration.none)),
          ),
          const Divider(color: KTColors.borderColor),
          ...rows,
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: 16, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: KTTextStyles.body.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none)),
          Flexible(
            child: Text(value,
                style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none),
                textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
