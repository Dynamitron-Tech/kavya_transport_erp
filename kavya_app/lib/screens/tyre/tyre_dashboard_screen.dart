import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);

// ─── Providers ─────────────────────────────────────────────────────────────────

final tyreLifeSummaryProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre/life-summary');
  final data = (res is Map) ? (res['data'] ?? res) : res;
  return (data is Map<String, dynamic>) ? data : <String, dynamic>{};
});

final tyreInspectionQueueProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre/inspection-needed');
  final data = (res is Map) ? (res['data'] ?? res) : res;
  return (data is Map<String, dynamic>) ? data : <String, dynamic>{};
});

final tyreInspectionFlagsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre/inspection-flags');
  final data = (res is Map) ? (res['data'] ?? res) : res;
  if (data is Map) {
    final items = data['items'];
    return (items is List) ? items : [];
  }
  return (data is List) ? data : [];
});

final tyreRetreadFlagsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre/retread-flags');
  final data = (res is Map) ? (res['data'] ?? res) : res;
  if (data is Map) {
    final items = data['items'];
    return (items is List) ? items : [];
  }
  return (data is List) ? data : [];
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class TyreDashboardScreen extends ConsumerWidget {
  const TyreDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifeSummaryAsync = ref.watch(tyreLifeSummaryProvider);
    final queueAsync = ref.watch(tyreInspectionQueueProvider);
    final retreadFlagsAsync = ref.watch(tyreRetreadFlagsProvider);
    final inspectionFlagsAsync = ref.watch(tyreInspectionFlagsProvider);

    void refresh() {
      ref.invalidate(tyreLifeSummaryProvider);
      ref.invalidate(tyreInspectionQueueProvider);
      ref.invalidate(tyreRetreadFlagsProvider);
      ref.invalidate(tyreInspectionFlagsProvider);
    }

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: RefreshIndicator(
        color: _accent,
        onRefresh: () async => refresh(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Overview cards ───────────────────────────────────────────
              _SectionLabel(
                icon: Icons.bar_chart_rounded,
                label: 'Overview',
              ),
              const SizedBox(height: 10),
              _buildStatsGrid(lifeSummaryAsync, queueAsync, retreadFlagsAsync, inspectionFlagsAsync),
              const SizedBox(height: 24),

              // ── Trucks needing inspection ─────────────────────────────
              _SectionLabel(
                icon: Icons.local_shipping_rounded,
                label: 'Trucks Needing Inspection',
              ),
              const SizedBox(height: 10),
              inspectionFlagsAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
                  ),
                ),
                error: (e, _) => _ErrorRow(message: 'Could not load inspection flags'),
                data: (items) {
                  if (items.isEmpty) {
                    return _EmptyRow(message: 'No trucks flagged for inspection');
                  }
                  // Deduplicate by vehicle_number, keep most recent per vehicle
                  final seen = <String>{};
                  final unique = items.where((i) {
                    final v = (i as Map)['vehicle_number']?.toString() ?? '';
                    return seen.add(v);
                  }).take(5).toList();
                  return Column(
                    children: unique.map((f) {
                      final flag = f as Map;
                      final reg = flag['vehicle_number'] ?? '—';
                      final notes = flag['notes'] ?? '';
                      final date = _formatDate(flag['created_at'] as String?);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _InspectionFlagCard(
                          vehicleReg: reg,
                          notes: notes,
                          date: date,
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 24),

              // ── Flagged for Retreading ───────────────────────────────────
              _SectionLabel(
                icon: Icons.autorenew_rounded,
                label: 'Flagged for Retreading',
              ),
              const SizedBox(height: 10),
              retreadFlagsAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
                  ),
                ),
                error: (e, _) => _ErrorRow(message: 'Could not load retread flags'),
                data: (items) {
                  if (items.isEmpty) {
                    return _EmptyRow(message: 'No tyres flagged for retreading');
                  }
                  return Column(
                    children: items.take(10).map((r) {
                      final row = r as Map;
                      final tNum = row['tyre_number'] ?? '—';
                      final brand = row['brand'] ?? '';
                      final size = row['size'] ?? '';
                      final life = (row['life_pct'] as num?)?.toDouble() ?? 0;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _RetreadFlagCard(
                          tyreNumber: tNum,
                          subtitle: '$brand${size.isNotEmpty ? ' · $size' : ''}',
                          lifePct: life,
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsGrid(
    AsyncValue<Map<String, dynamic>> lifeSummaryAsync,
    AsyncValue<Map<String, dynamic>> queueAsync,
    AsyncValue<List<dynamic>> retreadFlagsAsync,
    AsyncValue<List<dynamic>> inspectionFlagsAsync,
  ) {
    final totalTyres = lifeSummaryAsync.valueOrNull?['total'] ?? 0;
    final statusCounts = (lifeSummaryAsync.valueOrNull?['status_counts'] as Map?) ?? {};
    final psiAlerts = (statusCounts['low_psi'] ?? 0) + (statusCounts['critical'] ?? 0);
    final retreadCount = retreadFlagsAsync.valueOrNull?.length ?? 0;
    // Count unique trucks flagged for inspection
    final flagItems = inspectionFlagsAsync.valueOrNull ?? [];
    final uniqueTrucks = flagItems.map((i) => (i as Map)['vehicle_number']?.toString() ?? '').toSet();
    final inspectionNeeded = uniqueTrucks.length;

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      childAspectRatio: 1.6,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _StatTile(
          label: 'Total Tyres',
          value: '$totalTyres',
          icon: Icons.tire_repair_rounded,
          color: _accent,
        ),
        _StatTile(
          label: 'Need Inspection',
          value: '$inspectionNeeded',
          icon: Icons.local_shipping_rounded,
          color: KTColors.warning,
        ),
        _StatTile(
          label: 'For Retreading',
          value: '$retreadCount',
          icon: Icons.autorenew_rounded,
          color: const Color(0xFF7C3AED),
        ),
        _StatTile(
          label: 'PSI Alerts',
          value: '$psiAlerts',
          icon: Icons.compress_rounded,
          color: KTColors.danger,
        ),
      ],
    );
  }

}

String _formatDate(String? iso) {
  if (iso == null) return '—';
  try {
    final dt = DateTime.parse(iso).toLocal();
    final months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}';
  } catch (_) {
    return '—';
  }
}

// ─── Inspection Flag Card ──────────────────────────────────────────────────────

class _InspectionFlagCard extends StatelessWidget {
  final String vehicleReg;
  final String notes;
  final String date;

  const _InspectionFlagCard({
    required this.vehicleReg,
    required this.notes,
    required this.date,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: const Color(0xFFDC2626).withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: const Color(0xFFDC2626).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.flag_rounded,
                color: Color(0xFFDC2626), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Truck $vehicleReg — Requires Inspection',
                  style: KTTextStyles.body.copyWith(
                    color: const Color(0xFFDC2626),
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                if (notes.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    notes,
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Text(
            date,
            style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Icon(icon, color: color, size: 16),
          ),
          const Spacer(),
          Text(
            value,
            style: KTTextStyles.h2.copyWith(
              color: KTColors.textHeading,
              decoration: TextDecoration.none,
            ),
          ),
          Text(
            label,
            style: KTTextStyles.labelSmall.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section Label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SectionLabel({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: _accent, size: 16),
        const SizedBox(width: 8),
        Text(
          label,
          style: KTTextStyles.h3.copyWith(
            color: KTColors.textHeading,
            decoration: TextDecoration.none,
          ),
        ),
      ],
    );
  }
}

// ─── Retread Flag Card ─────────────────────────────────────────────────────────

class _RetreadFlagCard extends StatelessWidget {
  final String tyreNumber;
  final String subtitle;
  final double lifePct;

  const _RetreadFlagCard({
    required this.tyreNumber,
    required this.subtitle,
    required this.lifePct,
  });

  Color get _lifeColor {
    if (lifePct >= 90) return const Color(0xFF16A34A);
    if (lifePct >= 70) return const Color(0xFF4ADE80);
    if (lifePct >= 50) return const Color(0xFF84CC16);
    if (lifePct >= 30) return const Color(0xFFEAB308);
    if (lifePct >= 10) return const Color(0xFFF97316);
    return const Color(0xFFDC2626);
  }

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF7C3AED); // purple accent for retreading
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.autorenew_rounded, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tyreNumber,
                  style: KTTextStyles.body.copyWith(
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none,
                  ),
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _lifeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${lifePct.toStringAsFixed(0)}% life',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: _lifeColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Helper rows ───────────────────────────────────────────────────────────────

class _EmptyRow extends StatelessWidget {
  final String message;
  const _EmptyRow({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      alignment: Alignment.center,
      child: Text(
        message,
        style: KTTextStyles.labelSmall.copyWith(
          color: KTColors.textMuted,
          decoration: TextDecoration.none,
        ),
      ),
    );
  }
}

class _ErrorRow extends StatelessWidget {
  final String message;
  const _ErrorRow({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.danger.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: KTColors.danger, size: 16),
          const SizedBox(width: 8),
          Text(
            message,
            style:
                KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }
}
