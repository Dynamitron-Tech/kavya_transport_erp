import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';

const Color _accent = Color(0xFF0F766E);

class TyreHistoryScreen extends ConsumerWidget {
  const TyreHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: _mockHistory.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = _mockHistory[index];
          return _HistoryCard(item: item);
        },
      ),
    );
  }

  static final List<Map<String, dynamic>> _mockHistory = [
    {
      'vehicleReg': 'TN 01 AB 1234',
      'action': 'Tyre replaced — Front Left',
      'date': 'Apr 14, 2026',
      'type': 'replacement',
    },
    {
      'vehicleReg': 'KA 05 MN 7890',
      'action': 'Pressure check — all tyres',
      'date': 'Apr 13, 2026',
      'type': 'inspection',
    },
    {
      'vehicleReg': 'MH 12 PQ 3456',
      'action': 'Tread depth flagged — rear tyres',
      'date': 'Apr 13, 2026',
      'type': 'flag',
    },
    {
      'vehicleReg': 'AP 28 RX 9012',
      'action': 'Full tyre inspection — passed',
      'date': 'Apr 12, 2026',
      'type': 'inspection',
    },
    {
      'vehicleReg': 'TN 01 AB 1234',
      'action': 'Pressure corrected — Rear Right',
      'date': 'Apr 11, 2026',
      'type': 'service',
    },
  ];
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> item;

  const _HistoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final type = item['type'] as String;
    final color = _colorForType(type);
    final icon = _iconForType(type);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['vehicleReg'] as String,
                  style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item['action'] as String,
                  style: KTTextStyles.labelSmall
                      .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
                ),
              ],
            ),
          ),
          Text(
            item['date'] as String,
            style: KTTextStyles.labelSmall
                .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'replacement':
        return KTColors.info;
      case 'flag':
        return KTColors.danger;
      case 'service':
        return KTColors.warning;
      default:
        return _accent;
    }
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'replacement':
        return Icons.autorenew_rounded;
      case 'flag':
        return Icons.flag_rounded;
      case 'service':
        return Icons.build_outlined;
      default:
        return Icons.fact_check_outlined;
    }
  }
}
