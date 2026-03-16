import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

enum AlertSeverity { high, medium, low }

class KTAlertCard extends StatelessWidget {
  final String title;
  final int count;
  final List<String> items;
  final AlertSeverity severity;
  final VoidCallback onTap;

  const KTAlertCard({
    super.key,
    required this.title,
    required this.count,
    required this.items,
    required this.severity,
    required this.onTap,
  });

  Color get _headerColor {
    switch (severity) {
      case AlertSeverity.high: return KTColors.danger;
      case AlertSeverity.medium: return KTColors.warning;
      case AlertSeverity.low: return KTColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: _headerColor.withOpacity(0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(title, style: KTTextStyles.label.copyWith(color: _headerColor)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: _headerColor, borderRadius: BorderRadius.circular(12)),
                    child: Text(count.toString(), style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text("• ", style: TextStyle(fontSize: 16)),
                      Expanded(child: Text(item, style: KTTextStyles.body)),
                    ],
                  ),
                )).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}