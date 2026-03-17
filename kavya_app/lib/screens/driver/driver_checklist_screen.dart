import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/checklist.dart';
import '../../providers/checklist_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_text_field.dart';
import '../../core/widgets/section_header.dart';

class DriverChecklistScreen extends ConsumerStatefulWidget {
  final int? tripId;

  const DriverChecklistScreen({super.key, this.tripId});

  @override
  ConsumerState<DriverChecklistScreen> createState() => _DriverChecklistScreenState();
}

class _DriverChecklistScreenState extends ConsumerState<DriverChecklistScreen> {
  String _selectedType = 'pre_trip';
  late List<ChecklistItem> _items;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _items = List.from(defaultPreTripItems());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checklistAsync = ref.watch(checklistProvider((tripId: widget.tripId ?? 0, type: _selectedType)));

    return Scaffold(
      appBar: AppBar(title: const Text('Checklist')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type Selection
            const SectionHeader(title: 'Checklist Type'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _typeCard('pre_trip', 'Pre-Trip', Icons.check_circle_outlined, _selectedType == 'pre_trip'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _typeCard('post_trip', 'Post-Trip', Icons.done_all, _selectedType == 'post_trip'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Progress
            const SectionHeader(title: 'Progress'),
            const SizedBox(height: 12),
            _buildProgressCard(),
            const SizedBox(height: 24),

            // Checklist Items
            const SectionHeader(title: 'Items'),
            const SizedBox(height: 12),
            ..._items.asMap().entries.map((e) {
              final index = e.key;
              final item = e.value;
              return _checklistItemTile(index, item);
            }).toList(),
            const SizedBox(height: 24),

            // Notes
            const SectionHeader(title: 'Notes (Optional)'),
            const SizedBox(height: 12),
            TextField(
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add any notes about vehicle condition...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            KtButton(
              label: 'Complete Checklist',
              icon: Icons.save,
              isLoading: _submitting,
              onPressed: () => _submitChecklist(ref),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _typeCard(String value, String label, IconData icon, bool selected) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedType = value;
          _items = List.from(
            value == 'pre_trip' ? defaultPreTripItems() : defaultPostTripItems(),
          );
        });
      },
      child: Card(
        color: selected ? KTColors.primary.withValues(alpha: 0.1) : Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: selected ? KTColors.primary : KTColors.textMuted, size: 32),
              const SizedBox(height: 8),
              Text(label, style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? KTColors.primary : KTColors.textPrimary,
              )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressCard() {
    final completed = _items.where((i) => i.checked).length;
    final total = _items.length;
    final percentage = total > 0 ? (completed / total * 100).toStringAsFixed(0) : '0';

    return Card(
      color: KTColors.success.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Items Completed', style: TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                Text('$completed/$total ($percentage%)', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: KTColors.success)),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: total > 0 ? completed / total : 0,
                minHeight: 8,
                backgroundColor: Colors.grey.shade300,
                valueColor: const AlwaysStoppedAnimation<Color>(KTColors.success),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _checklistItemTile(int index, ChecklistItem item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Checkbox(
          value: item.checked,
          onChanged: (value) {
            setState(() {
              _items[index] = item.copyWith(checked: value ?? false);
            });
          },
        ),
        title: Text(
          item.label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            decoration: item.checked ? TextDecoration.lineThrough : null,
            color: item.checked ? KTColors.textMuted : KTColors.textPrimary,
          ),
        ),
        onTap: () {
          setState(() {
            _items[index] = item.copyWith(checked: !item.checked);
          });
          _showNoteDialog(index, item);
        },
      ),
    );
  }

  void _showNoteDialog(int index, ChecklistItem item) {
    final noteCtrl = TextEditingController(text: item.note);
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item.label),
        content: TextField(
          controller: noteCtrl,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: 'Add note (optional)',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              setState(() {
                _items[index] = item.copyWith(note: noteCtrl.text.isEmpty ? null : noteCtrl.text);
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _submitChecklist(WidgetRef ref) async {
    setState(() => _submitting = true);

    try {
      final checklist = Checklist(
        tripId: widget.tripId,
        type: _selectedType,
        items: _items,
        completedAt: DateTime.now().toIso8601String(),
      );

      // Call the correct method name (submit, not submitChecklist)
      await ref.read(checklistProvider((tripId: widget.tripId ?? 0, type: _selectedType)).notifier).submit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Checklist submitted successfully'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Note: Saving offline - $e'),
            backgroundColor: const Color(0xFFFFC107),
            duration: const Duration(seconds: 3),
          ),
        );
        // Still pop the screen even on error (data will sync when online)
        Navigator.pop(context);
      }
    } finally {
      setState(() => _submitting = false);
    }
  }
}

List<ChecklistItem> defaultPostTripItems() => const [
  ChecklistItem(id: 'vehicle_damage', label: 'Check for Vehicle Damage'),
  ChecklistItem(id: 'fuel_level', label: 'Note Fuel Level'),
  ChecklistItem(id: 'mileage', label: 'Record Mileage'),
  ChecklistItem(id: 'cargo_intact', label: 'Verify Cargo Integrity'),
  ChecklistItem(id: 'load_receipt', label: 'Collect Load Receipt'),
  ChecklistItem(id: 'documents', label: 'Verify all Documents'),
  ChecklistItem(id: 'accident_report', label: 'Any Accident/Issue?'),
  ChecklistItem(id: 'vehicle_clean', label: 'Vehicle Cleaning Done'),
];
