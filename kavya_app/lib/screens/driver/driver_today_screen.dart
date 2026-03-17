import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/trip.dart';
import '../../models/attendance.dart';
import '../../providers/trip_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/recent_activity_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';

class DriverTodayScreen extends ConsumerWidget {
  const DriverTodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(tripsProvider);
    final attendanceAsync = ref.watch(attendanceProvider);
    final activeTrip = ref.watch(activeTripProvider);
    final recentExpense = ref.watch(recentExpenseProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Attendance Status Card
          attendanceAsync.when(
            data: (attendance) => _attendanceCard(context, attendance),
            loading: () => Container(
              height: 120,
              decoration: BoxDecoration(
                color: KTColors.cardSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Shimmer.fromColors(
                baseColor: Colors.grey,
                highlightColor: Colors.white,
                child: SizedBox.expand(),
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
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('No active trip', style: TextStyle(fontWeight: FontWeight.w600)),
                          Text('Start a trip to see status', style: TextStyle(color: KTColors.textSecondary, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 20),

          // Today's Trips Summary
          const SectionHeader(title: 'Today\'s Trips'),
          const SizedBox(height: 12),
          tripsAsync.when(
            data: (trips) {
              final todayTrips = trips;
              if (todayTrips.isEmpty) {
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.assignment, color: Colors.grey.shade400, size: 48),
                          const SizedBox(height: 12),
                          const Text('No trips today', style: TextStyle(color: KTColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                );
              }
              return ListView.separated(
                physics: const NeverScrollableScrollPhysics(),
                shrinkWrap: true,
                itemCount: todayTrips.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, index) => _tripCard(context, todayTrips[index]),
              );
            },
            loading: () => Column(
              children: List.generate(
                2,
                (index) => Padding(
                  padding: EdgeInsets.only(bottom: index == 1 ? 0 : 8),
                  child: Container(
                    height: 100,
                    decoration: BoxDecoration(
                      color: KTColors.cardSurface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Shimmer.fromColors(
                      baseColor: Colors.grey,
                      highlightColor: Colors.white,
                      child: SizedBox.expand(),
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
          const SectionHeader(title: 'Quick Actions'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.receipt_long,
                  'Add Expense',
                  () => context.push('/driver/add-expense'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.checklist,
                  'Checklist',
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
                  'Documents',
                  () => context.push('/driver/documents'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _quickActionButton(
                  context,
                  Icons.notifications_active,
                  'Notifications',
                  () => context.push('/driver/notifications'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _attendanceCard(BuildContext context, List<Attendance> attendance) {
    final today = attendance.isNotEmpty ? attendance.first : null;
    final isCheckedIn = today?.checkIn != null;
    final isCheckedOut = today?.checkOut != null;

    return Card(
      color: isCheckedIn ? KTColors.success.withValues(alpha: 0.1) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Attendance', style: TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isCheckedIn ? KTColors.success : KTColors.warning,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isCheckedIn ? (isCheckedOut ? 'Checked Out' : 'Checked In') : 'Not Started',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Check In', style: KTTextStyles.label),
                    Text(today?.checkIn ?? '--:--', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Check Out', style: KTTextStyles.label),
                    Text(today?.checkOut ?? '--:--', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Status', style: KTTextStyles.label),
                    Text(today?.status ?? 'pending', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ],
        ),
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

  double _getProgressPercentage(String status) {
    switch (status) {
      case 'pending': return 0.0;
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
      case 'started': return KTColors.info;
      case 'in_transit': return KTColors.primary;
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}
