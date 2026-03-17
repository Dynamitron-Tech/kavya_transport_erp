import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';

class SyncStatusBadge extends StatelessWidget {
  final int pendingCount;

  const SyncStatusBadge({super.key, required this.pendingCount});

  @override
  Widget build(BuildContext context) {
    if (pendingCount == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: KTColors.accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.sync, size: 14, color: KTColors.accent),
          const SizedBox(width: 4),
          Text(
            '$pendingCount pending',
            style: const TextStyle(fontSize: 12, color: KTColors.accent, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
