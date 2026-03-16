import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

class KTErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const KTErrorState({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
            const SizedBox(height: 16),
            Text("Something went wrong", style: KTTextStyles.h3),
            const SizedBox(height: 8),
            Text(message, style: KTTextStyles.body.copyWith(color: Colors.grey[600]), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text("Retry"),
            )
          ],
        ),
      ),
    );
  }
}