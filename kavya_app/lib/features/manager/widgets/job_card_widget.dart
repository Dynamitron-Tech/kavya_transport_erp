import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

class JobCardWidget extends StatelessWidget {
  final Map<String, dynamic> job;
  final bool useLightTheme;
  const JobCardWidget({super.key, required this.job, this.useLightTheme = false});

  @override
  Widget build(BuildContext context) {
    final status = (job['status'] as String?) ?? '';
    final jobNumber = job['job_number'] ?? '';
    final clientName = job['client_name'] ?? job['client']?['name'] ?? '—';
    final origin = job['origin_city'] ?? '';
    final destination = job['destination_city'] ?? '';
    final weight = job['quantity'] ?? job['weight'] ?? '';
    final weightDisplay = weight == '' ? '' : (double.tryParse(weight.toString()) ?? 0.0).toInt().toString();
    final freight = job['total_amount'] ?? job['freight_amount'] ?? 0;
    final vehicleReg = job['vehicle_reg'] ?? job['vehicle']?['registration_number'];
    final driverName = job['driver_name'] ?? job['driver']?['name'];

    final cardBg = useLightTheme ? KTColors.surface : KTColors.surface;
    final borderCol = useLightTheme ? KTColors.borderColor : KTColors.borderColor;
    final titleCol = useLightTheme ? KTColors.textHeading : KTColors.textHeading;
    final subCol = useLightTheme ? KTColors.textMuted : KTColors.textMuted;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderCol),
        boxShadow: useLightTheme
            ? const [BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2))]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(jobNumber, style: KTTextStyles.h3.copyWith(color: titleCol)),
              ),
              _StatusPill(status: status),
            ],
          ),
          const SizedBox(height: 4),
          Text(clientName, style: KTTextStyles.bodySmall.copyWith(color: subCol)),
          const SizedBox(height: 4),
          Text(
            '$origin → $destination · ${weightDisplay}T · ₹${_formatAmount(freight)}',
            style: KTTextStyles.bodySmall.copyWith(color: subCol),
          ),
          if (vehicleReg != null || driverName != null) ...[
            const SizedBox(height: 4),
            Text(
              [if (vehicleReg != null) vehicleReg, if (driverName != null) driverName].join(' · '),
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.info),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _ActionButtons(job: job, status: status, useLightTheme: useLightTheme),
            ],
          ),
        ],
      ),
    );
  }

  String _formatAmount(dynamic amount) {
    final num val = (amount is num) ? amount : (num.tryParse(amount.toString()) ?? 0);
    if (val >= 100000) return '${(val / 100000).toStringAsFixed(1)}L';
    if (val >= 1000) return '${(val / 1000).toStringAsFixed(0)},${(val % 1000).toStringAsFixed(0).padLeft(3, '0')}';
    return val.toStringAsFixed(0);
  }
}

class _ActionButtons extends StatelessWidget {
  final Map<String, dynamic> job;
  final String status;
  final bool useLightTheme;
  const _ActionButtons({required this.job, required this.status, this.useLightTheme = false});

  @override
  Widget build(BuildContext context) {
    final jobId = job['id'];
    final muteCol = useLightTheme ? KTColors.textMuted : KTColors.textMuted;
    switch (status.toUpperCase()) {
      case 'DRAFT':
      case 'PENDING_APPROVAL':
      case 'APPROVED':
        return Row(children: [
          _ActionBtn(label: 'Assign', color: KTColors.managerAccent, onTap: () => context.push('/manager/jobs/$jobId/assign')),
          const SizedBox(width: 8),
          _ActionBtn(label: 'Edit', color: muteCol, onTap: () => context.push('/manager/jobs/$jobId')),
        ]);
      case 'IN_TRANSIT':
      case 'IN_PROGRESS':
      case 'STARTED':
        return Row(children: [
          _ActionBtn(label: 'Track', color: KTColors.info, onTap: () => context.push('/manager/fleet')),
          const SizedBox(width: 8),
          _ActionBtn(label: 'Details', color: muteCol, onTap: () => context.push('/manager/jobs/$jobId')),
        ]);
      case 'DELIVERED':
      case 'POD_UPLOADED':
      case 'COMPLETED':
        return Row(children: [
          _ActionBtn(label: 'View P&L', color: KTColors.success, onTap: () => context.push('/manager/jobs/$jobId')),
          const SizedBox(width: 8),
          _ActionBtn(label: 'Invoice', color: muteCol, onTap: () {}),
        ]);
      default:
        return Row(children: [
          _ActionBtn(label: 'View', color: muteCol, onTap: () => context.push('/manager/jobs/$jobId')),
        ]);
    }
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.5)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, String label) = _statusStyle(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  (Color, Color, String) _statusStyle(String s) {
    switch (s.toUpperCase()) {
      case 'DRAFT':
      case 'PENDING_APPROVAL':
      case 'APPROVED':
        return (KTColors.managerAccent.withValues(alpha: 0.15), KTColors.managerAccent, 'Unassigned');
      case 'IN_TRANSIT':
      case 'IN_PROGRESS':
      case 'STARTED':
        return (KTColors.info.withValues(alpha: 0.15), KTColors.info, 'In transit');
      case 'DELIVERED':
      case 'POD_UPLOADED':
      case 'COMPLETED':
        return (KTColors.success.withValues(alpha: 0.15), KTColors.success, 'Delivered');
      case 'TRIP_CREATED':
      case 'DOCUMENTATION':
        return (const Color(0xFF8B5CF6).withValues(alpha: 0.15), const Color(0xFF8B5CF6), 'LR created');
      case 'CLOSED':
        return (Colors.grey.withValues(alpha: 0.15), Colors.grey, 'Closed');
      case 'CANCELLED':
        return (KTColors.danger.withValues(alpha: 0.15), KTColors.danger, 'Cancelled');
      default:
        return (Colors.grey.withValues(alpha: 0.15), Colors.grey, s);
    }
  }
}
