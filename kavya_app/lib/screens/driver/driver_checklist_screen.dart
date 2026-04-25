import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
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
  final String? initialType;

  const DriverChecklistScreen({super.key, this.tripId, this.initialType});

  @override
  ConsumerState<DriverChecklistScreen> createState() => _DriverChecklistScreenState();
}

class _DriverChecklistScreenState extends ConsumerState<DriverChecklistScreen> {
  int? _selectedTripId;
  String? _selectedTripNumber;
  final String _selectedType = 'checklist';
  late List<ChecklistItem> _items;
  bool _submitting = false;
  final TextEditingController _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _items = List.from(defaultPreTripItems());
    if (widget.tripId != null && widget.tripId! > 0) {
      _selectedTripId = widget.tripId;
      _selectedTripNumber = 'Trip #${widget.tripId}';
    }
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  int get _completedCount => _items.where((i) => i.checked).length;
  bool get _allDone {
    if (_items.isEmpty) return false;
    return _items.every((i) => i.checked && i.photoPath != null);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);

    // Resolve the actual trip number if we were pre-seeded with a tripId
    if (widget.tripId != null && widget.tripId! > 0) {
      final trips = ref.watch(driverMyTripsProvider).valueOrNull;
      if (trips != null) {
        final match = trips.where((t) => t.id == widget.tripId).firstOrNull;
        if (match != null && _selectedTripNumber != match.tripNumber) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) setState(() => _selectedTripNumber = match.tripNumber);
          });
        }
      }
    }

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text(
          _selectedTripId == null ? 'Select Trip' : s.checklist,
          style: const TextStyle(color: Colors.black),
        ),
        leading: _selectedTripId != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.black),
                onPressed: () {
                  setState(() {
                    _selectedTripId = null;
                    _selectedTripNumber = null;
                    _items = List.from(defaultPreTripItems());
                    _notesCtrl.clear();
                  });
                },
              )
            : null,
        iconTheme: const IconThemeData(color: Colors.black),
        elevation: 0,
      ),
      body: _selectedTripId == null ? _buildTripPicker() : _buildChecklistForm(),
    );
  }

  Widget _buildTripPicker() {
    final myTripsAsync = ref.watch(driverMyTripsProvider);
    return myTripsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, st) => Center(
        child: Text('Error loading trips: $e',
            style: const TextStyle(color: KTColors.danger)),
      ),
      data: (trips) {
        final activeTrips = trips.where((t) => t.isActive).toList();
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
                        color: KTColors.textHeading),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'You have no active trips to fill a checklist for.',
                    style: TextStyle(fontSize: 14, color: KTColors.textBody),
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
          color: KTColors.lightBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: KTColors.driverAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.local_shipping_rounded,
                  color: KTColors.driverAccent, size: 22),
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
                        color: KTColors.textHeading),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${trip.origin} → ${trip.destination}',
                    style: const TextStyle(
                        fontSize: 13, color: KTColors.textBody),
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
        color = KTColors.driverAccent;
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
    final existingAsync = _selectedTripId != null
        ? ref.watch(checklistProvider((tripId: _selectedTripId!, type: _selectedType)))
        : null;
    final alreadyCompleted = existingAsync?.valueOrNull?.completedAt != null;
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
                color: KTColors.driverAccent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.driverAccent.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_outlined,
                      color: KTColors.driverAccent, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Trip: $_selectedTripNumber',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: KTColors.driverAccent),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

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
              color: KTColors.lightBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: TextField(
              controller: _notesCtrl,
              maxLines: 3,
              style: const TextStyle(color: KTColors.textHeading, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Add any notes about vehicle condition...',
                hintStyle: TextStyle(color: KTColors.textMuted, fontSize: 14),
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // Submit Button — blocked if already completed
          if (alreadyCompleted)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
              decoration: BoxDecoration(
                color: KTColors.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: KTColors.success.withValues(alpha: 0.4)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, color: KTColors.success, size: 20),
                  SizedBox(width: 10),
                  Text(
                    'Checklist already submitted',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: KTColors.success,
                    ),
                  ),
                ],
              ),
            )
          else
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



  Widget _buildProgressCard() {
    final total = _items.length;
    final completed = _completedCount;
    final percentage = total > 0 ? (completed / total * 100).toStringAsFixed(0) : '0';
    final progress = total > 0 ? completed / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.lightBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Items Completed', style: TextStyle(fontSize: 13, color: KTColors.textBody)),
              Text(
                '$completed/$total ($percentage%)',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _allDone ? KTColors.success : KTColors.driverAccent,
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
              backgroundColor: KTColors.borderColor,
              valueColor: AlwaysStoppedAnimation<Color>(_allDone ? KTColors.success : KTColors.driverAccent),
            ),
          ),
        ],
      ),
    );
  }

  Widget _checklistItemTile(int index, ChecklistItem item) {
    final hasPhoto = item.photoPath != null;
    final isDone = item.checked;
    const isPreTrip = true;
    // For pre-trip: photo required before marking done
    final canMarkDone = !isPreTrip || hasPhoto;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDone
            ? KTColors.success.withValues(alpha: 0.08)
            : KTColors.lightBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDone ? KTColors.success.withValues(alpha: 0.4) : KTColors.borderColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
            child: Row(
              children: [
                // Label
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDone ? KTColors.textBody : KTColors.textHeading,
                      decoration: isDone ? TextDecoration.lineThrough : null,
                      decorationColor: KTColors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Camera button (pre-trip only)
                if (isPreTrip)
                  GestureDetector(
                    onTap: isDone
                        ? null
                        : () async {
                            final picker = ImagePicker();
                            final xfile = await picker.pickImage(
                              source: ImageSource.camera,
                              imageQuality: 75,
                              maxWidth: 1280,
                            );
                            if (xfile != null) {
                              setState(() {
                                _items[index] = item.copyWith(
                                  photoPath: xfile.path,
                                  checked: true,
                                );
                              });
                            }
                          },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                      decoration: BoxDecoration(
                        color: hasPhoto
                            ? KTColors.success.withValues(alpha: 0.12)
                            : KTColors.driverAccent.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: hasPhoto ? KTColors.success : KTColors.driverAccent,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            hasPhoto ? Icons.photo_camera : Icons.camera_alt_outlined,
                            size: 15,
                            color: hasPhoto ? KTColors.success : KTColors.driverAccent,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            hasPhoto ? 'Retake' : 'Photo',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: hasPhoto ? KTColors.success : KTColors.driverAccent,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                // DONE button
                Opacity(
                  opacity: canMarkDone ? 1.0 : 0.35,
                  child: GestureDetector(
                    onTap: !canMarkDone
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: const Row(children: [
                                  Icon(Icons.camera_alt, color: Colors.white, size: 16),
                                  SizedBox(width: 8),
                                  Text('Capture a photo first'),
                                ]),
                                backgroundColor: KTColors.warning,
                                behavior: SnackBarBehavior.floating,
                                duration: const Duration(seconds: 2),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                            );
                          }
                        : () {
                            setState(() {
                              _items[index] = item.copyWith(checked: !isDone);
                            });
                          },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
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
                ),
              ],
            ),
          ),
          // Photo preview thumbnail
          if (isPreTrip && hasPhoto)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(
                  File(item.photoPath!),
                  height: 80,
                  width: double.infinity,
                  fit: BoxFit.cover,
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
      final notifier = ref.read(
          checklistProvider((tripId: _selectedTripId ?? 0, type: _selectedType)).notifier);
      // Sync the full item list (including photoPath) into the notifier before submitting
      notifier.setItems(List<ChecklistItem>.from(_items));
      notifier.setNotes(_notesCtrl.text.trim());

      // Capture GPS location
      try {
        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.whileInUse ||
            permission == LocationPermission.always) {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 10),
            ),
          );
          notifier.setLocation(position.latitude, position.longitude);
        }
      } catch (_) {
        // Location unavailable — continue without it
      }

      await notifier.submit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              const Text('Checklist completed!'),
            ]),
            backgroundColor: KTColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      // Network or server error — data is queued for retry via offline sync.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.cloud_off_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              const Text('Queued — will sync when connected'),
            ]),
            backgroundColor: KTColors.warning,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
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
