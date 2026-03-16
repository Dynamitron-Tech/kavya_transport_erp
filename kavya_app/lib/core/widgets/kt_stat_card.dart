import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

class KTStatCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subtitle;
  final Color color;
  final IconData icon;
  final double? trend;

  const KTStatCard({
    super.key,
    required this.title,
    required this.value,
    required this.color,
    required this.icon,
    this.subtitle,
    this.trend,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: color, width: 4)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: color, size: 24),
                if (trend != null)
                  Row(
                    children: [
                      Icon(
                        trend! >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                        color: trend! >= 0 ? KTColors.success : KTColors.danger,
                        size: 16,
                      ),
                      Text(
                        '${trend!.abs()}%',
                        style: KTTextStyles.label.copyWith(
                          color: trend! >= 0 ? KTColors.success : KTColors.danger,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(value, style: KTTextStyles.h2),
            Text(title, style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[500])),
            ]
          ],
        ),
      ),
    );
  }
}