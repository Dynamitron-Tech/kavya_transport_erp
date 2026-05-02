import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ──────────────────────────────────────────────────────────────

final _driverDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/drivers/$id');
    final d = res['data'] ?? res;
    return (d is Map<String, dynamic>) ? d : <String, dynamic>{};
  },
);

final _driverDocsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/drivers/$id/documents');
    final d = res['data'] ?? res;
    return (d is Map<String, dynamic>) ? d : <String, dynamic>{};
  },
);

final _driverTripsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
  (ref, id) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/drivers/$id/trips',
        queryParameters: {'page_size': 100});
    final d = res['data'] ?? res;
    if (d is List) return d.cast<Map<String, dynamic>>();
    return [];
  },
);

// ─── Helpers ────────────────────────────────────────────────────────────────

Color _statusColor(String status) {
  switch (status) {
    case 'on_trip':
      return KTColors.info;
    case 'on_leave':
      return KTColors.warning;
    case 'suspended':
      return KTColors.danger;
    case 'inactive':
      return KTColors.textMuted;
    default:
      return KTColors.success;
  }
}

String _statusLabel(String status) {
  switch (status) {
    case 'on_trip':
      return 'On Trip';
    case 'on_leave':
      return 'On Leave';
    case 'suspended':
      return 'Suspended';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Available';
  }
}

// ─── Main Screen (Hub Style) ─────────────────────────────────────────────────

class FleetDriverDetailScreen extends ConsumerWidget {
  final int driverId;
  const FleetDriverDetailScreen({super.key, required this.driverId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driverAsync = ref.watch(_driverDetailProvider(driverId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: driverAsync.when(
          data: (d) {
            final firstName = d['first_name']?.toString() ?? '';
            final lastName = d['last_name']?.toString() ?? '';
            final name = '$firstName $lastName'.trim();
            return Text(
              name.isNotEmpty ? name : 'Driver #$driverId',
              style: KTTextStyles.h2
                  .copyWith(color: KTColors.fleetAccent, letterSpacing: 0.5),
            );
          },
          loading: () => Text('Driver',
              style:
                  KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
          error: (_, __) => Text('Driver',
              style:
                  KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        ),
      ),
      body: driverAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: KTColors.fleetAccent),
        ),
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
              const SizedBox(height: 16),
              KTButton.secondary(
                label: 'Retry',
                onPressed: () =>
                    ref.invalidate(_driverDetailProvider(driverId)),
              ),
            ],
          ),
        ),
        data: (d) => _DriverHubBody(driver: d, driverId: driverId),
      ),
    );
  }
}

// ─── Hub Body ────────────────────────────────────────────────────────────────

class _DriverHubBody extends StatelessWidget {
  final Map<String, dynamic> driver;
  final int driverId;
  const _DriverHubBody({required this.driver, required this.driverId});

  @override
  Widget build(BuildContext context) {
    final firstName = driver['first_name']?.toString() ?? '';
    final lastName = driver['last_name']?.toString() ?? '';
    final name = '$firstName $lastName'.trim();
    final initials =
        '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'
            .toUpperCase();
    final status =
        (driver['status'] ?? 'available').toString().toLowerCase();
    final vehicleReg = (driver['vehicle_registration'] ?? '').toString();
    final statusColor = _statusColor(status);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Driver Info Card ──────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: KTColors.fleetAccentBg,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          initials.isNotEmpty ? initials : '?',
                          style: KTTextStyles.h3.copyWith(
                            color: KTColors.fleetAccent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name.isNotEmpty ? name : 'Driver #$driverId',
                            style: KTTextStyles.body.copyWith(
                              color: KTColors.textHeading,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'DRIVER',
                            style: KTTextStyles.label
                                .copyWith(color: KTColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                            color: statusColor.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        _statusLabel(status).toUpperCase(),
                        style: KTTextStyles.label.copyWith(
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                if (vehicleReg.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Divider(color: KTColors.borderColor, height: 1),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _statItem(
                        Icons.directions_car_outlined,
                        'Vehicle',
                        vehicleReg,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 28),
          Text(
            'ACTIONS',
            style: KTTextStyles.label.copyWith(
              color: KTColors.textMuted,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),

          // ── Primary Action Cards ──────────────────────────────
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  icon: Icons.folder_open_outlined,
                  label: 'Documents',
                  subtitle: 'Licence, Aadhaar\n& compliance docs',
                  color: KTColors.info,
                  bgColor: KTColors.infoBg,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => _DriverDocsScreen(
                        driverId: driverId,
                        driverName: name,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  icon: Icons.history_outlined,
                  label: 'Trip History',
                  subtitle: 'Past trips, routes\n& performance',
                  color: KTColors.success,
                  bgColor: KTColors.successBg,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => _DriverTripsScreen(
                        driverId: driverId,
                        driverName: name,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ── Driver Details Button ─────────────────────────────
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => _DriverDetailsScreen(
                    driverId: driverId,
                    driverData: driver,
                  ),
                ),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(
                    color: KTColors.fleetAccent, width: 1.5),
                foregroundColor: KTColors.fleetAccent,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.tune_outlined, size: 20),
              label: Text(
                'Driver Details',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.fleetAccent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: KTColors.textMuted, size: 18),
        const SizedBox(height: 4),
        Text(value,
            style: KTTextStyles.body.copyWith(
                color: KTColors.textHeading, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(label,
            style:
                KTTextStyles.label.copyWith(color: KTColors.textMuted)),
      ],
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: KTTextStyles.body.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: KTTextStyles.bodySmall
                  .copyWith(color: KTColors.textMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Driver Documents Screen ─────────────────────────────────────────────────

class _DriverDocsScreen extends StatelessWidget {
  final int driverId;
  final String driverName;
  const _DriverDocsScreen(
      {required this.driverId, required this.driverName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Documents',
                style: KTTextStyles.h2
                    .copyWith(color: KTColors.textHeading)),
            if (driverName.isNotEmpty)
              Text(driverName,
                  style: KTTextStyles.caption
                      .copyWith(color: KTColors.textMuted)),
          ],
        ),
      ),
      body: _DocumentsTab(driverId: driverId),
    );
  }
}

// ─── Driver Trip History Screen ───────────────────────────────────────────────

class _DriverTripsScreen extends StatelessWidget {
  final int driverId;
  final String driverName;
  const _DriverTripsScreen(
      {required this.driverId, required this.driverName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Trip History',
                style: KTTextStyles.h2
                    .copyWith(color: KTColors.textHeading)),
            if (driverName.isNotEmpty)
              Text(driverName,
                  style: KTTextStyles.caption
                      .copyWith(color: KTColors.textMuted)),
          ],
        ),
      ),
      body: _TripHistoryTab(driverId: driverId),
    );
  }
}

// ─── Driver Details Screen ────────────────────────────────────────────────────

class _DriverDetailsScreen extends StatelessWidget {
  final int driverId;
  final Map<String, dynamic> driverData;
  const _DriverDetailsScreen(
      {required this.driverId, required this.driverData});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Text('Driver Details',
            style:
                KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: _DriverDetailsTab(
          driverId: driverId, driverData: driverData),
    );
  }
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

class _DocumentsTab extends ConsumerWidget {
  final int driverId;
  const _DocumentsTab({required this.driverId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(_driverDocsProvider(driverId));

    return docsAsync.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: KTLoadingShimmer(type: ShimmerType.card),
        ),
      ),
      error: (e, _) => Center(
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 40),
              const SizedBox(height: 8),
              Text('Failed to load documents',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 12),
              KTButton.secondary(
                label: 'Retry',
                onPressed: () =>
                    ref.invalidate(_driverDocsProvider(driverId)),
              ),
            ]),
      ),
      data: (data) {
        final docs =
            (data['items'] as List?)?.cast<Map<String, dynamic>>() ??
                [];
        final compliance =
            data['compliance'] as Map<String, dynamic>? ?? {};

        if (docs.isEmpty) {
          return Center(
            child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.folder_open,
                      size: 56,
                      color: KTColors.textMuted.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text('No Documents',
                      style: KTTextStyles.h3
                          .copyWith(color: KTColors.textMuted)),
                  const SizedBox(height: 4),
                  Text('No documents uploaded yet.',
                      style: KTTextStyles.bodySmall
                          .copyWith(color: KTColors.textMuted)),
                ]),
          );
        }

        return RefreshIndicator(
          color: KTColors.fleetAccent,
          onRefresh: () async =>
              ref.invalidate(_driverDocsProvider(driverId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (compliance.isNotEmpty) ...[
                _ComplianceSummary(compliance: compliance),
                const SizedBox(height: 16),
              ],
              ...docs.map((doc) => _DocCard(doc: doc)),
            ],
          ),
        );
      },
    );
  }
}

class _ComplianceSummary extends StatelessWidget {
  final Map<String, dynamic> compliance;
  const _ComplianceSummary({required this.compliance});

  @override
  Widget build(BuildContext context) {
    final total = compliance['total'] ?? 0;
    final valid = compliance['valid'] ?? 0;
    final expired = compliance['expired'] ?? 0;
    final pending = compliance['pending'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _CompStat('Total', '$total', KTColors.textMuted),
          _divider(),
          _CompStat('Valid', '$valid', KTColors.success),
          _divider(),
          _CompStat('Expired', '$expired', KTColors.danger),
          _divider(),
          _CompStat('Pending', '$pending', KTColors.warning),
        ],
      ),
    );
  }

  Widget _divider() =>
      Container(height: 32, width: 1, color: KTColors.borderColor);
}

class _CompStat extends StatelessWidget {
  final String label, value;
  final Color color;
  const _CompStat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value,
          style: KTTextStyles.h2
              .copyWith(color: color, decoration: TextDecoration.none)),
      const SizedBox(height: 2),
      Text(label,
          style: KTTextStyles.caption.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none)),
    ]);
  }
}

class _DocCard extends StatelessWidget {
  final Map<String, dynamic> doc;
  const _DocCard({required this.doc});

  @override
  Widget build(BuildContext context) {
    final docName = doc['doc_name']?.toString() ?? 'Document';
    final docNum = doc['doc_number']?.toString() ?? '';
    final expiry = doc['expiry_date']?.toString() ?? '';
    final status = doc['status']?.toString() ?? 'pending';
    final fileUrl = doc['file_url']?.toString() ?? '';

    Color statusColor;
    switch (status) {
      case 'valid':
      case 'verified':
        statusColor = KTColors.success;
        break;
      case 'expired':
        statusColor = KTColors.danger;
        break;
      default:
        statusColor = KTColors.warning;
    }

    IconData typeIcon;
    final docType = doc['doc_type']?.toString() ?? '';
    switch (docType) {
      case 'license':
      case 'driving_license':
        typeIcon = Icons.credit_card_outlined;
        break;
      case 'pan_card':
      case 'aadhaar_card':
        typeIcon = Icons.badge_outlined;
        break;
      case 'driver_photo':
        typeIcon = Icons.photo_outlined;
        break;
      default:
        typeIcon = Icons.description_outlined;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(typeIcon, color: statusColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(docName,
                    style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.none)),
                if (docNum.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(docNum,
                      style: KTTextStyles.caption.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none)),
                ],
                if (expiry.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text('Expires: $expiry',
                      style: KTTextStyles.caption.copyWith(
                          color: status == 'expired'
                              ? KTColors.danger
                              : KTColors.textMuted,
                          decoration: TextDecoration.none)),
                ],
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(status.replaceAll('_', ' ').toUpperCase(),
                    style: KTTextStyles.caption.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 9,
                        decoration: TextDecoration.none)),
              ),
              if (fileUrl.isNotEmpty) ...[
                const SizedBox(height: 6),
                const Icon(Icons.open_in_new,
                    size: 14, color: KTColors.fleetAccent),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Trip History Tab ────────────────────────────────────────────────────────

class _TripHistoryTab extends ConsumerWidget {
  final int driverId;
  const _TripHistoryTab({required this.driverId});

  Color _tripStatusColor(String s) {
    switch (s) {
      case 'completed':
        return KTColors.success;
      case 'in_transit':
      case 'started':
        return KTColors.info;
      case 'cancelled':
        return KTColors.danger;
      default:
        return KTColors.warning;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(_driverTripsProvider(driverId));

    return tripsAsync.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (_, __) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: KTLoadingShimmer(type: ShimmerType.card),
        ),
      ),
      error: (e, _) => Center(
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 40),
              const SizedBox(height: 8),
              Text('Failed to load trips',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 12),
              KTButton.secondary(
                label: 'Retry',
                onPressed: () =>
                    ref.invalidate(_driverTripsProvider(driverId)),
              ),
            ]),
      ),
      data: (trips) {
        if (trips.isEmpty) {
          return Center(
            child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.route,
                      size: 56,
                      color: KTColors.textMuted.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text('No Trips Yet',
                      style: KTTextStyles.h3
                          .copyWith(color: KTColors.textMuted)),
                  const SizedBox(height: 4),
                  Text('This driver has no trip records.',
                      style: KTTextStyles.bodySmall
                          .copyWith(color: KTColors.textMuted)),
                ]),
          );
        }

        final totalDist = trips.fold<double>(
            0,
            (s, t) =>
                s + ((t['distance_km'] as num?)?.toDouble() ?? 0));
        final completed =
            trips.where((t) => t['status'] == 'completed').length;

        return RefreshIndicator(
          color: KTColors.fleetAccent,
          onRefresh: () async =>
              ref.invalidate(_driverTripsProvider(driverId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _TripStat(
                        'Total', '${trips.length}', KTColors.fleetAccent),
                    Container(
                        height: 28,
                        width: 1,
                        color: KTColors.borderColor),
                    _TripStat(
                        'Completed', '$completed', KTColors.success),
                    Container(
                        height: 28,
                        width: 1,
                        color: KTColors.borderColor),
                    _TripStat('Km Driven',
                        '${totalDist.toStringAsFixed(0)} km', KTColors.info),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ...trips.map((trip) => _TripCard(
                    trip: trip,
                    statusColor: _tripStatusColor(
                        trip['status']?.toString() ?? ''),
                  )),
            ],
          ),
        );
      },
    );
  }
}

class _TripStat extends StatelessWidget {
  final String label, value;
  final Color color;
  const _TripStat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value,
          style: KTTextStyles.h3
              .copyWith(color: color, decoration: TextDecoration.none)),
      const SizedBox(height: 2),
      Text(label,
          style: KTTextStyles.caption.copyWith(
              color: KTColors.textMuted, decoration: TextDecoration.none)),
    ]);
  }
}

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final Color statusColor;
  const _TripCard({required this.trip, required this.statusColor});

  @override
  Widget build(BuildContext context) {
    final tripNum = trip['trip_number']?.toString() ?? '—';
    final route = trip['route']?.toString() ?? '—';
    final date = trip['date']?.toString() ?? '';
    final dist = (trip['distance_km'] as num?)?.toDouble() ?? 0;
    final status = trip['status']?.toString() ?? '';
    final vehicle = trip['vehicle_registration']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(tripNum,
                    style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        fontWeight: FontWeight.w700,
                        decoration: TextDecoration.none)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(status.replaceAll('_', ' ').toUpperCase(),
                    style: KTTextStyles.caption.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 9,
                        decoration: TextDecoration.none)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(children: [
            const Icon(Icons.route_outlined,
                size: 13, color: KTColors.textMuted),
            const SizedBox(width: 4),
            Expanded(
              child: Text(route,
                  style: KTTextStyles.bodySmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none)),
            ),
          ]),
          const SizedBox(height: 6),
          Row(children: [
            if (date.isNotEmpty) ...[
              const Icon(Icons.calendar_today_outlined,
                  size: 11, color: KTColors.textMuted),
              const SizedBox(width: 4),
              Text(date,
                  style: KTTextStyles.caption.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none)),
              const SizedBox(width: 12),
            ],
            if (dist > 0) ...[
              const Icon(Icons.speed_outlined,
                  size: 11, color: KTColors.textMuted),
              const SizedBox(width: 4),
              Text('${dist.toStringAsFixed(0)} km',
                  style: KTTextStyles.caption.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none)),
              const SizedBox(width: 12),
            ],
            if (vehicle.isNotEmpty) ...[
              const Icon(Icons.directions_car_outlined,
                  size: 11, color: KTColors.textMuted),
              const SizedBox(width: 4),
              Text(vehicle,
                  style: KTTextStyles.caption.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none)),
            ],
          ]),
        ],
      ),
    );
  }
}

// ─── Driver Details Tab ──────────────────────────────────────────────────────

class _DriverDetailsTab extends ConsumerStatefulWidget {
  final int driverId;
  final Map<String, dynamic> driverData;
  const _DriverDetailsTab(
      {required this.driverId, required this.driverData});

  @override
  ConsumerState<_DriverDetailsTab> createState() => _DriverDetailsTabState();
}

class _DriverDetailsTabState extends ConsumerState<_DriverDetailsTab> {
  final _formKey = GlobalKey<FormState>();
  bool _isEditing = false;
  bool _isSaving = false;

  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _phone;
  late final TextEditingController _altPhone;
  late final TextEditingController _email;
  late final TextEditingController _dob;
  late final TextEditingController _doj;
  late final TextEditingController _bloodGroup;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _address;
  late final TextEditingController _baseSalary;
  late final TextEditingController _bankAccount;
  late final TextEditingController _bankName;
  late final TextEditingController _bankIfsc;
  late final TextEditingController _emergName;
  late final TextEditingController _emergPhone;
  late final TextEditingController _emergRelation;
  String? _selectedStatus;

  static const _statusOptions = [
    'available',
    'on_trip',
    'on_leave',
    'off_duty',
    'suspended',
    'inactive',
  ];

  @override
  void initState() {
    super.initState();
    final d = widget.driverData;
    _firstName =
        TextEditingController(text: d['first_name']?.toString() ?? '');
    _lastName =
        TextEditingController(text: d['last_name']?.toString() ?? '');
    _phone = TextEditingController(text: d['phone']?.toString() ?? '');
    _altPhone = TextEditingController(
        text: d['alternate_phone']?.toString() ?? '');
    _email = TextEditingController(text: d['email']?.toString() ?? '');
    _dob = TextEditingController(
        text: d['date_of_birth']?.toString() ?? '');
    _doj = TextEditingController(
        text: d['date_of_joining']?.toString() ?? '');
    _bloodGroup =
        TextEditingController(text: d['blood_group']?.toString() ?? '');
    _city = TextEditingController(text: d['city']?.toString() ?? '');
    _state = TextEditingController(text: d['state']?.toString() ?? '');
    _address = TextEditingController(
        text: d['current_address']?.toString() ?? '');
    _baseSalary =
        TextEditingController(text: d['base_salary']?.toString() ?? '');
    _bankAccount = TextEditingController(
        text: d['bank_account_number']?.toString() ?? '');
    _bankName =
        TextEditingController(text: d['bank_name']?.toString() ?? '');
    _bankIfsc =
        TextEditingController(text: d['bank_ifsc']?.toString() ?? '');
    _emergName = TextEditingController(
        text: d['emergency_contact_name']?.toString() ?? '');
    _emergPhone = TextEditingController(
        text: d['emergency_contact_phone']?.toString() ?? '');
    _emergRelation = TextEditingController(
        text: d['emergency_contact_relation']?.toString() ?? '');
    _selectedStatus = d['status']?.toString() ?? 'available';
  }

  @override
  void dispose() {
    for (final c in [
      _firstName, _lastName, _phone, _altPhone, _email, _dob, _doj,
      _bloodGroup, _city, _state, _address, _baseSalary, _bankAccount,
      _bankName, _bankIfsc, _emergName, _emergPhone, _emergRelation
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final api = ref.read(apiServiceProvider);
      final payload = <String, dynamic>{};
      void add(String key, String val) {
        if (val.trim().isNotEmpty) payload[key] = val.trim();
      }

      add('first_name', _firstName.text);
      add('last_name', _lastName.text);
      add('phone', _phone.text);
      add('alternate_phone', _altPhone.text);
      add('email', _email.text);
      add('date_of_birth', _dob.text);
      add('date_of_joining', _doj.text);
      add('blood_group', _bloodGroup.text);
      add('city', _city.text);
      add('state', _state.text);
      add('current_address', _address.text);
      if (_baseSalary.text.trim().isNotEmpty) {
        payload['base_salary'] = double.tryParse(_baseSalary.text.trim());
      }
      add('bank_account_number', _bankAccount.text);
      add('bank_name', _bankName.text);
      add('bank_ifsc', _bankIfsc.text);
      add('emergency_contact_name', _emergName.text);
      add('emergency_contact_phone', _emergPhone.text);
      add('emergency_contact_relation', _emergRelation.text);
      if (_selectedStatus != null) payload['status'] = _selectedStatus;

      await api.put('/drivers/${widget.driverId}', data: payload);
      ref.invalidate(_driverDetailProvider(widget.driverId));

      if (mounted) {
        setState(() {
          _isEditing = false;
          _isSaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Driver details updated successfully'),
          backgroundColor: KTColors.success,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to update: $e'),
          backgroundColor: KTColors.danger,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: _isEditing
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          onPressed: _isSaving
                              ? null
                              : () => setState(() => _isEditing = false),
                          child: Text('Cancel',
                              style: KTTextStyles.body.copyWith(
                                  color: KTColors.textMuted)),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: _isSaving ? null : _save,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: KTColors.fleetAccent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 10),
                          ),
                          child: _isSaving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white))
                              : const Text('Save Changes'),
                        ),
                      ],
                    )
                  : OutlinedButton.icon(
                      onPressed: () =>
                          setState(() => _isEditing = true),
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      label: const Text('Edit'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: KTColors.fleetAccent,
                        side: const BorderSide(
                            color: KTColors.fleetAccent),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
            ),
            const SizedBox(height: 8),

            _section('Personal Information', [
              _row2('First Name', _firstName, 'Last Name', _lastName),
              _field('Phone', _phone,
                  keyboard: TextInputType.phone),
              _field('Alt. Phone', _altPhone,
                  keyboard: TextInputType.phone),
              _field('Email', _email,
                  keyboard: TextInputType.emailAddress),
              _row2('Date of Birth', _dob, 'Blood Group', _bloodGroup),
              _field('Date of Joining', _doj),
            ]),
            const SizedBox(height: 16),

            _section('Address', [
              _field('City', _city),
              _field('State', _state),
              _field('Current Address', _address, maxLines: 2),
            ]),
            const SizedBox(height: 16),

            _section('Bank Details', [
              _field('Account Number', _bankAccount,
                  keyboard: TextInputType.number),
              _field('Bank Name', _bankName),
              _field('IFSC Code', _bankIfsc),
            ]),
            const SizedBox(height: 16),

            _section('Salary', [
              _field('Base Salary (Rs.)', _baseSalary,
                  keyboard: TextInputType.number),
            ]),
            const SizedBox(height: 16),

            _section('Emergency Contact', [
              _field('Name', _emergName),
              _field('Phone', _emergPhone,
                  keyboard: TextInputType.phone),
              _field('Relation', _emergRelation),
            ]),
            const SizedBox(height: 16),

            if (_isEditing) ...[
              _sectionHeader('Status'),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedStatus,
                    isExpanded: true,
                    style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none),
                    items: _statusOptions
                        .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(s
                                  .replaceAll('_', ' ')
                                  .split(' ')
                                  .map((w) => w.isNotEmpty
                                      ? '${w[0].toUpperCase()}${w.substring(1)}'
                                      : w)
                                  .join(' ')),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedStatus = v),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(title),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _sectionHeader(String title) {
    return Text(title,
        style: KTTextStyles.label.copyWith(
            color: KTColors.fleetAccent,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
            decoration: TextDecoration.none));
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType keyboard = TextInputType.text, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: KTTextStyles.caption.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none)),
          const SizedBox(height: 4),
          _isEditing
              ? TextFormField(
                  controller: ctrl,
                  keyboardType: keyboard,
                  maxLines: maxLines,
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.textHeading,
                      decoration: TextDecoration.none),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(
                            color: KTColors.borderColor)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(
                            color: KTColors.borderColor)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(
                            color: KTColors.fleetAccent, width: 1.5)),
                    filled: true,
                    fillColor: KTColors.lightBg,
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    ctrl.text.isNotEmpty ? ctrl.text : '—',
                    style: KTTextStyles.body.copyWith(
                        color: ctrl.text.isNotEmpty
                            ? KTColors.textHeading
                            : KTColors.textMuted,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.none),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _row2(String l1, TextEditingController c1, String l2,
      TextEditingController c2) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: _inlineField(l1, c1)),
          const SizedBox(width: 12),
          Expanded(child: _inlineField(l2, c2)),
        ],
      ),
    );
  }

  Widget _inlineField(String label, TextEditingController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: KTTextStyles.caption.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none)),
        const SizedBox(height: 4),
        _isEditing
            ? TextFormField(
                controller: ctrl,
                style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none),
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(
                          color: KTColors.borderColor)),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(
                          color: KTColors.borderColor)),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(
                          color: KTColors.fleetAccent, width: 1.5)),
                  filled: true,
                  fillColor: KTColors.lightBg,
                ),
              )
            : Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  ctrl.text.isNotEmpty ? ctrl.text : '—',
                  style: KTTextStyles.body.copyWith(
                      color: ctrl.text.isNotEmpty
                          ? KTColors.textHeading
                          : KTColors.textMuted,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.none),
                ),
              ),
      ],
    );
  }
}
