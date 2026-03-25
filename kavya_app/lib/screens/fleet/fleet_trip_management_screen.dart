import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ──────────────────────────────────────────────────────────────

final fleetTripsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, dateFilter) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/fleet/trips');
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    return [];
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class FleetTripManagementScreen extends ConsumerStatefulWidget {
  const FleetTripManagementScreen({super.key});

  @override
  ConsumerState<FleetTripManagementScreen> createState() => _FleetTripManagementScreenState();
}

class _FleetTripManagementScreenState extends ConsumerState<FleetTripManagementScreen> {
  String _statusFilter = 'All';
  String _dateFilter = 'today';

  static const _statusFilters = ['All', 'Active', 'Completed', 'Delayed'];
  static const _dateOptions = ['today', 'this_week', 'custom'];
  static const _dateLabels = ['Today', 'This Week', 'Custom'];

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(fleetTripsProvider(_dateFilter));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Text('Trip Management', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: KTColors.fleetAccent),
            onPressed: () async {
              final result = await context.push('/fleet/trip/create');
              if (result == true) ref.invalidate(fleetTripsProvider(_dateFilter));
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── Summary Bar ─────────────────────────────────────────
          tripsAsync.maybeWhen(
            data: (trips) => _summaryBar(trips),
            orElse: () => const SizedBox.shrink(),
          ),

          // ─── Status Filter Chips ──────────────────────────────────
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _statusFilters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _statusFilters[i];
                final selected = _statusFilter == f;
                return FilterChip(
                  label: Text(f),
                  selected: selected,
                  onSelected: (_) => setState(() => _statusFilter = f),
                  labelStyle: KTTextStyles.label.copyWith(
                    color: selected ? Colors.white : KTColors.textMuted,
                  ),
                  selectedColor: KTColors.fleetAccent,
                  backgroundColor: KTColors.surface,
                  side: BorderSide(color: selected ? KTColors.fleetAccent : KTColors.borderColor),
                  showCheckmark: false,
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ─── Date Filter Row ──────────────────────────────────────
          SizedBox(
            height: 36,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _dateOptions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final opt = _dateOptions[i];
                final label = _dateLabels[i];
                final selected = _dateFilter == opt;
                return GestureDetector(
                  onTap: () => setState(() => _dateFilter = opt),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: selected ? KTColors.borderColor : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: selected ? KTColors.fleetAccent : KTColors.borderColor,
                      ),
                    ),
                    child: Text(
                      label,
                      style: KTTextStyles.label.copyWith(
                        color: selected ? KTColors.fleetAccent : KTColors.textMuted,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ─── Trip List ────────────────────────────────────────────
          Expanded(
            child: tripsAsync.when(
              loading: () => ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 5,
                itemBuilder: (_, __) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: KTLoadingShimmer(type: ShimmerType.card),
                ),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
                    const SizedBox(height: 12),
                    Text('Failed to load trips', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 16),
                    KTButton.secondary(
                      onPressed: () => ref.invalidate(fleetTripsProvider(_dateFilter)),
                      label: 'Retry',
                    ),
                  ],
                ),
              ),
              data: (trips) {
                final filtered = _applyStatusFilter(trips);
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.local_shipping_outlined, color: KTColors.textMuted, size: 64),
                        const SizedBox(height: 16),
                        Text('No Trips Found', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                        const SizedBox(height: 8),
                        Text('Try a different filter or date.',
                            style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: KTColors.fleetAccent,
                  onRefresh: () async => ref.invalidate(fleetTripsProvider(_dateFilter)),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _tripCard(context, filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryBar(List<Map<String, dynamic>> trips) {
    final active = trips.where((t) { final s = (t['status']?.toString() ?? '').toUpperCase(); return s == 'IN_TRANSIT' || s == 'STARTED' || s == 'LOADING' || s == 'UNLOADING'; }).length;
    final completed = trips.where((t) => (t['status']?.toString() ?? '').toUpperCase() == 'COMPLETED').length;
    final delayed = trips.where((t) => t['is_delayed'] == true).length;

    return Container(
      color: KTColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          _summaryChip('Active', active, KTColors.info),
          const SizedBox(width: 16),
          _summaryChip('Completed', completed, KTColors.success),
          const SizedBox(width: 16),
          _summaryChip('Delayed', delayed, KTColors.fleetAccent),
        ],
      ),
    );
  }

  Widget _summaryChip(String label, int count, Color color) {
    return Row(
      children: [
        Text('$label: ', style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
        Text('$count', style: KTTextStyles.label.copyWith(color: color, fontWeight: FontWeight.w700)),
      ],
    );
  }

  List<Map<String, dynamic>> _applyStatusFilter(List<Map<String, dynamic>> trips) {
    if (_statusFilter == 'All') return trips;
    final statusMap = {
      'Active': ['IN_TRANSIT', 'STARTED', 'LOADING', 'UNLOADING'],
      'Completed': ['COMPLETED'],
      'Delayed': ['IN_TRANSIT', 'STARTED'],
    };
    final statuses = statusMap[_statusFilter] ?? [];
    if (_statusFilter == 'Delayed') {
      return trips.where((t) => t['is_delayed'] == true).toList();
    }
    return trips.where((t) => statuses.contains((t['status']?.toString() ?? '').toUpperCase())).toList();
  }

  Widget _tripCard(BuildContext context, Map<String, dynamic> trip) {
    final tripNumber = trip['trip_number']?.toString() ?? '#${trip['id']}';
    final driverName = (trip['driver_name'] ?? '').toString().trim();
    final vehicleNo = trip['vehicle_registration']?.toString() ?? '—';
    final origin = trip['origin']?.toString() ?? '—';
    final destination = trip['destination']?.toString() ?? '—';
    final eta = trip['planned_end']?.toString() ?? '';
    final isDelayed = trip['is_delayed'] == true;
    final status = (trip['status']?.toString() ?? 'PLANNED').toUpperCase();
    final isCompleted = status == 'COMPLETED';
    final paymentApproved = trip['payment_approved'] == true;
    final driverPay = (trip['driver_pay'] as num? ?? 0).toDouble();

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'IN_TRANSIT':
        statusColor = KTColors.info;
        statusLabel = 'In Transit';
        break;
      case 'STARTED':
        statusColor = KTColors.info;
        statusLabel = 'Started';
        break;
      case 'LOADING':
        statusColor = KTColors.fleetAccent;
        statusLabel = 'Loading';
        break;
      case 'UNLOADING':
        statusColor = KTColors.fleetAccent;
        statusLabel = 'Unloading';
        break;
      case 'COMPLETED':
        statusColor = KTColors.success;
        statusLabel = 'Completed';
        break;
      case 'CANCELLED':
        statusColor = KTColors.danger;
        statusLabel = 'Cancelled';
        break;
      default:
        statusColor = KTColors.textMuted;
        statusLabel = status.replaceAll('_', ' ');
    }

    return GestureDetector(
      onTap: () => _showTripDetail(context, trip),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDelayed
                ? KTColors.fleetAccent.withValues(alpha: 0.5)
                : (isCompleted && !paymentApproved && driverPay > 0)
                    ? KTColors.success.withValues(alpha: 0.4)
                    : KTColors.borderColor,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Trip ID + Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(tripNumber,
                    style: KTTextStyles.mono.copyWith(color: KTColors.fleetAccent, fontWeight: FontWeight.w700)),
                KTStatusBadge(label: statusLabel, color: statusColor),
              ],
            ),
            const SizedBox(height: 8),

            // Row 2: Driver + Vehicle
            Row(
              children: [
                const Icon(Icons.person_outline, size: 14, color: KTColors.textMuted),
                const SizedBox(width: 4),
                Text(driverName.isNotEmpty ? driverName : '—',
                    style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                const SizedBox(width: 16),
                const Icon(Icons.local_shipping_outlined, size: 14, color: KTColors.textMuted),
                const SizedBox(width: 4),
                Text(vehicleNo, style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
              ],
            ),
            const SizedBox(height: 8),

            // Row 3: Route
            Row(
              children: [
                Expanded(
                  child: Text(origin,
                      style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                      overflow: TextOverflow.ellipsis),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.arrow_forward, size: 16, color: KTColors.fleetAccent),
                ),
                Expanded(
                  child: Text(destination,
                      style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right),
                ),
              ],
            ),
            if (eta.isNotEmpty) ...[              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.schedule, size: 13, color: isDelayed ? KTColors.fleetAccent : KTColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    'ETA: $eta${isDelayed ? ' · DELAYED' : ''}',
                    style: KTTextStyles.caption.copyWith(
                      color: isDelayed ? KTColors.fleetAccent : KTColors.textMuted,
                      fontWeight: isDelayed ? FontWeight.w700 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ],
            // ── Approve Payment button for completed trips ──────────
            if (isCompleted && !paymentApproved && driverPay > 0) ...[              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: Text('Approve Payment  ·  ₹${driverPay.toStringAsFixed(0)}'),
                  style: FilledButton.styleFrom(
                    backgroundColor: KTColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  onPressed: () => _approveCompletion(context, trip),
                ),
              ),
            ],
            if (isCompleted && paymentApproved) ...[              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.check_circle, size: 14, color: KTColors.success),
                  const SizedBox(width: 4),
                  Text('Payment queued for accountant',
                      style: KTTextStyles.caption.copyWith(color: KTColors.success)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _approveCompletion(BuildContext context, Map<String, dynamic> trip) async {
    final tripId = trip['id'] as int?;
    if (tripId == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KTColors.surface,
        title: const Text('Approve Trip Completion', style: TextStyle(color: KTColors.textHeading)),
        content: Text(
          'Approve payment of ₹${((trip['driver_pay'] as num? ?? 0)).toStringAsFixed(0)} '
          'for driver ${trip['driver_name'] ?? '—'}?\n\nThis will send the payment to the accountant queue.',
          style: const TextStyle(color: KTColors.textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: KTColors.textMuted)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: KTColors.success),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/admin/trips/$tripId/approve-completion', data: {});
      ref.invalidate(fleetTripsProvider(_dateFilter));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment queued for accountant'),
            backgroundColor: KTColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  void _showTripDetail(BuildContext context, Map<String, dynamic> trip) {
    final tripId = trip['id'];
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: KTColors.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Trip ${trip['trip_number'] ?? '#$tripId'}',
              style: KTTextStyles.h2.copyWith(color: KTColors.textHeading),
            ),
            const SizedBox(height: 4),
            Text(
              '${trip['origin'] ?? '—'} → ${trip['destination'] ?? '—'}',
              style: KTTextStyles.body.copyWith(color: KTColors.textMuted),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: KTButton.primary(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/fleet/map');
                    },
                    label: 'Track Live',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: KTButton.secondary(
                    onPressed: () => Navigator.pop(context),
                    label: 'Contact Driver',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
