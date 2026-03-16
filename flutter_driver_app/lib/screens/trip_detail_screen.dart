import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_theme.dart';
import '../../providers/trip_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/kt_button.dart';
import '../../widgets/section_header.dart';

class TripDetailScreen extends ConsumerWidget {
  final int tripId;

  const TripDetailScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripState = ref.watch(tripDetailProvider(tripId));

    return Scaffold(
      appBar: AppBar(title: const Text('Trip Details')),
      body: tripState.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeletonWidget(itemCount: 4, variant: LoadingVariant.card),
        ),
        error: (e, _) => ErrorStateWidget(
          error: e,
          onRetry: () => ref.invalidate(tripDetailProvider(tripId)),
        ),
        data: (trip) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Header Card
            Card(
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
                                fontSize: 20, fontWeight: FontWeight.bold)),
                        StatusChip(label: trip.status),
                      ],
                    ),
                    const Divider(height: 24),
                    _infoRow('Origin', trip.origin ?? '-'),
                    _infoRow('Destination', trip.destination ?? '-'),
                    _infoRow('Vehicle', trip.vehicleNumber ?? '-'),
                    _infoRow('Client', trip.clientName ?? '-'),
                    _infoRow('LR Number', trip.lrNumber ?? '-'),
                    if (trip.distanceKm != null)
                      _infoRow('Distance', '${trip.distanceKm} km'),
                    if (trip.freightAmount != null)
                      _infoRow('Freight', '₹${trip.freightAmount!.toStringAsFixed(0)}'),
                    _infoRow('Start Date', trip.startDate ?? '-'),
                    _infoRow('End Date', trip.endDate ?? '-'),
                    if (trip.remarks != null && trip.remarks!.isNotEmpty)
                      _infoRow('Remarks', trip.remarks!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Actions
            const SectionHeader(title: 'Actions'),
            if (trip.status == 'pending' || trip.status == 'scheduled')
              SizedBox(
                width: double.infinity,
                child: KtButton(
                  label: 'Start Trip',
                  icon: Icons.play_arrow,
                  onPressed: () => ref
                      .read(tripsProvider.notifier)
                      .updateTripStatus(trip.id, 'started'),
                ),
              ),
            if (trip.status == 'started')
              SizedBox(
                width: double.infinity,
                child: KtButton(
                  label: 'Mark In Transit',
                  icon: Icons.local_shipping,
                  onPressed: () => ref
                      .read(tripsProvider.notifier)
                      .updateTripStatus(trip.id, 'in_transit'),
                ),
              ),
            if (trip.status == 'in_transit')
              SizedBox(
                width: double.infinity,
                child: KtButton(
                  label: 'Mark Delivered',
                  icon: Icons.check_circle,
                  onPressed: () => ref
                      .read(tripsProvider.notifier)
                      .updateTripStatus(trip.id, 'delivered'),
                ),
              ),
            if (trip.isActive) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: KtButton(
                  label: 'Add Expense',
                  icon: Icons.receipt_long,
                  outlined: true,
                  onPressed: () {},
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 100,
              child: Text(label,
                  style: const TextStyle(
                      color: AppTheme.textSecondary, fontSize: 13)),
            ),
            Expanded(
              child: Text(value,
                  style: const TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 13)),
            ),
          ],
        ),
      );
}
