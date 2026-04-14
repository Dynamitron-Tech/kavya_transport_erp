import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';

const Color _accent = Color(0xFF0F766E);

class TyreInspectionsScreen extends ConsumerWidget {
  const TyreInspectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Search bar placeholder
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Row(
              children: [
                const Icon(Icons.search, color: KTColors.textMuted, size: 18),
                const SizedBox(width: 10),
                Text(
                  'Search vehicle or tyre ID…',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Status filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterChip(label: 'All', selected: true),
                const SizedBox(width: 8),
                _FilterChip(label: 'Pending'),
                const SizedBox(width: 8),
                _FilterChip(label: 'In Progress'),
                const SizedBox(width: 8),
                _FilterChip(label: 'Completed'),
                const SizedBox(width: 8),
                _FilterChip(label: 'Flagged'),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Placeholder cards
          _InspectionCard(
            vehicleReg: 'TN 01 AB 1234',
            tyreCount: 6,
            inspector: 'Self',
            status: 'Pending',
            date: 'Today, 09:00',
            statusColor: KTColors.warning,
          ),
          const SizedBox(height: 10),
          _InspectionCard(
            vehicleReg: 'KA 05 MN 7890',
            tyreCount: 10,
            inspector: 'Self',
            status: 'In Progress',
            date: 'Today, 11:30',
            statusColor: _accent,
          ),
          const SizedBox(height: 10),
          _InspectionCard(
            vehicleReg: 'MH 12 PQ 3456',
            tyreCount: 6,
            inspector: 'Self',
            status: 'Completed',
            date: 'Yesterday',
            statusColor: KTColors.success,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: _accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Inspection'),
        onPressed: () {
          // TODO: navigate to new inspection form
        },
      ),
    );
  }
}

// ─── Filter chip ───────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;

  const _FilterChip({required this.label, this.selected = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: selected ? _accent : KTColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: selected ? _accent : KTColors.borderColor,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected ? Colors.white : KTColors.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─── Inspection card ───────────────────────────────────────────────────────────

class _InspectionCard extends StatelessWidget {
  final String vehicleReg;
  final int tyreCount;
  final String inspector;
  final String status;
  final String date;
  final Color statusColor;

  const _InspectionCard({
    required this.vehicleReg,
    required this.tyreCount,
    required this.inspector,
    required this.status,
    required this.date,
    required this.statusColor,
  });

  @override
  Widget build(BuildContext context) {
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
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.tire_repair_rounded, color: statusColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  vehicleReg,
                  style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$tyreCount tyres · $date',
                  style: KTTextStyles.labelSmall
                      .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: statusColor,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
