import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';

class DriverTripDetailScreen extends ConsumerWidget {
  final int tripId;

  const DriverTripDetailScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripAsync = ref.watch(tripDetailProvider(tripId));

    return Scaffold(
      appBar: AppBar(title: const Text('Trip Details')),
      body: tripAsync.when(
        data: (trip) => _buildContent(context, ref, trip),
        loading: () => _buildLoading(),
        error: (e, st) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 56, color: KTColors.danger),
              const SizedBox(height: 16),
              Text('Error loading trip', style: KTTextStyles.h3),
              const SizedBox(height: 8),
              Text(e.toString(), style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, Trip trip) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Trip Header
          Card(
            color: _getStatusColor(trip.status).withValues(alpha: 0.05),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Trip Number', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                            Text(trip.tripNumber, style: KTTextStyles.h2),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _getStatusColor(trip.status),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          trip.status.replaceAll('_', ' ').toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Route Information
          const SectionHeader(title: 'Route'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _infoRow(Icons.location_on_outlined, 'Origin', trip.origin ?? 'N/A'),
                  const Divider(height: 24),
                  _infoRow(Icons.flag_outlined, 'Destination', trip.destination ?? 'N/A'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Trip Details
          const SectionHeader(title: 'Details'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (trip.vehicleNumber != null) ...[
                    _infoRow(Icons.directions_car_outlined, 'Vehicle', trip.vehicleNumber!),
                    const Divider(height: 24),
                  ],
                  if (trip.clientName != null) ...[
                    _infoRow(Icons.business_outlined, 'Client', trip.clientName!),
                    const Divider(height: 24),
                  ],
                  if (trip.lrNumber != null) ...[
                    _infoRow(Icons.receipt_outlined, 'LR Number', trip.lrNumber!),
                    const Divider(height: 24),
                  ],
                  if (trip.startDate != null) ...[
                    _infoRow(Icons.calendar_today_outlined, 'Start Date', trip.startDate!),
                    const Divider(height: 24),
                  ],
                  if (trip.distanceKm != null) ...[
                    _infoRow(Icons.straighten, 'Distance', '${trip.distanceKm!.toStringAsFixed(2)} km'),
                    const Divider(height: 24),
                  ],
                  if (trip.freightAmount != null) ...[
                    _infoRow(Icons.currency_rupee, 'Freight Amount', '₹${trip.freightAmount!.toStringAsFixed(2)}'),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Remarks
          if (trip.remarks != null && trip.remarks!.isNotEmpty) ...[
            const SectionHeader(title: 'Remarks'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(trip.remarks!, style: const TextStyle(fontSize: 14, height: 1.6)),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Actions
          const SectionHeader(title: 'Actions'),
          const SizedBox(height: 12),
          if (trip.isActive) ...[
            KtButton(
              label: 'Update Status',
              icon: Icons.edit,
              onPressed: () => _showStatusDialog(context, ref, trip),
            ),
            const SizedBox(height: 12),
          ],
          KtButton(
            label: 'View Documents',
            icon: Icons.description,
            outlined: true,
            onPressed: () {},
          ),
          const SizedBox(height: 12),
          KtButton(
            label: 'Add Expense',
            icon: Icons.receipt_long,
            outlined: true,
            onPressed: () {},
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildLoading() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: List.generate(
          3,
          (index) => Padding(
            padding: EdgeInsets.only(bottom: index == 2 ? 0 : 24),
            child: Container(
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
          ),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: KTColors.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: KTColors.textSecondary)),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }

  void _showStatusDialog(BuildContext context, WidgetRef ref, Trip trip) {
    final statuses = ['pending', 'started', 'in_transit', 'loading', 'completed'];
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update Trip Status'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: statuses
              .map((status) => RadioListTile<String>(
                title: Text(status.replaceAll('_', ' ').toUpperCase()),
                value: status,
                groupValue: trip.status,
                onChanged: (value) {
                  if (value != null) {
                    ref.read(tripsProvider.notifier).updateTripStatus(trip.id, value);
                    Navigator.pop(ctx);
                  }
                },
              ))
              .toList(),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return KTColors.warning;
      case 'started': return KTColors.info;
      case 'in_transit': return KTColors.primary;
      case 'loading': return KTColors.warning;
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}
