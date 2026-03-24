import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/checklist.dart';
import '../../models/trip.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/trip_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/section_header.dart';
import '../../core/localization/locale_provider.dart';

class DriverChecklistScreen extends ConsumerStatefulWidget {
  final int? tripId;

  const DriverChecklistScreen({super.key, this.tripId});

  @override
  ConsumerState<DriverChecklistScreen> createState() => _DriverChecklistScreenState();
}

class _DriverChecklistScreenState extends ConsumerState<DriverChecklistScreen> {
  int? _selectedTripId;
  String? _selectedTripNumber;
  String _selectedType = 'pre_trip';
  late List<ChecklistItem> _items;
  bool _submitting = false;
  final TextEditingController _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _items = List.from(defaultPreTripItems());
    if (widget.tripId != null && widget.tripId! > 0) {
      _selectedTripId = widget.tripId;
    }
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  int get _completedCount => _items.where((i) => i.checked).length;
  bool get _allDone => _completedCount == _items.length && _items.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);
    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        title: Text(
          _selectedTripId == null ? 'Select Trip' : s.checklist,
          style: const TextStyle(color: KTColors.textPrimary),
        ),
        leading: _selectedTripId != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textPrimary),
                onPressed: () {
                  setState(() {
                    _selectedTripId = null;
                    _selectedTripNumber = null;
                    _selectedType = 'pre_trip';
                    _items = List.from(defaultPreTripItems());
                    _notesCtrl.clear();
                  });
                },
              )
            : null,
        iconTheme: const IconThemeData(color: KTColors.textPrimary),
        elevation: 0,
      ),
      body: _selectedTripId == null ? _buildTripPicker() : _buildChecklistForm(),
    );
  }

  Widget _buildTripPicker() {
    final paginatedAsync = ref.watch(tripsPaginatedProvider);
    return paginatedAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, st) => Center(
        child: Text('Error loading trips: $e',
            style: const TextStyle(color: KTColors.danger)),
      ),
      data: (paginated) {
        final activeTrips = paginated.items.where((t) => t.isActive).toList();
        if (activeTrips.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.directions_car_outlined,
                      size: 64, color: KTColors.textMuted),
                  const SizedBox(height: 16),
                  const Text(
                    'No Active Trips',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: KTColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'You have no active trips to fill a checklist for.',
                    style: TextStyle(fontSize: 14, color: KTColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: activeTrips.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (ctx, i) => _tripCard(activeTrips[i]),
        );
      },
    );
  }

  Widget _tripCard(Trip trip) {
    return GestureDetector(
      onTap: () => setState(() {
        _selectedTripId = trip.id;
        _selectedTripNumber = trip.tripNumber;
      }),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.darkElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.darkBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: KTColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.local_shipping_rounded,
                  color: KTColors.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trip.tripNumber,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: KTColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${trip.origin} → ${trip.destination}',
                    style: const TextStyle(
                        fontSize: 13, color: KTColors.textSecondary),
                  ),
                ],
              ),
            ),
            _statusChip(trip.status),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, color: KTColors.textMuted),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status) {
      case 'ready':
        color = const Color(0xFF3B82F6);
        break;
      case 'started':
        color = KTColors.primary;
        break;
      case 'loading':
        color = KTColors.warning;
        break;
      case 'in_transit':
        color = KTColors.success;
        break;
      default:
        color = KTColors.textMuted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: color,
            letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildChecklistForm() {
    final s = ref.watch(sProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Trip info banner
          if (_selectedTripNumber != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: KTColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_outlined,
                      color: KTColors.primary, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Trip: $_selectedTripNumber',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: KTColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Type Selection
          SectionHeader(title: s.checklistType),
          const SizedBox(height: 12),
          _buildTypeSelector(),
          const SizedBox(height: 24),

          // Progress
          SectionHeader(title: s.progress),
          const SizedBox(height: 12),
          _buildProgressCard(),
          const SizedBox(height: 24),

          // Checklist Items
          SectionHeader(title: s.items),
          const SizedBox(height: 12),
          ..._items.asMap().entries.map((e) => _checklistItemTile(e.key, e.value)),
          const SizedBox(height: 24),

          // Notes
          SectionHeader(title: s.notesOptional),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: KTColors.darkElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.darkBorder),
            ),
            child: TextField(
              controller: _notesCtrl,
              maxLines: 3,
              style: const TextStyle(color: KTColors.textPrimary, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Add any notes about vehicle condition...',
                hintStyle: TextStyle(color: KTColors.textMuted, fontSize: 14),
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // Submit Button — only enabled when all items done
          AnimatedOpacity(
            opacity: _allDone ? 1.0 : 0.45,
            duration: const Duration(milliseconds: 250),
            child: KtButton(
              label: _allDone ? s.completeChecklist : s.completeAllItems,
              icon: Icons.save_rounded,
              isLoading: _submitting,
              onPressed: _allDone ? () => _submitChecklist(ref) : null,
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildTypeSelector() {
    return Row(
      children: [
        Expanded(child: _typeCard('pre_trip', 'Pre-Trip', Icons.check_circle_outline_rounded, _selectedType == 'pre_trip')),
        const SizedBox(width: 12),
        Expanded(child: _typeCard('post_trip', 'Post-Trip', Icons.done_all_rounded, _selectedType == 'post_trip')),
      ],
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
        decoration: BoxDecoration(
          color: selected ? KTColors.primary.withValues(alpha: 0.15) : KTColors.darkElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? KTColors.primary : KTColors.darkBorder,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: selected ? KTColors.primary : KTColors.textMuted, size: 30),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? KTColors.primary : KTColors.textSecondary,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressCard() {
    final total = _items.length;
    final completed = _completedCount;
    final percentage = total > 0 ? (completed / total * 100).toStringAsFixed(0) : '0';
    final progress = total > 0 ? completed / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.darkElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.darkBorder),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Items Completed', style: TextStyle(fontSize: 13, color: KTColors.textSecondary)),
              Text(
                '$completed/$total ($percentage%)',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _allDone ? KTColors.success : KTColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: KTColors.navy700,
              valueColor: AlwaysStoppedAnimation<Color>(_allDone ? KTColors.success : KTColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _checklistItemTile(int index, ChecklistItem item) {
    final isDone = item.checked;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDone
            ? KTColors.success.withValues(alpha: 0.08)
            : KTColors.darkElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDone ? KTColors.success.withValues(alpha: 0.4) : KTColors.darkBorder,
        ),
      ),
      child: Row(
        children: [
          // Item label
          Expanded(
            child: Text(
              item.label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isDone ? KTColors.textSecondary : KTColors.textPrimary,
                decoration: isDone ? TextDecoration.lineThrough : null,
                decorationColor: KTColors.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 12),
          // DONE button
          GestureDetector(
            onTap: () {
              setState(() {
                _items[index] = item.copyWith(checked: !isDone);
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
              decoration: BoxDecoration(
                color: isDone
                    ? KTColors.success.withValues(alpha: 0.15)
                    : KTColors.danger.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isDone ? KTColors.success : KTColors.danger,
                  width: 1.5,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isDone ? Icons.check_rounded : Icons.close_rounded,
                    size: 15,
                    color: isDone ? KTColors.success : KTColors.danger,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'DONE',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isDone ? KTColors.success : KTColors.danger,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submitChecklist(WidgetRef ref) async {
    if (!_allDone) return;
    setState(() => _submitting = true);

    try {
      // Sync local _items into provider state before submitting
      final notifier = ref.read(
          checklistProvider((tripId: _selectedTripId ?? 0, type: _selectedType)).notifier);
      for (final item in _items) {
        notifier.toggleItem(item.id, item.checked);
      }
      notifier.setNotes(_notesCtrl.text.trim());

      await notifier.submit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text('${_selectedType == 'pre_trip' ? 'Pre-trip' : 'Post-trip'} checklist completed!'),
            ]),
            backgroundColor: KTColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.cloud_off_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              const Text('Saved offline — will sync when connected'),
            ]),
            backgroundColor: KTColors.warning,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        // Still pop — offline sync will handle it
        Navigator.pop(context);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
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
