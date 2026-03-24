import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/trip.dart';
import '../../models/attendance.dart';
import '../../providers/trip_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/recent_activity_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/intelligence_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../services/api_service.dart';
import '../../services/notification_service.dart';

import 'package:shimmer/shimmer.dart';
import '../../core/widgets/section_header.dart';
import '../../core/localization/locale_provider.dart';
import '../../core/localization/driver_strings.dart';

class DriverTodayScreen extends ConsumerStatefulWidget {
  const DriverTodayScreen({super.key});

  @override
  ConsumerState<DriverTodayScreen> createState() => _DriverTodayScreenState();
}

class _DriverTodayScreenState extends ConsumerState<DriverTodayScreen> {
  final Set<int> _loadingTripIds = {};
  S get s => ref.read(sProvider);

  Future<void> _acceptTrip(Trip trip) async {
    setState(() => _loadingTripIds.add(trip.id));
    try {
      await ref.read(tripsPaginatedProvider.notifier).updateTripStatus(trip.id, 'ready');
      ref.invalidate(tripsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(s.tripAccepted(trip.tripNumber)),
            backgroundColor: KTColors.success,
          ),
        );
      }
      // Notify driver about the accepted trip
      NotificationService().showTripEvent(
        title: 'Congratulations! 🎉',
        body: "You're on a trip from ${trip.origin} → ${trip.destination}",
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingTripIds.remove(trip.id));
    }
  }

  Future<void> _declineTrip(Trip trip) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(s.declineTrip),
        content: Text(s.declineTripConfirm(trip.tripNumber)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(s.cancel)),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: KTColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(s.decline),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _loadingTripIds.add(trip.id));
    try {
      await ref.read(tripsPaginatedProvider.notifier).updateTripStatus(trip.id, 'vehicle_assigned');
      ref.invalidate(tripsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(s.tripDeclined(trip.tripNumber)),
            backgroundColor: KTColors.warning,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingTripIds.remove(trip.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final paginatedAsync = ref.watch(tripsPaginatedProvider);
    final attendanceAsync = ref.watch(attendanceProvider);
    final recentExpense = ref.watch(recentExpenseProvider);
    final user = ref.watch(authProvider).user;
    final s = ref.watch(sProvider);
    final driverId = int.tryParse(user?.id ?? '') ?? 0;

    // Derive active trip, pending trips, and other trips from ONE source
    final allTrips = paginatedAsync.maybeWhen(
      data: (pd) => pd.items,
      orElse: () => <Trip>[],
    );
    final activeTrip = allTrips.where((t) => t.isActive).firstOrNull;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Attendance Status Card
          attendanceAsync.when(
            data: (attendance) => _attendanceCard(context, ref, attendance),
            loading: () => Shimmer.fromColors(
              baseColor: Colors.grey.shade800,
              highlightColor: Colors.grey.shade600,
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.grey.shade800,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            error: (e, st) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Error loading attendance: $e', style: const TextStyle(color: KTColors.danger)),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ─── Driver Score Badge ───
          if (driverId > 0) _buildScoreBadge(ref, driverId),
          const SizedBox(height: 16),

          // Recent Expense Feedback Card
          if (recentExpense != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: KTColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: KTColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: KTColors.success,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.check, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Recent: Expense Added ✓',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: KTColors.success,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${recentExpense.amount.toStringAsFixed(0)} ${recentExpense.category} — just now',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    iconSize: 20,
                    onPressed: () {
                      ref.read(recentExpenseProvider.notifier).clearRecentExpense();
                    },
                    icon: const Icon(Icons.close, color: KTColors.textMuted),
                  ),
                ],
              ),
            ),
          if (recentExpense != null) const SizedBox(height: 20),
          const SizedBox(height: 20),

          // Active Trip Card
          if (activeTrip != null)
            _activeTripCard(context, activeTrip)
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.local_shipping, color: KTColors.primary.withValues(alpha: 0.5)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.noActiveTrip, style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text(s.startTripToSeeStatus, style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 20),

          // Available Trips
          SectionHeader(title: s.availableTrips),
          const SizedBox(height: 12),
          paginatedAsync.when(
            data: (paginatedData) {
              // Only show pending-acceptance and non-active/non-terminal trips
              final pendingTrips = paginatedData.items.where((t) => t.isPendingAcceptance).toList();
              final otherTrips = paginatedData.items.where((t) =>
                  !t.isPendingAcceptance &&
                  !t.isActive &&
                  t.status != 'completed' &&
                  t.status != 'cancelled').toList();
              if (pendingTrips.isEmpty && otherTrips.isEmpty) {
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.assignment, color: Colors.grey.shade400, size: 48),
                          const SizedBox(height: 12),
                          Text(s.noTripsAvailable, style: const TextStyle(color: KTColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Pending acceptance trips with Accept/Decline
                  ...pendingTrips.map((trip) => _pendingTripCard(context, trip)),
                  // Already accepted / other trips
                  ...otherTrips.map((trip) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _tripCard(context, trip),
                  )),
                ],
              );
            },
            loading: () => Column(
              children: List.generate(
                2,
                (index) => Padding(
                  padding: EdgeInsets.only(bottom: index == 1 ? 0 : 8),
                  child: Shimmer.fromColors(
                    baseColor: Colors.grey.shade800,
                    highlightColor: Colors.grey.shade600,
                    child: Container(
                      height: 100,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade800,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            error: (e, st) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Error loading trips: $e', style: const TextStyle(color: KTColors.danger)),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Quick Actions
          SectionHeader(title: s.quickActions),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.receipt_long,
                  s.addExpense,
                  () => context.push('/driver/add-expense'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.checklist,
                  s.checklist,
                  () => context.push('/driver/checklist'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.description,
                  s.documents,
                  () => context.push('/driver/documents'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.notifications_active,
                  s.notifications,
                  () => context.push('/driver/notifications'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.account_balance_wallet,
                  s.myEarnings,
                  () => context.push('/driver/settlement'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.local_shipping,
                  s.vehicle,
                  () => context.push('/driver/vehicle'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // --- SOS Button (D-08) — Always visible, 3-sec hold ---
          _SOSButton(tripId: activeTrip?.id),
        ],
      ),
    );
  }

  Widget _attendanceCard(BuildContext context, WidgetRef ref, Attendance? attendance) {
    final isCheckedIn = attendance?.checkInTime != null;
    final now = DateTime.now();
    final dateLabel =
        '${now.day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.month - 1]} ${now.year}';

    // Format check-in time for display
    String checkInDisplay = '--:--';
    if (attendance?.checkInTime != null) {
      try {
        final dt = DateTime.parse(attendance!.checkInTime!);
        final hh = dt.hour.toString().padLeft(2, '0');
        final mm = dt.minute.toString().padLeft(2, '0');
        checkInDisplay = '$hh:$mm';
      } catch (_) {
        checkInDisplay = attendance!.checkInTime!;
      }
    }

    final statusColor = isCheckedIn
        ? (attendance!.status == 'late' ? KTColors.warning : KTColors.success)
        : const Color(0xFF64748B);
    final s = ref.watch(sProvider);
    final statusLabel = isCheckedIn
        ? (attendance!.status == 'late' ? s.late_ : s.present)
        : s.notCheckedIn;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isCheckedIn
              ? [const Color(0xFF0F2A1E), const Color(0xFF1A3A2A)]
              : [const Color(0xFF0F172A), const Color(0xFF1E293B)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCheckedIn
              ? KTColors.success.withValues(alpha: 0.4)
              : const Color(0xFF334155),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Icon(
                    isCheckedIn ? Icons.how_to_reg_rounded : Icons.fingerprint_rounded,
                    color: statusColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.attendance,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        dateLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),
            const Divider(color: Color(0xFF334155), height: 1),
            const SizedBox(height: 16),

            if (isCheckedIn) ...
              [
                // Check-in details row
                Row(
                  children: [
                    _attendanceInfoTile(
                      icon: Icons.login_rounded,
                      label: s.checkInTime,
                      value: checkInDisplay,
                      color: KTColors.success,
                    ),
                    const SizedBox(width: 12),
                    _attendanceInfoTile(
                      icon: Icons.verified_user_outlined,
                      label: s.status,
                      value: attendance!.status.toUpperCase(),
                      color: statusColor,
                    ),
                    if (attendance.checkInPhotoUrl != null) ...
                      [
                        const SizedBox(width: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.memory(
                            base64Decode(
                              attendance.checkInPhotoUrl!.contains(',') ? attendance.checkInPhotoUrl!.split(',')[1] : attendance.checkInPhotoUrl!,
                            ),
                            width: 52,
                            height: 52,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.photo, color: Color(0xFF64748B), size: 20),
                            ),
                          ),
                        ),
                      ],
                  ],
                ),
              ]
            else ...
              [
                // Not checked in — show CTA
                Row(
                  children: [
                    const Icon(Icons.info_outline, color: Color(0xFF64748B), size: 16),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Take a selfie to mark your attendance for today.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _startCheckInFlow(context, ref),
                    icon: const Icon(Icons.camera_alt_rounded, size: 18),
                    label: Text(s.markAttendance),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: KTColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
          ],
        ),
      ),
    );
  }

  Widget _attendanceInfoTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            const SizedBox(height: 2),
            Text(value,
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }

  Future<void> _startCheckInFlow(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    // Open camera for selfie
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 60,
      maxWidth: 800,
    );
    if (photo == null) return;
    if (!context.mounted) return;

    // Show confirmation bottom sheet
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _AttendanceConfirmSheet(
        photoFile: File(photo.path),
        notifier: ref.read(attendanceProvider.notifier),
        onSuccess: () {
          ref.invalidate(attendanceProvider);
        },
      ),
    );
  }

  Widget _activeTripCard(BuildContext context, Trip trip) {
    final progress = _getProgressPercentage(trip.status);
    return Card(
      color: KTColors.primary.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Active Trip: ${trip.tripNumber}', style: KTTextStyles.h3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: KTColors.primary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    trip.status.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.location_on_outlined, color: KTColors.primary, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(trip.origin ?? 'Unknown', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      if (trip.destination != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('→ ${trip.destination}', style: const TextStyle(fontSize: 11, color: KTColors.textSecondary)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(value: progress, minHeight: 6),
            ),
            const SizedBox(height: 12),
            KtButton(
              label: 'View Details',
              icon: Icons.arrow_forward,
              onPressed: () => context.push('/driver/trip/${trip.id}'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pendingTripCard(BuildContext context, Trip trip) {
    final isLoading = _loadingTripIds.contains(trip.id);
    final s = ref.watch(sProvider);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            KTColors.primary.withValues(alpha: 0.12),
            KTColors.primary.withValues(alpha: 0.04),
          ],
        ),
        border: Border.all(color: KTColors.primary.withValues(alpha: 0.3), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: KTColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.local_shipping, color: KTColors.primary, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.newTripAssigned,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: KTColors.primary,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        trip.tripNumber,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: KTColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: KTColors.warning.withValues(alpha: 0.4)),
                  ),
                  child: const Text(
                    'PENDING',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: KTColors.warning,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Route Info
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: KTColors.cardSurfaceDark,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Column(
                    children: [
                      Container(
                        width: 10, height: 10,
                        decoration: BoxDecoration(
                          color: KTColors.success,
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                      Container(
                        width: 2, height: 28,
                        color: KTColors.textMuted.withValues(alpha: 0.3),
                      ),
                      Container(
                        width: 10, height: 10,
                        decoration: BoxDecoration(
                          color: KTColors.danger,
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trip.origin ?? 'Origin',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: KTColors.textPrimary),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          trip.destination ?? 'Destination',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: KTColors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (trip.startDate != null) ...[              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.calendar_today, size: 13, color: KTColors.textMuted),
                  const SizedBox(width: 6),
                  Text(_formatTripDate(trip.startDate!), style: const TextStyle(fontSize: 12, color: KTColors.textMuted)),
                ],
              ),
            ],
            const SizedBox(height: 18),

            // Accept / Decline Buttons
            if (isLoading)
              const Center(child: Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ))
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: KTColors.danger,
                        side: const BorderSide(color: KTColors.danger, width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => _declineTrip(trip),
                      label: Text(s.decline, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: KTColors.success,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.check, size: 18),
                      onPressed: () => _acceptTrip(trip),
                      label: Text(s.acceptTrip, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _tripCard(BuildContext context, Trip trip) {
    return Card(
      child: ListTile(
        leading: Icon(Icons.local_shipping_outlined, color: KTColors.primary),
        title: Text(trip.tripNumber, style: KTTextStyles.label),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text('${trip.origin} → ${trip.destination}', style: const TextStyle(fontSize: 12)),
            if (trip.startDate != null) ...[              const SizedBox(height: 4),
              Text(_formatTripDate(trip.startDate!), style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
            ],
          ],
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: _getStatusColor(trip.status).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            trip.status.replaceAll('_', ' '),
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _getStatusColor(trip.status)),
          ),
        ),
        onTap: () => context.push('/driver/trip/${trip.id}'),
      ),
    );
  }

  Widget _quickActionButton(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: KTColors.primary, size: 28),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTripDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return raw.split('T').first;
    }
  }

  double _getProgressPercentage(String status) {
    switch (status) {
      case 'pending': return 0.0;
      case 'driver_assigned': return 0.05;
      case 'ready': return 0.15;
      case 'started': return 0.25;
      case 'in_transit': return 0.5;
      case 'loading': return 0.75;
      case 'completed': return 1.0;
      default: return 0.0;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return KTColors.warning;
      case 'driver_assigned': return KTColors.warning;
      case 'ready': return KTColors.info;
      case 'started': return KTColors.info;
      case 'in_transit': return KTColors.primary;
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }

  Widget _buildScoreBadge(WidgetRef ref, int driverId) {
    final scoreAsync = ref.watch(driverScoreProvider(driverId));
    return scoreAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (data) {
        final score = (data['current_score'] as num?)?.toDouble() ?? 0;
        final tier = (data['tier'] ?? 'unknown').toString();
        final Color tierColor;
        final IconData tierIcon;
        switch (tier) {
          case 'elite':
            tierColor = KTColors.success;
            tierIcon = Icons.star;
          case 'good':
            tierColor = KTColors.primary;
            tierIcon = Icons.thumb_up;
          case 'needs_attention':
            tierColor = KTColors.warning;
            tierIcon = Icons.info_outline;
          case 'high_risk':
            tierColor = KTColors.danger;
            tierIcon = Icons.warning;
          default:
            tierColor = KTColors.textMuted;
            tierIcon = Icons.help_outline;
        }

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [tierColor.withAlpha(30), tierColor.withAlpha(10)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: tierColor.withAlpha(80)),
          ),
          child: Row(
            children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: tierColor.withAlpha(40),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    score.toStringAsFixed(0),
                    style: TextStyle(color: tierColor, fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(tierIcon, color: tierColor, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          tier.replaceAll('_', ' ').toUpperCase(),
                          style: TextStyle(color: tierColor, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text('Driver Score', style: TextStyle(color: KTColors.textMuted, fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// SOS panic button — hold for 3 seconds to trigger emergency alert.
class _SOSButton extends StatefulWidget {
  final int? tripId;
  const _SOSButton({this.tripId});
  @override
  State<_SOSButton> createState() => _SOSButtonState();
}

class _SOSButtonState extends State<_SOSButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  bool _triggered = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && !_triggered) {
        _triggered = true;
        _triggerSOS();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _triggerSOS() async {
    if (widget.tripId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No active trip. SOS requires an active trip.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
        setState(() => _triggered = false);
      }
      return;
    }

    try {
      final apiService = ApiService();
      // Attempt to get current location
      double? lat;
      double? lng;
      try {
        final position = await _getCurrentPosition();
        lat = position?.$1;
        lng = position?.$2;
      } catch (_) {
        // Location unavailable — send SOS anyway
      }

      // Reverse-geocode the coordinates into a human-readable address
      String? locationName;
      if (lat != null && lng != null) {
        locationName = await _reverseGeocode(lat, lng);
      }

      final response = await apiService.triggerSOS(
        widget.tripId!,
        latitude: lat,
        longitude: lng,
        locationName: locationName,
      );

      if (mounted) {
        // Extract details from response
        final data = (response['data'] is Map)
            ? response['data'] as Map
            : <String, dynamic>{};
        final tripNumber = data['trip_number'] ?? '';
        final driverName = data['driver_name'] ?? '';
        final vehicleReg = data['vehicle_registration'] ?? '';
        final origin = data['origin'] ?? '';
        final destination = data['destination'] ?? '';
        final ecName = data['emergency_contact_name'];
        final ecPhone = data['emergency_contact_phone'];

        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            backgroundColor: const Color(0xFF1E1B2E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: const [
                Icon(Icons.emergency, color: Color(0xFFEF4444), size: 28),
                SizedBox(width: 10),
                Text('🆘 SOS Alert Sent!',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Admin & Fleet Managers have been notified immediately.',
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
                const SizedBox(height: 16),
                _sosInfoRow(Icons.local_shipping, 'Trip', tripNumber),
                _sosInfoRow(Icons.person, 'Driver', driverName),
                _sosInfoRow(Icons.directions_car, 'Vehicle', vehicleReg),
                _sosInfoRow(Icons.route, 'Route', '$origin → $destination'),
                if (ecName != null && ecName.toString().isNotEmpty)
                  _sosInfoRow(Icons.phone_in_talk, 'Emergency Contact', '$ecName: $ecPhone'),
                if (locationName != null)
                  _sosInfoRow(Icons.location_on, 'Location', locationName)
                else if (lat != null)
                  _sosInfoRow(Icons.location_on, 'Location', '${lat.toStringAsFixed(5)}, ${lng!.toStringAsFixed(5)}'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'Stay calm. Help is on the way. Use your emergency contacts if needed.',
                    style: TextStyle(color: Color(0xFFEF4444), fontSize: 12),
                  ),
                ),
              ],
            ),
            actions: [
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text('OK, I understand'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: const Color(0xFF1E1B2E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('SOS Failed', style: TextStyle(color: Colors.white)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 48),
                const SizedBox(height: 12),
                const Text(
                  'Could not send SOS alert automatically.\nPlease call emergency contacts directly.',
                  style: TextStyle(color: Color(0xFF9CA3AF)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK', style: TextStyle(color: Color(0xFFEF4444))),
              ),
            ],
          ),
        );
      }
    } finally {
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) setState(() => _triggered = false);
      });
    }
  }

  Widget _sosInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF6B7280)),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                children: [
                  TextSpan(text: '$label: ', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                  TextSpan(text: value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Calls OpenStreetMap Nominatim to convert GPS coordinates into a
  /// human-readable address string sent to Admin/Fleet Manager with the SOS.
  Future<String?> _reverseGeocode(double lat, double lng) async {
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 6),
        headers: {'User-Agent': 'KavyaTransportERP/1.0 (emergency_sos)'},
      ));
      final response = await dio.get<Map<String, dynamic>>(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {'lat': lat, 'lon': lng, 'format': 'json'},
      );
      final data = response.data;
      if (data != null) {
        final addr = data['address'] as Map?;
        if (addr != null) {
          final parts = <String>[];
          final road = addr['road'] ?? addr['suburb'] ?? addr['neighbourhood'];
          if (road != null) parts.add(road.toString());
          final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'];
          if (city != null) parts.add(city.toString());
          final state = addr['state'];
          if (state != null) parts.add(state.toString());
          if (parts.isNotEmpty) return parts.join(', ');
        }
        return data['display_name']?.toString();
      }
    } catch (e) {
      debugPrint('[SOS] Reverse geocode failed: $e');
    }
    return null;
  }

  Future<(double, double)?> _getCurrentPosition() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 5),
        ),
      );
      return (pos.latitude, pos.longitude);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return GestureDetector(
          onLongPressStart: (_) => _controller.forward(from: 0),
          onLongPressEnd: (_) {
            if (!_triggered) _controller.reset();
          },
          child: Container(
            width: double.infinity,
            height: 64,
            decoration: BoxDecoration(
              color: _triggered
                  ? const Color(0xFFEF4444)
                  : Color.lerp(const Color(0xFF7F1D1D), const Color(0xFFEF4444), _controller.value),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.3 + _controller.value * 0.4),
                  blurRadius: 12 + _controller.value * 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              children: [
                // Progress overlay
                if (_controller.value > 0 && !_triggered)
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: _controller.value,
                          child: Container(color: const Color(0xFFEF4444).withValues(alpha: 0.5)),
                        ),
                      ),
                    ),
                  ),
                Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.sos, color: Colors.white, size: 28),
                      const SizedBox(width: 8),
                      Text(
                        _triggered ? 'SOS SENT!' : 'HOLD FOR SOS',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Bottom sheet shown after the driver takes a selfie.
/// Captures location, shows preview, and submits attendance.
class _AttendanceConfirmSheet extends StatefulWidget {
  final File photoFile;
  final AttendanceNotifier notifier;
  final VoidCallback onSuccess;

  const _AttendanceConfirmSheet({
    required this.photoFile,
    required this.notifier,
    required this.onSuccess,
  });

  @override
  State<_AttendanceConfirmSheet> createState() => _AttendanceConfirmSheetState();
}

class _AttendanceConfirmSheetState extends State<_AttendanceConfirmSheet> {
  bool _loading = false;
  Position? _position;
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _fetchLocation();
  }

  Future<void> _fetchLocation() async {
    final pos = await widget.notifier.getLocation();
    if (mounted) setState(() => _position = pos);
  }

  Future<void> _submit() async {
    setState(() { _loading = true; _errorMsg = null; });

    // Convert photo to base64 data URL
    final bytes = await widget.photoFile.readAsBytes();
    final b64 = base64Encode(bytes);
    final photoDataUrl = 'data:image/jpeg;base64,$b64';

    final message = await widget.notifier.checkIn(
      photoDataUrl: photoDataUrl,
      lat: _position?.latitude,
      lng: _position?.longitude,
    );

    if (!mounted) return;
    if (message != null) {
      widget.onSuccess();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text(message)),
            ],
          ),
          backgroundColor: KTColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    } else {
      setState(() {
        _loading = false;
        _errorMsg = 'Failed to mark attendance. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationText = _position != null
        ? '${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}'
        : 'Fetching location...';

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF334155),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Confirm Attendance',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Review your selfie and location before submitting.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 16),

                // Photo preview
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.file(
                    widget.photoFile,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: 16),

                // Location info
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _position != null ? Icons.location_on : Icons.location_searching,
                        color: _position != null ? KTColors.primary : const Color(0xFF64748B),
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Location',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                            Text(
                              locationText,
                              style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                if (_errorMsg != null) ...[
                  const SizedBox(height: 10),
                  Text(_errorMsg!, style: const TextStyle(color: KTColors.danger, fontSize: 13)),
                ],

                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xFF475569)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Retake'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: _loading ? null : _submit,
                        icon: _loading
                            ? const SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.check_rounded, size: 18),
                        label: Text(_loading ? 'Submitting...' : 'Submit Attendance'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: KTColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
