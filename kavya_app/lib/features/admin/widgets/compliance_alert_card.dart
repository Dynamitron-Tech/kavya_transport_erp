import 'package:flutter/material.dart';
import '../../../core/theme/kt_colors.dart';

/// Individual compliance alert card.
class ComplianceAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  final VoidCallback? onAction;
  final VoidCallback? onDetail;

  const ComplianceAlertCard({
    super.key,
    required this.alert,
    this.onAction,
    this.onDetail,
  });

  Color _severityColor(String severity) {
    switch (severity) {
      case 'CRITICAL':
        return KTColors.danger;
      case 'URGENT':
        return KTColors.amber600;
      case 'WARNING':
        return const Color(0xFFFBBF24);
      default:
        return Colors.grey;
    }
  }

  String _actionLabel() {
    final cat = alert['category'] as String? ?? '';
    if (cat.startsWith('VEHICLE_')) return 'Renew';
    if (cat == 'DRIVER_LICENSE') return 'Remind driver';
    if (cat == 'GST') return 'View GST report';
    return 'Details';
  }

  @override
  Widget build(BuildContext context) {
    final severity = alert['severity'] as String? ?? 'WARNING';
    final color = _severityColor(severity);
    final days = alert['days_until_due'] as int? ?? 0;
    final cat = alert['category'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
            Container(width: 3, color: color),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            alert['title'] as String? ?? '',
                            style: const TextStyle(
                              color: KTColors.textHeading,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: color.withAlpha(25),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            severity,
                            style: TextStyle(
                                color: color,
                                fontSize: 10,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      alert['description'] as String? ?? '',
                      style: const TextStyle(
                          color: KTColors.textMuted, fontSize: 12),
                    ),
                    if (days < 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Expired ${-days} days ago',
                          style: const TextStyle(
                              color: KTColors.danger, fontSize: 11),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _ActionBtn(label: _actionLabel(), onTap: onAction),
                        if (cat.startsWith('VEHICLE_') ||
                            cat == 'DRIVER_LICENSE') ...[
                          const SizedBox(width: 8),
                          _ActionBtn(label: 'Details', onTap: onDetail),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  const _ActionBtn({required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: KTColors.lightBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: KTColors.borderColor, width: 0.5),
        ),
        child: Text(label,
            style: const TextStyle(
                color: KTColors.textHeading,
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      ),
    );
  }
}
