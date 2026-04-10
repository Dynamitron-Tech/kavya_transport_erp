import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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
import '../fleet/fleet_vehicles_screen.dart' show fleetVehiclesProvider;

// Provider to fetch LR details for a trip
final tripLRsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
  (ref, tripId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/lr', queryParameters: {'trip_id': tripId, 'limit': 100});
    final data = res is Map ? (res['data'] ?? res) : res;
    if (data is List) return List<Map<String, dynamic>>.from(data);
    if (data is Map && data['items'] is List) return List<Map<String, dynamic>>.from(data['items']);
    return [];
  },
);

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

          // LR (Lorry Receipt) Details
          _buildLRSection(ref, trip),

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
            // Mark as Reached button — shown when cargo is loaded/in transit
            if (trip.awaitingReach) ...[
              KtButton(
                label: 'Mark as Reached',
                icon: Icons.location_on_rounded,
                onPressed: () => _showArrivalSheet(context, ref, trip),
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
              '/driver/expenses/${trip.id}?trip=${Uri.encodeComponent(trip.tripNumber)}&origin=${Uri.encodeComponent(trip.origin ?? '')}&destination=${Uri.encodeComponent(trip.destination ?? '')}',
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
                    // 200 → checklist completed → collect departure odometer
                    if (context.mounted) {
                      final odo = await _showDepartureOdometerDialog(context);
                      final api2 = ref.read(apiServiceProvider);
                      await api2.startTrip(trip.id, startOdometer: odo);
                      ref.invalidate(tripDetailProvider(trip.id));
                      await ref.read(tripsPaginatedProvider.notifier).refresh();
                    }
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

  Future<double?> _showDepartureOdometerDialog(BuildContext context) async {
    final ctrl = TextEditingController();
    return showDialog<double>(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        title: const Row(children: [
          Icon(Icons.speed_outlined, color: KTColors.driverAccent),
          SizedBox(width: 8),
          Text('Odometer at Departure'),
        ]),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
          decoration: const InputDecoration(
            labelText: 'Current reading',
            suffixText: 'km',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx),
            child: const Text('Skip'),
          ),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(ctrl.text.trim());
              Navigator.pop(dlgCtx, val);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.driverAccent,
              foregroundColor: Colors.black,
            ),
            child: const Text('Start Trip'),
          ),
        ],
      ),
    );
  }

  Widget _buildLRSection(WidgetRef ref, Trip trip) {
    final lrAsync = ref.watch(tripLRsProvider(trip.id));
    return lrAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (lrs) {
        if (lrs.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: 'Lorry Receipt (LR)'),
            ...lrs.map((lr) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // LR Number & Status
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'LR# ${lr['lr_number'] ?? lr['id'] ?? ''}',
                          style: KTTextStyles.h3,
                        ),
                        if (lr['status'] != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: KTColors.info.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              (lr['status'] as String).replaceAll('_', ' ').toUpperCase(),
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: KTColors.info),
                            ),
                          ),
                      ],
                    ),
                    const Divider(height: 20),
                    // Consignor
                    if (lr['consignor_name'] != null) ...[
                      _infoRow(Icons.business_outlined, 'Consignor', lr['consignor_name']),
                      if (lr['consignor_gstin'] != null)
                        Padding(
                          padding: const EdgeInsets.only(left: 30, top: 2),
                          child: Text('GSTIN: ${lr['consignor_gstin']}',
                              style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                        ),
                      const Divider(height: 20),
                    ],
                    // Consignee
                    if (lr['consignee_name'] != null) ...[
                      _infoRow(Icons.store_outlined, 'Consignee', lr['consignee_name']),
                      if (lr['consignee_gstin'] != null)
                        Padding(
                          padding: const EdgeInsets.only(left: 30, top: 2),
                          child: Text('GSTIN: ${lr['consignee_gstin']}',
                              style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                        ),
                      const Divider(height: 20),
                    ],
                    // Route
                    if (lr['origin'] != null || lr['destination'] != null) ...[
                      _infoRow(Icons.route, 'Route',
                          '${lr['origin'] ?? ''} → ${lr['destination'] ?? ''}'),
                      const Divider(height: 20),
                    ],
                    // Cargo / Material
                    if (lr['material_name'] != null || lr['description'] != null)
                      _infoRow(Icons.inventory_2_outlined, 'Material',
                          lr['material_name'] ?? lr['description'] ?? ''),
                    if (lr['weight'] != null || lr['total_weight'] != null) ...[
                      const SizedBox(height: 8),
                      _infoRow(Icons.scale_outlined, 'Weight',
                          '${lr['weight'] ?? lr['total_weight']} ${lr['weight_unit'] ?? 'kg'}'),
                    ],
                    if (lr['no_of_packages'] != null || lr['packages'] != null) ...[
                      const SizedBox(height: 8),
                      _infoRow(Icons.widgets_outlined, 'Packages',
                          '${lr['no_of_packages'] ?? lr['packages']}'),
                    ],
                    // Freight
                    if (lr['freight_amount'] != null || lr['total_amount'] != null) ...[
                      const Divider(height: 20),
                      _infoRow(Icons.currency_rupee, 'Freight',
                          '₹${(lr['freight_amount'] ?? lr['total_amount'] ?? 0).toString()}'),
                    ],
                    if (lr['payment_mode'] != null) ...[
                      const SizedBox(height: 8),
                      _infoRow(Icons.payment_outlined, 'Payment', lr['payment_mode']),
                    ],
                    // EWB
                    if (lr['eway_bill_number'] != null || lr['ewb_number'] != null) ...[
                      const Divider(height: 20),
                      _infoRow(Icons.description_outlined, 'E-Way Bill',
                          lr['eway_bill_number'] ?? lr['ewb_number'] ?? ''),
                    ],
                  ],
                ),
              ),
            )),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }

  void _showArrivalSheet(BuildContext context, WidgetRef ref, Trip trip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ArrivalSheet(trip: trip, ref: ref),
    );
  }
}

class _ArrivalSheet extends StatefulWidget {
  final Trip trip;
  final WidgetRef ref;

  const _ArrivalSheet({required this.trip, required this.ref});

  @override
  State<_ArrivalSheet> createState() => _ArrivalSheetState();
}

class _ArrivalSheetState extends State<_ArrivalSheet> {
  File? _photo;
  final _odoCtrl = TextEditingController();
  bool _isSubmitting = false;
  final _picker = ImagePicker();

  @override
  void dispose() {
    _odoCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final xfile = await _picker.pickImage(source: source, maxWidth: 1200, imageQuality: 85);
    if (xfile != null) setState(() => _photo = File(xfile.path));
  }

  Future<void> _submit() async {
    if (_photo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please take an arrival photo'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      final odo = double.tryParse(_odoCtrl.text.trim());
      final api = widget.ref.read(apiServiceProvider);
      await api.markTripReached(widget.trip.id, _photo!, endOdometer: odo);
      widget.ref.invalidate(tripDetailProvider(widget.trip.id));
      widget.ref.invalidate(fleetVehiclesProvider);
      await widget.ref.read(tripsPaginatedProvider.notifier).refresh();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  Future<void> _showPhotoSourceSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _pickPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: KTColors.driverAccent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.location_on_rounded, color: KTColors.driverAccent, size: 20),
              ),
              const SizedBox(width: 10),
              const Text('Mark as Reached', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(height: 24),

          // Arrival Photo
          const Text('Arrival Photo *',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: KTColors.textSecondary)),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _showPhotoSourceSheet,
            child: Container(
              height: 150,
              width: double.infinity,
              decoration: BoxDecoration(
                color: KTColors.cardSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _photo != null
                      ? KTColors.success
                      : KTColors.borderColor,
                  width: 1.5,
                ),
              ),
              child: _photo != null
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(11),
                          child: Image.file(_photo!, fit: BoxFit.cover),
                        ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: GestureDetector(
                            onTap: _showPhotoSourceSheet,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.edit, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    )
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_a_photo_outlined, size: 40, color: KTColors.textMuted),
                        SizedBox(height: 8),
                        Text('Tap to capture arrival photo',
                            style: TextStyle(color: KTColors.textMuted, fontSize: 13)),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 16),

          // Odometer at Arrival
          TextField(
            controller: _odoCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
            decoration: const InputDecoration(
              labelText: 'Odometer at Arrival (km)',
              hintText: 'e.g. 85230',
              prefixIcon: Icon(Icons.speed_outlined),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.driverAccent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : const Text('Confirm Arrival',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
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
