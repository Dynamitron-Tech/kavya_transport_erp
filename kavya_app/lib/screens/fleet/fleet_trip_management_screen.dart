import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';
import '../../services/api_service.dart';

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
            tooltip: 'Create LR',
            onPressed: () async {
              final result = await context.push('/fleet/lr/create');
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
          ],
        ),
      ),
    );
  }

  void _showTripDetail(BuildContext context, Map<String, dynamic> trip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _TripDetailSheet(trip: trip, ref: ref),
    );
  }
}

// ─── Trip Detail Sheet ───────────────────────────────────────────────────────

class _TripDetailSheet extends StatefulWidget {
  final Map<String, dynamic> trip;
  final WidgetRef ref;

  const _TripDetailSheet({required this.trip, required this.ref});

  @override
  State<_TripDetailSheet> createState() => _TripDetailSheetState();
}

class _TripDetailSheetState extends State<_TripDetailSheet> {
  List<dynamic>? _expenses;
  List<dynamic>? _fuelEntries;
  Map<String, dynamic>? _checklistData;
  List<dynamic> _tripDocPhotos = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final tripId = widget.trip['id'] as int?;
    if (tripId == null) {
      setState(() { _loading = false; _error = 'Invalid trip'; });
      return;
    }
    try {
      final api = widget.ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.getTripExpenses(tripId),
        api.getTripFuelEntries(tripId),
        api.getTripDocumentPhotos(tripId),
      ]);
      final checklist = await api.getTripChecklist(tripId);
      setState(() {
        _expenses = results[0];
        _fuelEntries = results[1];
        _tripDocPhotos = results[2];
        _checklistData = checklist;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  double _parseNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final trip = widget.trip;
    final tripNumber = trip['trip_number']?.toString() ?? '#${trip['id']}';
    final origin = trip['origin']?.toString() ?? '—';
    final destination = trip['destination']?.toString() ?? '—';
    final startOdo = _parseNum(trip['start_odometer']);
    final endOdo = _parseNum(trip['end_odometer']);

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (_, scrollCtrl) => Column(
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: KTColors.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tripNumber,
                          style: KTTextStyles.h2.copyWith(
                              color: KTColors.fleetAccent, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text('$origin → $destination',
                          style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 20),
          // Body
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline, color: KTColors.danger, size: 40),
                            const SizedBox(height: 8),
                            Text('Failed to load expenses',
                                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                          ],
                        ),
                      )
                    : _buildBody(scrollCtrl, startOdo, endOdo),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(ScrollController scrollCtrl, double startOdo, double endOdo) {
    final expenses = _expenses ?? [];
    final fuelEntries = _fuelEntries ?? [];

    // Parse LR & E-way numbers from remarks
    final remarks = widget.trip['remarks']?.toString() ?? '';
    String? lrNumber;
    String? ewayNumber;
    final submittedMatch = RegExp(r'\[Driver submitted\] (.+)', caseSensitive: false).firstMatch(remarks);
    if (submittedMatch != null) {
      final line = submittedMatch.group(1) ?? '';
      final lrMatch = RegExp(r'LR:\s*([^\s|]+)', caseSensitive: false).firstMatch(line);
      final ewayMatch = RegExp(r'E-way:\s*([^\s|]+)', caseSensitive: false).firstMatch(line);
      lrNumber = lrMatch?.group(1);
      ewayNumber = ewayMatch?.group(1);
    }
    final tripStatus = (widget.trip['status']?.toString() ?? '').toLowerCase();
    final lrEwaySubmitted = ['started', 'loading', 'in_transit', 'unloading', 'completed'].contains(tripStatus);

    // Group expenses by category
    final loadingExpenses = expenses
        .where((e) => (e['category']?.toString() ?? '').toUpperCase() == 'LOADING')
        .toList();
    final unloadingExpenses = expenses
        .where((e) => (e['category']?.toString() ?? '').toUpperCase() == 'UNLOADING')
        .toList();
    final repairExpenses = expenses
        .where((e) => (e['category']?.toString() ?? '').toUpperCase() == 'REPAIR')
        .toList();

    // Fuel totals from fuel entries
    final totalFuelLitres = fuelEntries.fold<double>(
        0, (sum, f) => sum + _parseNum(f['quantity_litres']));
    final totalFuelAmount = fuelEntries.fold<double>(
        0, (sum, f) => sum + _parseNum(f['total_amount']));

    // Mileage: (endOdo - startOdo) / totalFuelLitres
    final double? mileage = (endOdo > 0 && startOdo > 0 && totalFuelLitres > 0)
        ? (endOdo - startOdo) / totalFuelLitres
        : null;

    final loadingTotal = loadingExpenses.fold<double>(0, (s, e) => s + _parseNum(e['amount']));
    final unloadingTotal = unloadingExpenses.fold<double>(0, (s, e) => s + _parseNum(e['amount']));
    final repairTotal = repairExpenses.fold<double>(0, (s, e) => s + _parseNum(e['amount']));
    final grandTotal = loadingTotal + unloadingTotal + repairTotal + totalFuelAmount;

    return ListView(
      controller: scrollCtrl,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      children: [
        // ── Documents Section ─────────────────────────────────
        _sectionTitle('Driver Documents', Icons.description_outlined),
        const SizedBox(height: 10),
        _documentsCard(lrEwaySubmitted, lrNumber, ewayNumber),
        const SizedBox(height: 20),

        // ── Checklist Completion ──────────────────────────────
        _sectionTitle('Checklist Completion', Icons.checklist_rounded),
        const SizedBox(height: 10),
        _buildChecklistCompletionCard(widget.trip['driver_name']?.toString() ?? 'Driver'),
        const SizedBox(height: 20),

        // ── Expenses Section ──────────────────────────────────
        _sectionTitle('Driver Expenses', Icons.receipt_long_outlined),
        const SizedBox(height: 10),

        if (expenses.isEmpty && fuelEntries.isEmpty) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: KTColors.lightBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: const Center(
              child: Text('No expenses submitted yet',
                  style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
            ),
          ),
        ] else ...[
          // Loading Charge
          if (loadingExpenses.isNotEmpty)
            _expenseRow(
              icon: Icons.upload_rounded,
              iconColor: KTColors.success,
              label: 'Loading Charge',
              amount: loadingTotal,
            ),

          // Unloading Charge
          if (unloadingExpenses.isNotEmpty)
            _expenseRow(
              icon: Icons.download_rounded,
              iconColor: KTColors.driverAccent,
              label: 'Unloading Charge',
              amount: unloadingTotal,
            ),

          // Repairs
          if (repairExpenses.isNotEmpty) ...[
            _expenseCategoryHeader(
              icon: Icons.build_outlined,
              iconColor: Colors.amber,
              label: 'Repairs',
              total: repairTotal,
            ),
            ...repairExpenses.map((r) {
              final type = r['sub_category']?.toString() ?? r['description']?.toString() ?? 'Repair';
              final amt = _parseNum(r['amount']);
              return Padding(
                padding: const EdgeInsets.only(left: 40, bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(type,
                          style: const TextStyle(fontSize: 13, color: KTColors.textSecondary)),
                    ),
                    Text('₹${amt.toStringAsFixed(2)}',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: KTColors.textHeading)),
                  ],
                ),
              );
            }),
            const SizedBox(height: 4),
          ],
        ],

        const SizedBox(height: 16),

        // ── Fuel Section ──────────────────────────────────────
        _sectionTitle('Fuel', Icons.local_gas_station_rounded),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: KTColors.lightBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            children: [
              _fuelDetailRow('Total Litres Used', '${totalFuelLitres.toStringAsFixed(2)} L'),
              const Divider(height: 18),
              _fuelDetailRow(
                'Odometer at Departure',
                startOdo > 0 ? '${startOdo.toStringAsFixed(0)} km' : '—',
              ),
              const Divider(height: 18),
              _fuelDetailRow(
                'Odometer at Arrival',
                endOdo > 0 ? '${endOdo.toStringAsFixed(0)} km' : '—',
              ),
              const Divider(height: 18),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Average Mileage for this Trip',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: KTColors.textHeading),
                    ),
                  ),
                  Text(
                    mileage != null ? '${mileage.toStringAsFixed(2)} km/L' : '—',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: mileage != null ? KTColors.fleetAccent : KTColors.textMuted,
                    ),
                  ),
                ],
              ),
              if (mileage == null) ...[
                const SizedBox(height: 6),
                const Text(
                  '(Requires odometer readings + fuel litres)',
                  style: TextStyle(fontSize: 11, color: KTColors.textMuted),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Checklist & Document Photos ───────────────────────
        _buildPhotosSection(),
        const SizedBox(height: 20),

        // ── Grand Total ───────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            color: KTColors.fleetAccent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.fleetAccent.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Expenses',
                  style: TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700, color: KTColors.textHeading)),
              Text(
                '₹${grandTotal.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w800, color: KTColors.fleetAccent),
              ),
            ],
          ),
        ),

        // ── Expense Payment Status ─────────────────────────────
        ..._buildExpensePaymentStatus(expenses),
      ],
    );
  }

  List<Widget> _buildExpensePaymentStatus(List<dynamic> expenses) {
    // Find any paid expense that has paid_by_name/paid_at
    final paidExpenses = expenses
        .where((e) => e['paid_at'] != null && e['paid_by_name'] != null)
        .toList();
    if (paidExpenses.isEmpty) return [];

    // Collect unique FM names and latest paid_at
    final fmName = paidExpenses.first['paid_by_name']?.toString() ?? 'Finance Manager';
    final latestPaidAt = paidExpenses.fold<String?>(null, (latest, e) {
      final d = e['paid_at']?.toString();
      if (d == null) return latest;
      if (latest == null) return d;
      return d.compareTo(latest) > 0 ? d : latest;
    });

    String formattedDate = '';
    if (latestPaidAt != null) {
      try {
        final dt = DateTime.parse(latestPaidAt).toLocal();
        formattedDate =
            '${dt.day.toString().padLeft(2, '0')} ${_monthShort(dt.month)} ${dt.year}, ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        formattedDate = latestPaidAt.substring(0, 10);
      }
    }

    return [
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.success.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.success.withValues(alpha: 0.35)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: KTColors.success.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_rounded, size: 18, color: KTColors.success),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Expenses Paid',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: KTColors.success,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Expenses was paid by the Financial Manager $fmName',
                    style: const TextStyle(
                      fontSize: 12,
                      color: KTColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  if (formattedDate.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'on $formattedDate',
                      style: const TextStyle(
                        fontSize: 11,
                        color: KTColors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ];
  }

  String _monthShort(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  }

  Widget _buildChecklistCompletionCard(String driverName) {
    final completed = _checklistData != null && _checklistData!['completed_at'] != null;
    final name = driverName.isNotEmpty ? driverName : 'Driver';
    final statusColor = completed ? KTColors.success : KTColors.warning;

    return Container(
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          // Status bar
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                Icon(
                  completed ? Icons.verified_rounded : Icons.pending_actions_rounded,
                  size: 16,
                  color: statusColor,
                ),
                const SizedBox(width: 8),
                Text(
                  completed ? 'Checklist Completed' : 'Checklist Pending',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Icon(Icons.person_outline_rounded,
                      size: 20, color: KTColors.textSecondary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: KTColors.textHeading,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        completed
                            ? 'Vehicle inspection checklist has been\ncompleted before departure.'
                            : 'Vehicle inspection checklist has not\nbeen completed yet.',
                        style: TextStyle(
                          fontSize: 12,
                          color: KTColors.textMuted,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    completed ? 'DONE' : 'PENDING',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: statusColor,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotosSection() {
    final items = (_checklistData?['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final photoItems = items.where((i) => i['photo'] != null && (i['photo'] as String).isNotEmpty).toList();
    final staticBase = ApiService.baseUrl.replaceFirst('/api/v1', '');
    final hasChecklist = photoItems.isNotEmpty;
    final hasLr = _tripDocPhotos.any((d) => d['type'] == 'lr');
    final hasEway = _tripDocPhotos.any((d) => d['type'] == 'eway');

    // Driver-uploaded phase photos from trip fields
    final loadedUrl = widget.trip['loaded_image_url'] as String?;
    final reachedUrl = widget.trip['reached_image_url'] as String?;
    final unloadedUrl = widget.trip['unloaded_image_url'] as String?;
    final podUrl = widget.trip['pod_image_url'] as String?;
    final phasePhotos = <Map<String, String>>[
      if (loadedUrl != null && loadedUrl.isNotEmpty)
        {'label': 'Loaded', 'url': '$staticBase$loadedUrl'},
      if (reachedUrl != null && reachedUrl.isNotEmpty)
        {'label': 'Reached', 'url': '$staticBase$reachedUrl'},
      if (unloadedUrl != null && unloadedUrl.isNotEmpty)
        {'label': 'Un-Loaded', 'url': '$staticBase$unloadedUrl'},
      if (podUrl != null && podUrl.isNotEmpty)
        {'label': 'Proof of Delivery', 'url': '$staticBase$podUrl'},
    ];
    final hasPhase = phasePhotos.isNotEmpty;

    if (!hasPhase && !hasChecklist && !hasLr && !hasEway) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Checklist & Documents', Icons.photo_library_outlined),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: KTColors.lightBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: const Center(
              child: Text('No photos submitted yet',
                  style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Checklist & Documents', Icons.photo_library_outlined),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: KTColors.lightBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Driver phase photos: LOADED, REACHED, UN-LOADED, POD
              if (hasPhase) ...[
                Row(children: [
                  Icon(Icons.photo_camera_rounded, size: 13, color: KTColors.fleetAccent),
                  const SizedBox(width: 5),
                  const Text('Driver Trip Photos',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                          color: KTColors.textSecondary, letterSpacing: 0.3)),
                ]),
                const SizedBox(height: 10),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: phasePhotos.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.3,
                  ),
                  itemBuilder: (_, idx) {
                    final photo = phasePhotos[idx];
                    final label = photo['label']!;
                    final url = photo['url']!;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              url,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              errorBuilder: (_, __, ___) => Container(
                                decoration: BoxDecoration(
                                  color: KTColors.fleetAccent.withValues(alpha: 0.07),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: KTColors.fleetAccent.withValues(alpha: 0.3)),
                                ),
                                child: const Center(
                                  child: Icon(Icons.broken_image_outlined, color: KTColors.textMuted),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(label,
                            style: const TextStyle(
                                fontSize: 11, color: KTColors.textMuted,
                                fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ],
                    );
                  },
                ),
              ],
              // Checklist photos
              if (hasChecklist) ...[
                if (hasPhase) ...[
                  const Divider(height: 24),
                ],
                Row(children: [
                  Icon(Icons.checklist_rounded, size: 13, color: KTColors.fleetAccent),
                  const SizedBox(width: 5),
                  const Text('Checklist',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                          color: KTColors.textSecondary, letterSpacing: 0.3)),
                ]),
                const SizedBox(height: 10),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: photoItems.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.3,
                  ),
                  itemBuilder: (_, idx) {
                    final item = photoItems[idx];
                    final label = item['label'] as String? ?? 'Item';
                    final photoB64 = item['photo'] as String;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.memory(
                              base64Decode(photoB64),
                              fit: BoxFit.cover,
                              width: double.infinity,
                              errorBuilder: (_, __, ___) => Container(
                                color: KTColors.borderColor,
                                child: const Icon(Icons.broken_image_outlined,
                                    color: KTColors.textMuted),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(label,
                            style: const TextStyle(
                                fontSize: 11, color: KTColors.textMuted,
                                fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ],
                    );
                  },
                ),
              ],
              // LR Photo
              if (hasLr) ...[
                if (hasPhase || hasChecklist) ...[
                  const Divider(height: 24),
                ],
                Row(children: [
                  Icon(Icons.receipt_long_outlined, size: 13, color: KTColors.fleetAccent),
                  const SizedBox(width: 5),
                  const Text('LR Document',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                          color: KTColors.textSecondary, letterSpacing: 0.3)),
                ]),
                const SizedBox(height: 10),
                Builder(builder: (_) {
                  final doc = _tripDocPhotos.firstWhere((d) => d['type'] == 'lr');
                  final url = '$staticBase${doc['url']}';
                  return _docPhotoTile(url);
                }),
              ],
              // E-way Photo
              if (hasEway) ...[
                if (hasPhase || hasChecklist || hasLr) ...[
                  const Divider(height: 24),
                ],
                Row(children: [
                  Icon(Icons.article_outlined, size: 13, color: KTColors.fleetAccent),
                  const SizedBox(width: 5),
                  const Text('E-way Bill',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                          color: KTColors.textSecondary, letterSpacing: 0.3)),
                ]),
                const SizedBox(height: 10),
                Builder(builder: (_) {
                  final doc = _tripDocPhotos.firstWhere((d) => d['type'] == 'eway');
                  final url = '$staticBase${doc['url']}';
                  return _docPhotoTile(url);
                }),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _docPhotoTile(String url) {
    final isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: KTColors.fleetAccent.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: KTColors.fleetAccent.withValues(alpha: 0.3)),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.picture_as_pdf_rounded, size: 32, color: KTColors.fleetAccent),
              SizedBox(height: 6),
              Text('PDF Document', style: TextStyle(fontSize: 12, color: KTColors.textMuted)),
            ],
          ),
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        height: 180,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          height: 60,
          decoration: BoxDecoration(
            color: KTColors.borderColor.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Center(
            child: Text('Unable to load image',
                style: TextStyle(fontSize: 12, color: KTColors.textMuted)),
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) => Row(
        children: [
          Icon(icon, size: 16, color: KTColors.fleetAccent),
          const SizedBox(width: 6),
          Text(title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: KTColors.textSecondary,
                  letterSpacing: 0.5)),
        ],
      );

  Widget _expenseRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required double amount,
  }) =>
      Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
            Text('₹${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700, color: KTColors.textHeading)),
          ],
        ),
      );

  Widget _expenseCategoryHeader({
    required IconData icon,
    required Color iconColor,
    required String label,
    required double total,
  }) =>
      Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
                child: Text(label,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            Text('₹${total.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700, color: KTColors.textHeading)),
          ],
        ),
      );

  Widget _documentsCard(bool submitted, String? lrNumber, String? ewayNumber) {
    if (!submitted) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.lightBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: KTColors.textMuted.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.hourglass_empty_rounded, size: 18, color: KTColors.textMuted),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Awaiting LR & E-way',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: KTColors.textHeading)),
                  SizedBox(height: 2),
                  Text('Driver has not yet submitted documents',
                      style: TextStyle(fontSize: 12, color: KTColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.success.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.success.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: KTColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(Icons.check_circle_outline_rounded, size: 16, color: KTColors.success),
              ),
              const SizedBox(width: 8),
              const Text('Documents Submitted',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: KTColors.success)),
            ],
          ),
          if (lrNumber != null || ewayNumber != null) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),
          ],
          if (lrNumber != null) ...[
            _docRow(Icons.receipt_long_outlined, 'LR Number', lrNumber),
            const SizedBox(height: 8),
          ],
          if (ewayNumber != null)
            _docRow(Icons.inventory_2_outlined, 'E-way Number', ewayNumber),
          if (lrNumber == null && ewayNumber == null) ...[
            const SizedBox(height: 8),
            const Text('Files uploaded — no document numbers recorded',
                style: TextStyle(fontSize: 12, color: KTColors.textMuted)),
          ],
        ],
      ),
    );
  }

  Widget _docRow(IconData icon, String label, String value) => Row(
        children: [
          Icon(icon, size: 15, color: KTColors.fleetAccent),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 13, color: KTColors.textSecondary)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700, color: KTColors.textHeading),
            ),
          ),
        ],
      );

  Widget _fuelDetailRow(String label, String value) => Row(
        children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(fontSize: 13, color: KTColors.textSecondary))),
          Text(value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: KTColors.textHeading)),
        ],
      );
}
