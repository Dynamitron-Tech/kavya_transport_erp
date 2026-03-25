import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import 'package:shimmer/shimmer.dart';

class DriverExpenseTripsScreen extends ConsumerWidget {
  const DriverExpenseTripsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(tripsProvider);
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(title: const Text('Expenses')),
      body: tripsAsync.when(
        data: (trips) {
          if (trips.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.local_shipping_outlined, size: 56, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text('No trips found', style: KTTextStyles.h3),
                  const SizedBox(height: 8),
                  const Text(
                    'Expenses will appear here once\nyou have trips assigned',
                    style: TextStyle(color: KTColors.textMuted, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: KTColors.driverAccent,
            onRefresh: () async => ref.invalidate(tripsProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: trips.length,
              itemBuilder: (context, index) => _TripExpenseCard(
                trip: trips[index],
                currencyFormat: currencyFormat,
                onTap: () => context.push('/driver/expenses/${trips[index].id}?trip=${Uri.encodeComponent(trips[index].tripNumber)}'),
              ),
            ),
          );
        },
        loading: () => Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: List.generate(
              4,
              (i) => Padding(
                padding: EdgeInsets.only(bottom: i == 3 ? 0 : 12),
                child: Container(
                  height: 100,
                  decoration: BoxDecoration(
                    color: KTColors.cardSurface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Shimmer.fromColors(
                    baseColor: Colors.grey,
                    highlightColor: Colors.white,
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 56, color: KTColors.danger),
              const SizedBox(height: 16),
              Text('Error loading trips', style: KTTextStyles.h3),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(tripsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TripExpenseCard extends StatelessWidget {
  final Trip trip;
  final NumberFormat currencyFormat;
  final VoidCallback onTap;

  const _TripExpenseCard({
    required this.trip,
    required this.currencyFormat,
    required this.onTap,
  });

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return KTColors.success;
      case 'in_transit':
      case 'loading':
      case 'unloading':
        return KTColors.driverAccent;
      case 'started':
      case 'ready':
        return KTColors.info;
      case 'driver_assigned':
        return KTColors.warning;
      default:
        return KTColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sc = _statusColor(trip.status);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Route dot indicator
                Column(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: KTColors.success,
                        borderRadius: BorderRadius.circular(5),
                      ),
                    ),
                    Container(width: 2, height: 24, color: KTColors.textMuted.withValues(alpha: 0.2)),
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: KTColors.danger,
                        borderRadius: BorderRadius.circular(5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                // Trip info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              trip.tripNumber,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: sc.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              trip.status.replaceAll('_', ' ').toUpperCase(),
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: sc, letterSpacing: 0.3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        trip.origin ?? 'Origin',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        trip.destination ?? 'Destination',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      if (trip.startDate != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          trip.startDate!.split('T').first,
                          style: const TextStyle(fontSize: 11, color: KTColors.textMuted),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right, color: KTColors.textMuted.withValues(alpha: 0.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
