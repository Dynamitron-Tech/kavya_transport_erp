import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/app_theme.dart';
import '../../providers/trip_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/kt_button.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsState = ref.watch(tripsProvider);
    final attendanceState = ref.watch(attendanceProvider);
    final activeTrip = ref.watch(activeTripProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(tripsProvider);
        ref.invalidate(attendanceProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Attendance Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: attendanceState.when(
                loading: () => const LoadingSkeletonWidget(
                    itemCount: 1, variant: LoadingVariant.card),
                error: (e, _) => ErrorStateWidget(
                    error: e,
                    onRetry: () => ref.invalidate(attendanceProvider)),
                data: (attendance) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Attendance',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600)),
                        if (attendance != null)
                          StatusChip(label: attendance.status),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (attendance?.checkIn != null)
                      Text('Checked in: ${attendance!.checkIn}',
                          style: const TextStyle(
                              color: AppTheme.textSecondary, fontSize: 13)),
                    if (attendance?.checkOut != null)
                      Text('Checked out: ${attendance!.checkOut}',
                          style: const TextStyle(
                              color: AppTheme.textSecondary, fontSize: 13)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if (attendance?.checkIn == null)
                          Expanded(
                            child: KtButton(
                              label: 'Check In',
                              icon: Icons.login,
                              onPressed: () => ref
                                  .read(attendanceProvider.notifier)
                                  .checkIn(),
                            ),
                          ),
                        if (attendance?.checkIn != null &&
                            attendance?.checkOut == null)
                          Expanded(
                            child: KtButton(
                              label: 'Check Out',
                              icon: Icons.logout,
                              outlined: true,
                              onPressed: () => ref
                                  .read(attendanceProvider.notifier)
                                  .checkOut(),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Active Trip Card
          if (activeTrip != null)
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => context.push('/trips/${activeTrip.id}'),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(activeTrip.tripNumber,
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w600)),
                          StatusChip(label: activeTrip.status),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _routeRow(Icons.circle_outlined,
                          activeTrip.origin ?? '-', AppTheme.success),
                      _routeRow(Icons.location_on,
                          activeTrip.destination ?? '-', AppTheme.error),
                      const SizedBox(height: 8),
                      if (activeTrip.vehicleNumber != null)
                        Text('Vehicle: ${activeTrip.vehicleNumber}',
                            style: const TextStyle(
                                color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ),

          const SizedBox(height: 16),

          // Quick Actions
          const Text('Quick Actions',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              _actionTile(context, Icons.checklist, 'Checklist', '/checklist'),
              _actionTile(
                  context, Icons.receipt_long, 'Add Expense', '/expenses/add'),
              _actionTile(
                  context, Icons.description, 'Documents', '/documents'),
              _actionTile(context, Icons.local_shipping, 'My Trips', '/trips'),
              _actionTile(
                  context, Icons.notifications, 'Notifications', '/notifications'),
              _actionTile(context, Icons.person, 'Profile', '/profile'),
            ],
          ),

          const SizedBox(height: 16),

          // Recent Trips
          const Text('Recent Trips',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          tripsState.when(
            loading: () => const LoadingSkeletonWidget(
                itemCount: 3, variant: LoadingVariant.list),
            error: (e, _) => ErrorStateWidget(
                error: e, onRetry: () => ref.invalidate(tripsProvider)),
            data: (trips) {
              if (trips.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                      child: Text('No trips assigned yet',
                          style: TextStyle(color: AppTheme.textMuted))),
                );
              }
              return Column(
                children: trips.take(5).map((trip) {
                  return Card(
                    child: ListTile(
                      title: Text(trip.tripNumber),
                      subtitle: Text(
                          '${trip.origin ?? '-'} → ${trip.destination ?? '-'}'),
                      trailing: StatusChip(label: trip.status),
                      onTap: () => context.push('/trips/${trip.id}'),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _routeRow(IconData icon, String text, Color color) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 8),
            Expanded(
                child: Text(text,
                    style: const TextStyle(fontSize: 13),
                    overflow: TextOverflow.ellipsis)),
          ],
        ),
      );

  Widget _actionTile(
      BuildContext context, IconData icon, String label, String route) {
    return InkWell(
      onTap: () => context.push(route),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 28, color: AppTheme.primary),
            const SizedBox(height: 6),
            Text(label,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
