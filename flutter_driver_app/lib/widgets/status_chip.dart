import 'package:flutter/material.dart';
import '../../config/app_theme.dart';

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
      return (AppTheme.success.withValues(alpha: 0.12), AppTheme.success);
    }
    if (s.contains('transit') || s.contains('start') || s.contains('loading')) {
      return (AppTheme.info.withValues(alpha: 0.12), AppTheme.info);
    }
    if (s.contains('cancel') || s.contains('reject')) {
      return (AppTheme.error.withValues(alpha: 0.12), AppTheme.error);
    }
    if (s.contains('pending') || s.contains('schedul')) {
      return (AppTheme.warning.withValues(alpha: 0.12), AppTheme.warning);
    }
    return (AppTheme.border, AppTheme.textSecondary);
  }
}
