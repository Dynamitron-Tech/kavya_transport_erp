import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);
const Color _accentBg = Color(0xFFF0FDFA);

// ─── Stats provider ────────────────────────────────────────────────────────────

final tyreDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  try {
    final res = await api.get('/tyres/dashboard');
    final data = (res is Map) ? res['data'] ?? res : res;
    return (data is Map<String, dynamic>) ? data : <String, dynamic>{};
  } catch (_) {
    return <String, dynamic>{};
  }
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class TyreDashboardScreen extends ConsumerWidget {
  const TyreDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(tyreDashboardProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: RefreshIndicator(
        color: _accent,
        onRefresh: () async => ref.invalidate(tyreDashboardProvider),
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
              statsAsync.when(
                loading: () => _statsGrid(_fallbackStats()),
                error: (_, __) => _statsGrid(_fallbackStats()),
                data: (d) => _statsGrid({
                  'total_inspections': d['total_inspections'] ?? 0,
                  'due_today': d['due_today'] ?? 0,
                  'flagged': d['flagged'] ?? 0,
                  'replaced_this_month': d['replaced_this_month'] ?? 0,
                }),
              ),
              const SizedBox(height: 24),

              // ── Today's queue placeholder ────────────────────────────────
              _SectionLabel(
                icon: Icons.format_list_bulleted_rounded,
                label: "Today's Inspection Queue",
              ),
              const SizedBox(height: 10),
              _QueueCard(
                vehicleReg: 'TN 01 AB 1234',
                tyrePosition: 'Front Left',
                dueLabel: 'Due now',
                urgent: true,
              ),
              const SizedBox(height: 8),
              _QueueCard(
                vehicleReg: 'TN 05 CD 5678',
                tyrePosition: 'Rear Right',
                dueLabel: 'Due today',
                urgent: false,
              ),
              const SizedBox(height: 8),
              _QueueCard(
                vehicleReg: 'KA 09 EF 3456',
                tyrePosition: 'All tyres — full check',
                dueLabel: 'Scheduled',
                urgent: false,
              ),
              const SizedBox(height: 24),

              // ── Alerts ───────────────────────────────────────────────────
              _SectionLabel(
                icon: Icons.warning_amber_rounded,
                label: 'Flagged Tyres',
              ),
              const SizedBox(height: 10),
              _AlertCard(
                message:
                    'TN01AB1234 — Front Left tyre pressure critically low (18 PSI)',
                severity: _AlertLevel.high,
              ),
              const SizedBox(height: 8),
              _AlertCard(
                message: 'MH12AB5678 — Tread depth below minimum on all rear tyres',
                severity: _AlertLevel.medium,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Map<String, dynamic> _fallbackStats() => {
        'total_inspections': 0,
        'due_today': 0,
        'flagged': 0,
        'replaced_this_month': 0,
      };

  Widget _statsGrid(Map<String, dynamic> data) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      childAspectRatio: 1.6,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _StatTile(
          label: 'Total Inspections',
          value: '${data['total_inspections']}',
          icon: Icons.fact_check_outlined,
          color: _accent,
        ),
        _StatTile(
          label: 'Due Today',
          value: '${data['due_today']}',
          icon: Icons.today_outlined,
          color: KTColors.warning,
        ),
        _StatTile(
          label: 'Flagged',
          value: '${data['flagged']}',
          icon: Icons.flag_outlined,
          color: KTColors.danger,
        ),
        _StatTile(
          label: 'Replaced (month)',
          value: '${data['replaced_this_month']}',
          icon: Icons.autorenew_rounded,
          color: KTColors.info,
        ),
      ],
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

// ─── Queue Card ────────────────────────────────────────────────────────────────

class _QueueCard extends StatelessWidget {
  final String vehicleReg;
  final String tyrePosition;
  final String dueLabel;
  final bool urgent;

  const _QueueCard({
    required this.vehicleReg,
    required this.tyrePosition,
    required this.dueLabel,
    required this.urgent,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = urgent ? KTColors.danger : _accent;
    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: urgent
              ? KTColors.danger.withValues(alpha: 0.3)
              : KTColors.borderColor,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.tire_repair_rounded, color: statusColor, size: 20),
        ),
        title: Text(
          vehicleReg,
          style: KTTextStyles.body.copyWith(
            color: KTColors.textHeading,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.none,
          ),
        ),
        subtitle: Text(
          tyrePosition,
          style: KTTextStyles.labelSmall.copyWith(
            color: KTColors.textMuted,
            decoration: TextDecoration.none,
          ),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            dueLabel,
            style: TextStyle(
              color: statusColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Alert Card ────────────────────────────────────────────────────────────────

enum _AlertLevel { high, medium }

class _AlertCard extends StatelessWidget {
  final String message;
  final _AlertLevel severity;

  const _AlertCard({required this.message, required this.severity});

  @override
  Widget build(BuildContext context) {
    final color =
        severity == _AlertLevel.high ? KTColors.danger : KTColors.warning;
    final icon =
        severity == _AlertLevel.high ? Icons.error_outline : Icons.warning_amber_outlined;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textBody,
                decoration: TextDecoration.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
