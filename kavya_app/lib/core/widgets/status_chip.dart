import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';

class StatusChip extends StatelessWidget {
  final String label;

  const StatusChip({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors(label.toLowerCase());
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }

  (Color, Color) _colors(String s) {
    if (s.contains('complet') || s.contains('deliver') || s == 'paid') {
      return (KTColors.success.withValues(alpha: 0.12), KTColors.success);
    }
    if (s.contains('transit') || s.contains('start') || s.contains('loading')) {
      return (KTColors.info.withValues(alpha: 0.12), KTColors.info);
    }
    if (s.contains('cancel') || s.contains('reject')) {
      return (KTColors.error.withValues(alpha: 0.12), KTColors.error);
    }
    if (s.contains('pending') || s.contains('schedul')) {
      return (KTColors.warning.withValues(alpha: 0.12), KTColors.warning);
    }
    return (KTColors.border, KTColors.textSecondary);
  }
}
