import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import '../theme/kt_text_styles.dart';

class KTEmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? lottieAsset;
  final String? actionLabel;
  final VoidCallback? onAction;

  const KTEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    this.lottieAsset,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (lottieAsset != null) Lottie.asset(lottieAsset!, height: 150),
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