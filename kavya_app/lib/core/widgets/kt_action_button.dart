import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

class KTActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? bgColor;

  const KTActionButton({super.key, required this.icon, required this.label, required this.onTap, this.iconColor, this.bgColor});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor ?? KTColors.darkElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: bgColor != null ? bgColor!.withValues(alpha: 0.4) : KTColors.darkBorder),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: iconColor ?? KTColors.primary),
            const SizedBox(height: 8),
            Text(label, style: KTTextStyles.label, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}