import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ──────────────────────────────────────────────────────────────

final vehicleTripHistoryProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
  (ref, vehicleId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/trips', queryParameters: {
      'vehicle_id': vehicleId,
      'limit': 100,
    });
    if (res is Map<String, dynamic>) {
      final data = res['data'];
      if (data is List) return data.cast<Map<String, dynamic>>();
    }
    return [];
  },
);

// ─── Screen ────────────────────────────────────────────────────────────────

class FleetVehicleTripHistoryScreen extends ConsumerStatefulWidget {
  final int vehicleId;
  final String registrationNumber;

  const FleetVehicleTripHistoryScreen({
    super.key,
    required this.vehicleId,
    required this.registrationNumber,
  });

  @override
  ConsumerState<FleetVehicleTripHistoryScreen> createState() =>
      _FleetVehicleTripHistoryScreenState();
}

class _FleetVehicleTripHistoryScreenState
    extends ConsumerState<FleetVehicleTripHistoryScreen> {
  String _statusFilter = 'All';
  int? _expandedId;

  static const _statusFilters = [
    'All', 'Completed', 'In Progress', 'Cancelled',
  ];

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(vehicleTripHistoryProvider(widget.vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Trip History',
                style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
            Text(widget.registrationNumber,
                style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: KTColors.fleetAccent),
            onPressed: () =>
                ref.invalidate(vehicleTripHistoryProvider(widget.vehicleId)),
          ),
        ],
      ),
      body: tripsAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.fleetAccent)),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load trip history',
                  style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () =>
                    ref.invalidate(vehicleTripHistoryProvider(widget.vehicleId)),
                style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.fleetAccent,
                    foregroundColor: Colors.white),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (allTrips) {
          final filtered = _applyFilter(allTrips);

          return Column(
            children: [
              // ── Stat strip ──────────────────────────────────
              Container(
                color: KTColors.surface,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _statItem(allTrips.length.toString(), 'Total', KTColors.fleetAccent),
                    _vDivider(),
                    _statItem(
                      allTrips.where((t) => _tripStatus(t) == 'completed').length.toString(),
                      'Completed', KTColors.success,
                    ),
                    _vDivider(),
                    _statItem(
                      _totalKm(allTrips),
                      'Total km', KTColors.info,
                    ),
                    _vDivider(),
                    _statItem(
                      _totalRevenue(allTrips),
                      'Revenue', KTColors.textHeading,
                    ),
                  ],
                ),
              ),

              // ── Status filter chips ──────────────────────────
              SizedBox(
                height: 46,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  scrollDirection: Axis.horizontal,
                  itemCount: _statusFilters.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final f = _statusFilters[i];
                    final selected = _statusFilter == f;
                    return FilterChip(
                      label: Text(f),
                      selected: selected,
                      onSelected: (_) => setState(() {
                        _statusFilter = f;
                        _expandedId = null;
                      }),
                      labelStyle: KTTextStyles.label.copyWith(
                          color: selected ? Colors.white : KTColors.textMuted),
                      selectedColor: KTColors.fleetAccent,
                      backgroundColor: KTColors.surface,
                      side: BorderSide(
                          color: selected
                              ? KTColors.fleetAccent
                              : KTColors.borderColor),
                      showCheckmark: false,
                    );
                  },
                ),
              ),

              // ── Trip list ────────────────────────────────────
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.route_outlined,
                                size: 56, color: KTColors.textMuted),
                            const SizedBox(height: 12),
                            Text('No trips found',
                                style: KTTextStyles.h3
                                    .copyWith(color: KTColors.textMuted)),
                            const SizedBox(height: 4),
                            Text(
                              allTrips.isEmpty
                                  ? 'No trips have been assigned to this vehicle'
                                  : 'Try a different filter',
                              style: KTTextStyles.bodySmall
                                  .copyWith(color: KTColors.textMuted),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: KTColors.fleetAccent,
                        onRefresh: () async => ref.invalidate(
                            vehicleTripHistoryProvider(widget.vehicleId)),
                        child: ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(16, 8, 16, 32),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) =>
                              _TripCard(
                            trip: filtered[i],
                            isExpanded: _expandedId == filtered[i]['id'],
                            onTap: () => setState(() {
                              final id = filtered[i]['id'] as int?;
                              _expandedId =
                                  _expandedId == id ? null : id;
                            }),
                          ),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  List<Map<String, dynamic>> _applyFilter(List<Map<String, dynamic>> trips) {
    if (_statusFilter == 'All') return trips;
    final target = _statusFilter.toLowerCase().replaceAll(' ', '_');
    // In Progress covers all non-terminal states
    if (_statusFilter == 'In Progress') {
      return trips
          .where((t) =>
              !['completed', 'cancelled'].contains(_tripStatus(t)))
          .toList();
    }
    return trips.where((t) => _tripStatus(t) == target).toList();
  }

  String _tripStatus(Map<String, dynamic> t) =>
      (t['status'] ?? '').toString().toLowerCase();

  String _totalKm(List<Map<String, dynamic>> trips) {
    double km = 0;
    for (final t in trips) {
      km += num.tryParse(
              (t['actual_distance_km'] ?? t['planned_distance_km'])
                  ?.toString() ??
                  '') ??
          0;
    }
    return km >= 1000
        ? '${(km / 1000).toStringAsFixed(1)}k'
        : km.toStringAsFixed(0);
  }

  String _totalRevenue(List<Map<String, dynamic>> trips) {
    double rev = 0;
    for (final t in trips) {
      rev += num.tryParse(t['revenue']?.toString() ?? '') ?? 0;
    }
    if (rev >= 100000) return '₹${(rev / 100000).toStringAsFixed(1)}L';
    if (rev >= 1000) return '₹${(rev / 1000).toStringAsFixed(1)}k';
    return '₹${rev.toStringAsFixed(0)}';
  }

  Widget _statItem(String value, String label, Color color) => Column(
        children: [
          Text(value,
              style: KTTextStyles.body.copyWith(
                  color: color, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
        ],
      );

  Widget _vDivider() => Container(
      height: 30, width: 1, color: KTColors.borderColor);
}

// ─── Trip Card ─────────────────────────────────────────────────────────────

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool isExpanded;
  final VoidCallback onTap;

  const _TripCard({
    required this.trip,
    required this.isExpanded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final status = (trip['status'] ?? '').toString().toLowerCase();
    final statusColor = _statusColor(status);
    final tripNumber = (trip['trip_number'] ?? '—').toString();
    final origin = (trip['origin'] ?? '—').toString();
    final destination = (trip['destination'] ?? '—').toString();
    final tripDate = _formatDate(trip['trip_date']?.toString());
    final driverName = (trip['driver_name'] ?? '—').toString();

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isExpanded
                  ? KTColors.fleetAccent
                  : KTColors.borderColor,
              width: isExpanded ? 1.5 : 1),
        ),
        child: Column(
          children: [
            // ── Header ───────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          tripNumber,
                          style: KTTextStyles.body.copyWith(
                            color: KTColors.fleetAccent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                              color: statusColor.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          status.replaceAll('_', ' ').toUpperCase(),
                          style: KTTextStyles.label.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        isExpanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: KTColors.textMuted,
                        size: 20,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Route row
                  Row(
                    children: [
                      const Icon(Icons.circle, color: KTColors.success, size: 8),
                      const SizedBox(width: 6),
                      Expanded(
                          child: Text(origin,
                              style: KTTextStyles.bodySmall
                                  .copyWith(color: KTColors.textHeading))),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 3),
                    child: Container(
                        width: 1, height: 12, color: KTColors.borderColor),
                  ),
                  Row(
                    children: [
                      const Icon(Icons.location_on,
                          color: KTColors.fleetAccent, size: 10),
                      const SizedBox(width: 4),
                      Expanded(
                          child: Text(destination,
                              style: KTTextStyles.bodySmall
                                  .copyWith(color: KTColors.textHeading))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined,
                          size: 13, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Text(tripDate,
                          style: KTTextStyles.label
                              .copyWith(color: KTColors.textMuted)),
                      const SizedBox(width: 16),
                      const Icon(Icons.person_outline,
                          size: 13, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(driverName,
                            style: KTTextStyles.label
                                .copyWith(color: KTColors.textMuted),
                            overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── Expanded detail ───────────────────────────────
            if (isExpanded) ...[
              Container(
                  height: 1,
                  color: KTColors.borderColor,
                  margin: const EdgeInsets.symmetric(horizontal: 14)),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('TRIP DETAILS',
                        style: KTTextStyles.label.copyWith(
                            color: KTColors.textMuted,
                            letterSpacing: 1.1,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 24,
                      runSpacing: 10,
                      children: [
                        _detail('Start Odometer',
                            _formatNum(trip['start_odometer'], suffix: ' km')),
                        _detail('End Odometer',
                            _formatNum(trip['end_odometer'], suffix: ' km')),
                        _detail('Distance',
                            _formatNum(
                                trip['actual_distance_km'] ??
                                    trip['planned_distance_km'],
                                suffix: ' km',
                                fallback: '—')),
                        _detail('Fuel Used',
                            _formatNum(trip['actual_fuel_litres'],
                                suffix: ' L')),
                        _detail('Fuel Cost',
                            _formatNum(trip['fuel_cost'], prefix: '₹')),
                        _detail('Total Expense',
                            _formatNum(trip['total_expense'], prefix: '₹')),
                        _detail('Revenue',
                            _formatNum(trip['revenue'], prefix: '₹')),
                        _detail('Profit / Loss',
                            _formatPL(trip['profit_loss'])),
                        _detail('Driver Advance',
                            _formatNum(trip['driver_advance'], prefix: '₹')),
                        _detail('POD',
                            trip['pod_collected'] == true ? 'Collected' : 'Pending'),
                        if (trip['actual_start'] != null)
                          _detail('Started',
                              _formatDateTime(trip['actual_start'].toString())),
                        if (trip['actual_end'] != null)
                          _detail('Completed',
                              _formatDateTime(trip['actual_end'].toString())),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detail(String label, String value) => SizedBox(
        width: 140,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 2),
            Text(value,
                style: KTTextStyles.bodySmall.copyWith(
                    color: KTColors.textHeading,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      );

  String _formatNum(dynamic raw,
      {String prefix = '', String suffix = '', String fallback = '0'}) {
    final n = num.tryParse(raw?.toString() ?? '');
    if (n == null) return fallback;
    final s = n == n.truncate() ? n.truncate().toString() : n.toStringAsFixed(1);
    return '$prefix$s$suffix';
  }

  String _formatPL(dynamic raw) {
    final n = num.tryParse(raw?.toString() ?? '');
    if (n == null) return '—';
    final s = n.abs() == n.abs().truncate()
        ? n.abs().truncate().toString()
        : n.abs().toStringAsFixed(1);
    return n >= 0 ? '₹$s ▲' : '-₹$s ▼';
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final d = DateTime.parse(raw);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    } catch (_) {
      return raw;
    }
  }

  String _formatDateTime(String raw) {
    try {
      final d = DateTime.parse(raw).toLocal();
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} '
          '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return raw;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return KTColors.success;
      case 'in_transit':
      case 'started':
      case 'loading':
      case 'unloading':
        return KTColors.info;
      case 'cancelled':
        return KTColors.danger;
      default:
        return KTColors.warning;
    }
  }
}
