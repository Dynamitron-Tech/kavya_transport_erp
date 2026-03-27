import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../services/notification_service.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/widgets/section_header.dart';
import '../../core/localization/locale_provider.dart';

class DriverTripDetailScreen extends ConsumerWidget {
  final int tripId;

  const DriverTripDetailScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripAsync = ref.watch(tripDetailProvider(tripId));
    final s = ref.watch(sProvider);

    return Scaffold(
      appBar: AppBar(title: Text(s.tripDetails)),
      body: tripAsync.when(
        data: (trip) => _buildContent(context, ref, trip),
        loading: () => _buildLoading(),
        error: (e, st) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 56, color: KTColors.danger),
              const SizedBox(height: 16),
              Text(s.errorLoadingTrip, style: KTTextStyles.h3),
              const SizedBox(height: 8),
              Text(e.toString(), style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: Text(s.goBack),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, Trip trip) {
    final s = ref.watch(sProvider);
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
                  _infoRow(Icons.location_on_outlined, s.origin, trip.origin ?? 'N/A'),
                  const Divider(height: 24),
                  _infoRow(Icons.flag_outlined, s.destination, trip.destination ?? 'N/A'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Map Section
          _buildMapSection(trip),
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
            SectionHeader(title: s.remarks),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(trip.remarks!, style: const TextStyle(fontSize: 14, height: 1.6)),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Actions
          SectionHeader(title: s.actions),
          const SizedBox(height: 12),
          if (trip.isActive) ...[
            // Hide 'Update Status' when in_transit — ePOD is the only valid path to completion
            if (trip.status != 'in_transit') ...[
              KtButton(
                label: s.updateStatus,
                icon: Icons.edit,
                onPressed: () => _showStatusDialog(context, ref, trip),
              ),
              const SizedBox(height: 12),
            ],
            KtButton(
              label: s.completeDeliveryEpod,
              icon: Icons.verified,
              onPressed: () => context.push('/driver/trip/${trip.id}/epod'),
            ),
            const SizedBox(height: 12),
          ],
          KtButton(
            label: s.addExpense,
            icon: Icons.receipt_long,
            outlined: true,
            onPressed: () => context.push(
              '/driver/expenses/${trip.id}?trip=${Uri.encodeComponent(trip.tripNumber)}',
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildMapSection(Trip trip) {
    final bool isLiveTracking = trip.status == 'started' ||
        trip.status == 'in_transit' ||
        trip.status == 'loading' ||
        trip.status == 'unloading';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: isLiveTracking ? 'Live Tracking' : 'Route Map',
        ),
        Container(
          height: 220,
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isLiveTracking
                  ? KTColors.success.withValues(alpha: 0.4)
                  : KTColors.driverAccent.withValues(alpha: 0.2),
              width: 1.5,
            ),
          ),
          child: Stack(
            children: [
              // Placeholder route visualization
              CustomPaint(
                size: const Size(double.infinity, 220),
                painter: _RoutePlaceholderPainter(isLive: isLiveTracking),
              ),
              // Origin marker
              Positioned(
                left: 32,
                top: 90,
                child: _mapMarker(
                  Icons.circle,
                  KTColors.success,
                  trip.origin ?? 'Origin',
                ),
              ),
              // Destination marker
              Positioned(
                right: 32,
                top: 90,
                child: _mapMarker(
                  Icons.flag_rounded,
                  KTColors.danger,
                  trip.destination ?? 'Destination',
                ),
              ),
              // Live tracking pulse indicator
              if (isLiveTracking)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 12,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: KTColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: KTColors.success.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: KTColors.success,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'LIVE',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: KTColors.success,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              // Google Maps integration note
              Positioned(
                left: 0,
                right: 0,
                bottom: 12,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isLiveTracking
                          ? 'Live map available with Google Maps API'
                          : 'Route map available with Google Maps API',
                      style: const TextStyle(
                        fontSize: 10,
                        color: KTColors.textMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _mapMarker(IconData icon, Color color, String label) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: color, width: 2),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
          ),
        ),
      ],
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
              child: Shimmer.fromColors(
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
        Icon(icon, size: 18, color: KTColors.driverAccent),
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
    // 'completed' is intentionally excluded — drivers must use the ePOD flow to complete a trip
    const allStatuses = ['ready', 'started', 'loading', 'in_transit'];
    final currentIdx = allStatuses.indexOf(trip.status);
    // Show only the next status in the flow
    final nextStatuses = currentIdx >= 0 && currentIdx < allStatuses.length - 1
        ? [allStatuses[currentIdx + 1]]
        : allStatuses.where((s) => s != trip.status).toList();

    // Should not reach here (button is hidden for in_transit), but guard just in case
    if (nextStatuses.isEmpty) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update Trip Status'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Current status display
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  const Text('Current: ', style: TextStyle(color: KTColors.textSecondary, fontSize: 13)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _getStatusColor(trip.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: _getStatusColor(trip.status).withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      trip.status.replaceAll('_', ' ').toUpperCase(),
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _getStatusColor(trip.status)),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ...nextStatuses.map((status) => ListTile(
              leading: Icon(Icons.arrow_forward_rounded, color: _getStatusColor(status)),
              title: Text(
                status.replaceAll('_', ' ').toUpperCase(),
                style: TextStyle(fontWeight: FontWeight.w600, color: _getStatusColor(status)),
              ),
              onTap: () async {
                Navigator.pop(ctx);
                // Gate: READY → STARTED requires pre-trip checklist to be submitted
                if (trip.status == 'ready' && status == 'started') {
                  try {
                    final api = ref.read(apiServiceProvider);
                    await api.get(
                      '/trips/${trip.id}/checklist',
                      queryParameters: {'type': 'pre_trip'},
                    );
                    // 200 → checklist completed → proceed
                    await ref.read(tripsPaginatedProvider.notifier).updateTripStatus(trip.id, status);
                    ref.invalidate(tripDetailProvider(trip.id));
                  } catch (_) {
                    // 404 or network error → checklist not done → show gate dialog
                    if (context.mounted) {
                      showDialog(
                        context: context,
                        builder: (alertCtx) => AlertDialog(
                          backgroundColor: KTColors.surface,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16)),
                          title: Row(
                            children: const [
                              Icon(Icons.checklist_rtl_rounded,
                                  color: KTColors.warning, size: 22),
                              SizedBox(width: 8),
                              Text('Checklist Required',
                                  style: TextStyle(
                                      color: KTColors.textPrimary,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                          content: const Text(
                            'Please Complete the Pre-trip Checklist to Update',
                            style: TextStyle(
                                color: KTColors.textSecondary, fontSize: 14),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(alertCtx),
                              child: const Text('Later',
                                  style: TextStyle(color: KTColors.textMuted)),
                            ),
                            ElevatedButton(
                              onPressed: () {
                                Navigator.pop(alertCtx);
                                context.push('/driver/checklist');
                              },
                              style: ElevatedButton.styleFrom(
                                  backgroundColor: KTColors.driverAccent,
                                  foregroundColor: Colors.black,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8))),
                              child: const Text('Go to Checklist',
                                  style: TextStyle(fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ),
                      );
                    }
                  }
                } else {
                  try {
                    await ref.read(tripsPaginatedProvider.notifier).updateTripStatus(trip.id, status);
                    ref.invalidate(tripDetailProvider(trip.id));
                    // Driver is now in transit — send a motivational reminder
                    if (status == 'in_transit') {
                      NotificationService().showTripEvent(
                        title: 'Remember! 🚛',
                        body: 'There is someone waiting for you!\nDrive safe!',
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed to update: $e'), backgroundColor: KTColors.danger),
                      );
                    }
                  }
                }
              },
            )),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'ready': return KTColors.info;
      case 'pending': return KTColors.warning;
      case 'started': return const Color(0xFF3B82F6);
      case 'in_transit': return KTColors.driverAccent;
      case 'loading': return KTColors.warning;
      case 'unloading': return const Color(0xFFF59E0B);
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}

class _RoutePlaceholderPainter extends CustomPainter {
  final bool isLive;
  _RoutePlaceholderPainter({required this.isLive});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = isLive
          ? KTColors.success.withValues(alpha: 0.25)
          : KTColors.driverAccent.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    // Draw dashed curved route line
    final path = Path()
      ..moveTo(60, size.height * 0.5)
      ..cubicTo(
        size.width * 0.3, size.height * 0.2,
        size.width * 0.7, size.height * 0.8,
        size.width - 60, size.height * 0.5,
      );

    final dashPaint = Paint()
      ..color = paint.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    // Draw path as dashes
    final metrics = path.computeMetrics();
    for (final metric in metrics) {
      double distance = 0;
      while (distance < metric.length) {
        final end = (distance + 8).clamp(0, metric.length).toDouble();
        final segment = metric.extractPath(distance, end);
        canvas.drawPath(segment, dashPaint);
        distance += 16;
      }
    }

    // Draw subtle grid dots
    final dotPaint = Paint()
      ..color = KTColors.borderColor.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;

    for (double x = 20; x < size.width; x += 40) {
      for (double y = 20; y < size.height; y += 40) {
        canvas.drawCircle(Offset(x, y), 1, dotPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _RoutePlaceholderPainter old) => old.isLive != isLive;
}
