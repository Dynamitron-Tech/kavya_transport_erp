import 'package:flutter/material.dart';
import '../theme/kt_text_styles.dart';

class KTStatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const KTStatusBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        label.toUpperCase(),
        style: KTTextStyles.label.copyWith(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}