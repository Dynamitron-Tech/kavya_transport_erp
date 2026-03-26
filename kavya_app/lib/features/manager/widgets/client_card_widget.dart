import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

double _safeDouble(dynamic v) {
  if (v == null) return 0.0;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0.0;
}

class ClientCardWidget extends StatelessWidget {
  final Map<String, dynamic> client;
  const ClientCardWidget({super.key, required this.client});

  @override
  Widget build(BuildContext context) {
    final name = client['name'] ?? '—';
    final gstin = client['gstin'] ?? '';
    final status = client['status'] ?? 'ACTIVE';
    final creditLimit = _safeDouble(client['credit_limit']);
    final outstanding = _safeDouble(client['outstanding_amount']);
    final isOverdue = status.toString().toUpperCase() == 'OVERDUE';
    final utilisation = creditLimit > 0 ? (outstanding / creditLimit).clamp(0.0, 1.0) : 0.0;
    final initials = name.split(' ').take(2).map((w) => w.isNotEmpty ? w[0] : '').join().toUpperCase();

    return InkWell(
      onTap: () => context.push('/manager/clients/${client['id']}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
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
                CircleAvatar(
                  radius: 20,
                  backgroundColor: KTColors.info.withOpacity(0.2),
                  child: Text(initials, style: TextStyle(color: KTColors.info, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(name, style: KTTextStyles.h3.copyWith(color: KTColors.textHeading))),
                          _ClientStatusPill(status: status.toString()),
                        ],
                      ),
                      if (gstin.isNotEmpty)
                        Text(gstin, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Credit limit: ₹${_fmt(creditLimit)} · Used: ₹${_fmt(outstanding)}',
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: utilisation,
                minHeight: 6,
                backgroundColor: KTColors.borderColor,
                valueColor: AlwaysStoppedAnimation(
                  utilisation > 0.8 ? KTColors.danger : (utilisation > 0.5 ? KTColors.warning : KTColors.success),
                ),
              ),
            ),
            if (isOverdue) ...[
              const SizedBox(height: 8),
              Text('Overdue', style: TextStyle(color: KTColors.danger, fontSize: 12, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Flexible(
                  child: OutlinedButton(
                    onPressed: () => context.go('/manager/jobs'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: KTColors.info,
                      side: BorderSide(color: KTColors.info.withOpacity(0.5)),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Jobs', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      foregroundColor: KTColors.textMuted,
                      side: BorderSide(color: KTColors.borderColor),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Statement', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(double val) {
    if (val >= 100000) return '${(val / 100000).toStringAsFixed(1)}L';
    if (val >= 1000) return '${(val / 1000).toStringAsFixed(0)},${(val.toInt() % 1000).toString().padLeft(3, '0')}';
    return val.toStringAsFixed(0);
  }
}

class _ClientStatusPill extends StatelessWidget {
  final String status;
  const _ClientStatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final upper = status.toUpperCase();
    final (Color bg, Color fg, String label) = switch (upper) {
      'ACTIVE' => (KTColors.success.withOpacity(0.15), KTColors.success, 'Active'),
      'OVERDUE' => (KTColors.danger.withOpacity(0.15), KTColors.danger, 'Overdue'),
      _ => (Colors.grey.withOpacity(0.15), Colors.grey, 'Inactive'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
