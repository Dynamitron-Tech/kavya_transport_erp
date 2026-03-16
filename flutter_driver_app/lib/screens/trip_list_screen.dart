import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/trip_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
import '../../config/app_theme.dart';

class TripListScreen extends ConsumerWidget {
  const TripListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsState = ref.watch(tripsProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(tripsProvider),
      child: tripsState.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeletonWidget(itemCount: 6, variant: LoadingVariant.card),
        ),
        error: (e, _) => ErrorStateWidget(
          error: e,
          onRetry: () => ref.invalidate(tripsProvider),
        ),
        data: (trips) {
          if (trips.isEmpty) {
            return const EmptyStateWidget(
              icon: Icons.local_shipping_outlined,
              title: 'No trips assigned',
              message: 'Trips assigned to you will appear here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: trips.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final trip = trips[index];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/trips/${trip.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(trip.tripNumber,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, fontSize: 15)),
                            StatusChip(label: trip.status),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.circle_outlined,
                                size: 12, color: AppTheme.success),
                            const SizedBox(width: 6),
                            Expanded(
                                child: Text(trip.origin ?? '-',
                                    style: const TextStyle(fontSize: 13))),
                          ],
                        ),
                        Row(
                          children: [
                            const Icon(Icons.location_on,
                                size: 12, color: AppTheme.error),
                            const SizedBox(width: 6),
                            Expanded(
                                child: Text(trip.destination ?? '-',
                                    style: const TextStyle(fontSize: 13))),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            if (trip.vehicleNumber != null)
                              Text('🚛 ${trip.vehicleNumber}',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textSecondary)),
                            const Spacer(),
                            if (trip.startDate != null)
                              Text(trip.startDate!,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textMuted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
