import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

class KTEmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? lottieAsset; // kept for API compatibility, ignored
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;

  const KTEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    this.lottieAsset,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: KTColors.darkElevated,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ?? Icons.inbox_outlined,
                size: 40,
                color: KTColors.textMuted,
              ),
            ),
            const SizedBox(height: 16),
            Text(title, style: KTTextStyles.h2, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(subtitle, style: KTTextStyles.body.copyWith(color: Colors.grey[600]), textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(onPressed: onAction, child: Text(actionLabel!)),
            ]
          ],
        ),
      ),
    );
  }
}