import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/fuel.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../utils/indian_format.dart' show IndianFormat;

// ─── Provider ──────────────────────────────────────────────────────────────

final _fuelIssueHistoryProvider =
    FutureProvider.autoDispose.family<List<FuelIssue>, String>(
  (ref, registration) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/fuel-pump/issues', queryParameters: {
      'registration': registration,
      'limit': 200,
    });
    final list = (res['data'] ?? res) as List?;
    if (list == null) return [];
    return list.map((e) => FuelIssue.fromJson(e as Map<String, dynamic>)).toList();
  },
);

// ─── Screen ────────────────────────────────────────────────────────────────

class FleetVehicleFuelHistoryScreen extends ConsumerWidget {
  final int vehicleId;
  final String registrationNumber;

  const FleetVehicleFuelHistoryScreen({
    super.key,
    required this.vehicleId,
    required this.registrationNumber,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(_fuelIssueHistoryProvider(registrationNumber));

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
            Text('Fuel Fill-Up History',
                style:
                    KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
            Text(
              registrationNumber,
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted),
            ),
          ],
        ),
      ),
      body: logsAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load fuel history',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () =>
                    ref.invalidate(_fuelIssueHistoryProvider(registrationNumber)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.local_gas_station_outlined,
                      size: 64,
                      color: KTColors.textMuted.withOpacity(0.35)),
                  const SizedBox(height: 16),
                  Text('No fill-up records yet',
                      style: KTTextStyles.body
                          .copyWith(color: KTColors.textMuted)),
                  const SizedBox(height: 4),
                  Text('Fill-ups are logged by the pump operator.',
                      style: KTTextStyles.label
                          .copyWith(color: KTColors.textMuted)),
                ],
              ),
            );
          }

          final totalLitres =
              items.fold<double>(0, (s, e) => s + e.quantityLitres);
          final totalAmount =
              items.fold<double>(0, (s, e) => s + e.totalAmount);

          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(_fuelIssueHistoryProvider(registrationNumber)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _SummaryBanner(
                  totalFills: items.length,
                  totalLitres: totalLitres,
                  totalAmount: totalAmount,
                ),
                const SizedBox(height: 16),
                ...items.map((issue) => _FuelIssueCard(issue: issue)),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Summary Banner ────────────────────────────────────────────────────────

class _SummaryBanner extends StatelessWidget {
  final int totalFills;
  final double totalLitres;
  final double totalAmount;

  const _SummaryBanner({
    required this.totalFills,
    required this.totalLitres,
    required this.totalAmount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFEA580C), Color(0xFFF97316)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF97316).withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.local_gas_station,
              color: Colors.white, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Fill-Up Summary',
                    style: KTTextStyles.body.copyWith(
                        color: Colors.white70,
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 4),
                Text(
                  '$totalFills fill-ups · ${totalLitres.toStringAsFixed(0)} L',
                  style: KTTextStyles.h2.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  'Total: ${IndianFormat.currency(totalAmount)}',
                  style: KTTextStyles.body.copyWith(color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Fuel Issue Card ───────────────────────────────────────────────────────

class _FuelIssueCard extends StatelessWidget {
  final FuelIssue issue;
  const _FuelIssueCard({required this.issue});

  @override
  Widget build(BuildContext context) {
    final date = issue.issuedAt;
    final dateLabel =
        '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    final timeLabel =
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    final fuelType = issue.fuelType.toUpperCase();
    final driverName = issue.driverName ?? '';
    final tankName = issue.tankName ?? '';
    final issuerName = issue.issuerName ?? '';
    final receipt = issue.receiptNumber ?? '';
    final remarks = issue.remarks ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: issue.isFlagged
            ? Border.all(color: KTColors.danger.withOpacity(0.4), width: 1.5)
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF97316).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.local_gas_station,
                      size: 20, color: Color(0xFFF97316)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$dateLabel  $timeLabel',
                        style: KTTextStyles.body.copyWith(
                            color: KTColors.textHeading,
                            fontWeight: FontWeight.w700),
                      ),
                      if (driverName.isNotEmpty)
                        Text(driverName,
                            style: KTTextStyles.label
                                .copyWith(color: KTColors.textMuted)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF97316).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        fuelType,
                        style: KTTextStyles.label.copyWith(
                            color: const Color(0xFFF97316),
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (issue.isFlagged)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.warning_amber_rounded,
                                size: 12, color: KTColors.danger),
                            const SizedBox(width: 3),
                            Text('Flagged',
                                style: KTTextStyles.label.copyWith(
                                    color: KTColors.danger,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          // ── Stats row ───────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: _Stat(
                    icon: Icons.opacity,
                    label: 'Qty',
                    value: '${issue.quantityLitres.toStringAsFixed(1)} L',
                    accent: const Color(0xFFF97316),
                  ),
                ),
                Expanded(
                  child: _Stat(
                    icon: Icons.currency_rupee,
                    label: 'Rate',
                    value: '₹${issue.ratePerLitre.toStringAsFixed(2)}/L',
                  ),
                ),
                Expanded(
                  child: _Stat(
                    icon: Icons.receipt_long_outlined,
                    label: 'Total',
                    value: IndianFormat.currency(issue.totalAmount),
                    accent: KTColors.success,
                  ),
                ),
              ],
            ),
          ),
          // ── Odometer ────────────────────────────────────────
          if (issue.odometerReading != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 2, 14, 4),
              child: Row(
                children: [
                  const Icon(Icons.speed_outlined,
                      size: 13, color: KTColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    'Odometer: ${issue.odometerReading!.toStringAsFixed(0)} km',
                    style:
                        KTTextStyles.label.copyWith(color: KTColors.textMuted),
                  ),
                ],
              ),
            ),
          // ── Tank / Issuer / Receipt ──────────────────────────
          if (tankName.isNotEmpty || issuerName.isNotEmpty || receipt.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              child: Wrap(
                spacing: 12,
                children: [
                  if (tankName.isNotEmpty)
                    _Chip(icon: Icons.local_gas_station_outlined, label: tankName),
                  if (issuerName.isNotEmpty)
                    _Chip(icon: Icons.person_outline, label: 'By: $issuerName'),
                  if (receipt.isNotEmpty)
                    _Chip(icon: Icons.receipt_outlined, label: receipt),
                ],
              ),
            ),
          // ── Remarks ─────────────────────────────────────────
          if (remarks.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notes_outlined,
                      size: 13, color: KTColors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(remarks,
                        style: KTTextStyles.label
                            .copyWith(color: KTColors.textMuted)),
                  ),
                ],
              ),
            ),
          // ── Flag reason ─────────────────────────────────────
          if (issue.isFlagged && (issue.flagReason?.isNotEmpty ?? false))
            Container(
              margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KTColors.danger.withOpacity(0.07),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.flag_outlined,
                      size: 13, color: KTColors.danger),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(issue.flagReason!,
                        style: KTTextStyles.label
                            .copyWith(color: KTColors.danger)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Chip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: KTColors.textMuted),
        const SizedBox(width: 3),
        Text(label,
            style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  const _Stat({
    required this.icon,
    required this.label,
    required this.value,
    this.accent = KTColors.textMuted,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: accent),
        const SizedBox(width: 5),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: KTTextStyles.label.copyWith(
                      color: KTColors.textMuted, fontSize: 10)),
              Text(value,
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.textHeading,
                      fontWeight: FontWeight.w600,
                      fontSize: 13),
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    );
  }
}
