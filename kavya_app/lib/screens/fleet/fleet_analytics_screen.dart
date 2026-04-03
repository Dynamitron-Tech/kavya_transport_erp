import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final _tripPnlProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fleet/pnl/trips');
  final raw = res['data'];
  return (raw is List) ? raw.cast<Map<String, dynamic>>() : <Map<String, dynamic>>[];
});

final _vehiclePnlProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({int month, int year})>(
        (ref, params) async {
  final api = ref.read(apiServiceProvider);
  final res = await api
      .get('/fleet/pnl/vehicles?month=${params.month}&year=${params.year}');
  final raw = res['data'];
  return (raw is List) ? raw.cast<Map<String, dynamic>>() : <Map<String, dynamic>>[];
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class FleetAnalyticsScreen extends ConsumerStatefulWidget {
  const FleetAnalyticsScreen({super.key});

  @override
  ConsumerState<FleetAnalyticsScreen> createState() => _FleetAnalyticsScreenState();
}

class _FleetAnalyticsScreenState extends ConsumerState<FleetAnalyticsScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text(
          'Fleet Analytics',
          style: KTTextStyles.h2.copyWith(
              color: KTColors.textHeading, decoration: TextDecoration.none),
        ),
      ),
      body: Column(
        children: [
          Container(
            color: KTColors.surface,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Row(
              children: [
                _TabButton(
                  label: 'Trips Analytics',
                  icon: Icons.local_shipping_outlined,
                  selected: _tab == 0,
                  onTap: () => setState(() => _tab = 0),
                ),
                const SizedBox(width: 10),
                _TabButton(
                  label: 'Vehicle Analytics',
                  icon: Icons.directions_car_outlined,
                  selected: _tab == 1,
                  onTap: () => setState(() => _tab = 1),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: KTColors.borderColor),
          Expanded(
            child: _tab == 0
                ? _TripsAnalyticsTab()
                : _VehiclesAnalyticsTab(),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: selected
                ? KTColors.fleetAccent.withValues(alpha: 0.12)
                : KTColors.lightBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? KTColors.fleetAccent : KTColors.borderColor,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16,
                  color: selected ? KTColors.fleetAccent : KTColors.textMuted),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? KTColors.fleetAccent : KTColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Trips Analytics Tab ─────────────────────────────────────────────────────

class _TripsAnalyticsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pnlAsync = ref.watch(_tripPnlProvider);
    return pnlAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: KTColors.fleetAccent)),
      error: (e, _) => _ErrorView(
        message: 'Could not load trip P&L',
        onRetry: () => ref.invalidate(_tripPnlProvider),
      ),
      data: (trips) {
        if (trips.isEmpty) {
          return const _EmptyView(
            icon: Icons.local_shipping_outlined,
            message: 'No completed trips yet',
          );
        }
        // Summary totals
        final totalRevenue = trips.fold<double>(
            0, (s, t) => s + (t['revenue'] as num? ?? 0).toDouble());
        final totalProfit = trips.fold<double>(
            0, (s, t) => s + (t['profit'] as num? ?? 0).toDouble());
        final profitPct =
            totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0.0;

        return RefreshIndicator(
          color: KTColors.fleetAccent,
          onRefresh: () async => ref.invalidate(_tripPnlProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Summary Banner ───────────────────────────────────────────
              _SummaryBanner(
                leftLabel: 'Total Revenue',
                leftValue: _rupee(totalRevenue),
                rightLabel: 'Net Profit',
                rightValue: _rupee(totalProfit),
                rightColor: totalProfit >= 0 ? KTColors.success : KTColors.danger,
                badge: '${profitPct.toStringAsFixed(1)}% Margin',
                badgePositive: totalProfit >= 0,
              ),
              const SizedBox(height: 14),
              // ── Trip Cards ───────────────────────────────────────────────
              ...trips.asMap().entries.map((e) {
                final isLast = e.key == trips.length - 1;
                return Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                  child: _TripPnlCard(trip: e.value),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}

class _TripPnlCard extends StatefulWidget {
  const _TripPnlCard({required this.trip});
  final Map<String, dynamic> trip;

  @override
  State<_TripPnlCard> createState() => _TripPnlCardState();
}

class _TripPnlCardState extends State<_TripPnlCard> {
  bool _expanded = false;

  String _formatDate(dynamic raw) {
    if (raw == null) return '—';
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${dt.day} ${m[dt.month - 1]}';
    } catch (_) {
      return raw.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.trip;
    final tripNumber = t['trip_number']?.toString() ?? '—';
    final origin = t['origin']?.toString() ?? '—';
    final dest = t['destination']?.toString() ?? '—';
    final driver = t['driver_name']?.toString() ?? '—';
    final vehicleReg = (t['vehicle_registration'] ?? '—').toString();
    final dateStr = _formatDate(t['actual_end'] ?? t['trip_date']);

    final revenue = (t['revenue'] as num? ?? 0).toDouble();
    final fuelCost = (t['fuel_cost'] as num? ?? 0).toDouble();
    final fuelLitres = (t['fuel_litres'] as num? ?? 0).toDouble();
    final ratePerLitre = (t['rate_per_litre'] as num? ?? 0).toDouble();
    final driverCost = (t['driver_cost'] as num? ?? 0).toDouble();
    final tollCost = (t['toll_cost'] as num? ?? 0).toDouble();
    final loadingCost = (t['loading_cost'] as num? ?? 0).toDouble();
    final otherCost = (t['other_cost'] as num? ?? 0).toDouble();
    final totalCost = (t['total_cost'] as num? ?? 0).toDouble();
    final profit = (t['profit'] as num? ?? 0).toDouble();
    final profitPct = (t['profit_pct'] as num? ?? 0).toDouble();
    final profitPerKm = (t['profit_per_km'] as num? ?? 0).toDouble();
    final distanceKm = (t['distance_km'] as num? ?? 0).toDouble();
    final isProfit = profit >= 0;
    final profitColor = isProfit ? KTColors.success : KTColors.danger;

    // Fuel sub-label: "X.X L × ₹Y.YY/L"
    final fuelSubLabel = (fuelLitres > 0 && ratePerLitre > 0)
        ? '${fuelLitres.toStringAsFixed(1)} L × ₹${ratePerLitre.toStringAsFixed(2)}/L'
        : null;

    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          // ── Header ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: profitColor.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    isProfit ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                    size: 18,
                    color: profitColor,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tripNumber,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700,
                            color: KTColors.fleetAccent),
                      ),
                      const SizedBox(height: 1),
                      Text('$origin → $dest',
                          style: const TextStyle(
                              fontSize: 11, color: KTColors.textMuted)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _rupee(profit),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: profitColor,
                      ),
                    ),
                    Container(
                      margin: const EdgeInsets.only(top: 3),
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: profitColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${isProfit ? '+' : ''}${profitPct.toStringAsFixed(1)}%',
                        style: TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            color: profitColor),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // ── Key Metrics Row ───────────────────────────────────────────
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 0),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: KTColors.borderColor),
                bottom: BorderSide(color: KTColors.borderColor),
              ),
            ),
            child: Row(
              children: [
                _MetricCell(label: 'Revenue', value: _rupee(revenue),
                    color: KTColors.info),
                _Vdivider(),
                _MetricCell(label: 'Total Cost', value: _rupee(totalCost),
                    color: KTColors.warning),
                _Vdivider(),
                _MetricCell(
                  label: distanceKm > 0
                      ? '₹/km'
                      : 'Distance',
                  value: distanceKm > 0
                      ? profitPerKm.toStringAsFixed(2)
                      : '—',
                  color: profitColor,
                ),
              ],
            ),
          ),
          // ── Sub-row: driver, vehicle, date ────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
            child: Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 12, color: KTColors.textMuted),
                const SizedBox(width: 3),
                Text(driver, style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                const SizedBox(width: 12),
                const Icon(Icons.local_shipping_outlined, size: 12, color: KTColors.textMuted),
                const SizedBox(width: 3),
                Text(vehicleReg, style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                const Spacer(),
                Text(dateStr, style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
              ],
            ),
          ),
          // ── Expand Toggle ─────────────────────────────────────────────
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
              child: Row(
                children: [
                  Text(
                    _expanded ? 'Hide breakdown' : 'Cost breakdown',
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600,
                        color: KTColors.fleetAccent),
                  ),
                  const SizedBox(width: 3),
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 14,
                    color: KTColors.fleetAccent,
                  ),
                ],
              ),
            ),
          ),
          // ── Breakdown rows ────────────────────────────────────────────
          if (_expanded) ...[
            Container(
              margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KTColors.lightBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: KTColors.borderColor),
              ),
              child: Column(
                children: [
                  _CostRow(label: 'Fuel', amount: fuelCost,
                      subLabel: fuelSubLabel,
                      icon: Icons.local_gas_station_rounded, color: KTColors.warning),
                  _CostRow(label: 'Driver Pay', amount: driverCost,
                      icon: Icons.person_rounded, color: KTColors.info),
                  _CostRow(label: 'Tolls', amount: tollCost,
                      icon: Icons.toll_rounded, color: KTColors.textMuted),
                  _CostRow(label: 'Loading/Unloading', amount: loadingCost,
                      icon: Icons.inventory_2_outlined, color: KTColors.textMuted),
                  _CostRow(label: 'Other', amount: otherCost,
                      icon: Icons.more_horiz_rounded, color: KTColors.textMuted),
                  const Divider(height: 14, color: KTColors.borderColor),
                  _CostRow(label: 'Total Cost', amount: totalCost,
                      icon: Icons.summarize_outlined, color: KTColors.danger,
                      bold: true),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(fontSize: 10, color: KTColors.textMuted)),
        ],
      ),
    );
  }
}

class _Vdivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
        width: 1, height: 28, color: KTColors.borderColor,
        margin: const EdgeInsets.symmetric(horizontal: 4));
  }
}

class _CostRow extends StatelessWidget {
  const _CostRow({required this.label, required this.amount,
      required this.icon, required this.color, this.bold = false,
      this.subLabel});
  final String label;
  final double amount;
  final IconData icon;
  final Color color;
  final bool bold;
  final String? subLabel;

  @override
  Widget build(BuildContext context) {
    if (!bold && amount == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                        color: bold ? KTColors.textHeading : KTColors.textBody)),
                if (subLabel != null)
                  Text(subLabel!,
                      style: const TextStyle(
                          fontSize: 10, color: KTColors.textMuted)),
              ],
            ),
          ),
          Text(
            _rupee(amount),
            style: TextStyle(
                fontSize: 12,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                color: bold ? KTColors.danger : KTColors.textHeading),
          ),
        ],
      ),
    );
  }
}

// ─── Vehicles Analytics Tab ───────────────────────────────────────────────────

class _VehiclesAnalyticsTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_VehiclesAnalyticsTab> createState() =>
      _VehiclesAnalyticsTabState();
}

class _VehiclesAnalyticsTabState extends ConsumerState<_VehiclesAnalyticsTab> {
  late int _month;
  late int _year;

  static const _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
  }

  void _prev() {
    setState(() {
      if (_month == 1) {
        _month = 12;
        _year -= 1;
      } else {
        _month -= 1;
      }
    });
  }

  void _next() {
    final now = DateTime.now();
    if (_year > now.year || (_year == now.year && _month >= now.month)) return;
    setState(() {
      if (_month == 12) {
        _month = 1;
        _year += 1;
      } else {
        _month += 1;
      }
    });
  }

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _month == now.month && _year == now.year;
  }

  String get _monthLabel => '${_monthNames[_month - 1]} $_year';

  @override
  Widget build(BuildContext context) {
    final params = (month: _month, year: _year);
    final pnlAsync = ref.watch(_vehiclePnlProvider(params));

    return Column(
      children: [
        // ── Month Selector ─────────────────────────────────────────────
        Container(
          color: KTColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _prev,
                icon: const Icon(Icons.chevron_left_rounded),
                color: KTColors.fleetAccent,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              Expanded(
                child: Text(
                  _monthLabel,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading,
                  ),
                ),
              ),
              IconButton(
                onPressed: _isCurrentMonth ? null : _next,
                icon: const Icon(Icons.chevron_right_rounded),
                color: _isCurrentMonth ? KTColors.borderColor : KTColors.fleetAccent,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: KTColors.borderColor),
        Expanded(
          child: pnlAsync.when(
            loading: () => const Center(
                child: CircularProgressIndicator(color: KTColors.fleetAccent)),
            error: (e, _) => _ErrorView(
              message: 'Could not load vehicle P&L',
              onRetry: () => ref.invalidate(_vehiclePnlProvider(params)),
            ),
            data: (vehicles) {
              if (vehicles.isEmpty) {
                return const _EmptyView(
                  icon: Icons.directions_car_outlined,
                  message: 'No vehicles found',
                );
              }

              final totalRevenue = vehicles.fold<double>(
                  0, (s, v) => s + (v['total_revenue'] as num? ?? 0).toDouble());
              final totalProfit = vehicles.fold<double>(
                  0, (s, v) => s + (v['profit'] as num? ?? 0).toDouble());
              final profitPct =
                  totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0.0;

              return RefreshIndicator(
                color: KTColors.fleetAccent,
                onRefresh: () async => ref.invalidate(_vehiclePnlProvider(params)),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _SummaryBanner(
                      leftLabel: 'Fleet Revenue · $_monthLabel',
                      leftValue: _rupee(totalRevenue),
                      rightLabel: 'Fleet Profit',
                      rightValue: _rupee(totalProfit),
                      rightColor:
                          totalProfit >= 0 ? KTColors.success : KTColors.danger,
                      badge: '${profitPct.toStringAsFixed(1)}% Margin',
                      badgePositive: totalProfit >= 0,
                    ),
                    const SizedBox(height: 14),
                    ...vehicles.asMap().entries.map((e) {
                      final isLast = e.key == vehicles.length - 1;
                      return Padding(
                        padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                        child: _VehiclePnlCard(vehicle: e.value),
                      );
                    }),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _VehiclePnlCard extends StatelessWidget {
  const _VehiclePnlCard({required this.vehicle});
  final Map<String, dynamic> vehicle;

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'available':   return KTColors.success;
      case 'on_trip':     return KTColors.fleetAccent;
      case 'maintenance': return KTColors.warning;
      case 'breakdown':   return KTColors.danger;
      default:            return KTColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final reg = (vehicle['registration'] ?? vehicle['registration_number'] ?? '—').toString();
    final model = vehicle['model']?.toString() ?? '—';
    final status = (vehicle['status'] ?? 'available').toString();
    final month = vehicle['month']?.toString() ?? '';
    final tripCount = (vehicle['trip_count'] as num? ?? 0).toInt();
    final completedTrips = (vehicle['completed_trips'] as num? ?? 0).toInt();

    final revenue = (vehicle['total_revenue'] as num? ?? 0).toDouble();
    final variableCost = (vehicle['variable_cost'] as num? ?? 0).toDouble();
    final maintenanceCost = (vehicle['maintenance_cost'] as num? ?? 0).toDouble();
    final totalCost = (vehicle['total_cost'] as num? ?? 0).toDouble();
    final profit = (vehicle['profit'] as num? ?? 0).toDouble();
    final profitPct = (vehicle['profit_pct'] as num? ?? 0).toDouble();
    final isProfit = profit >= 0;
    final profitColor = isProfit ? KTColors.success : KTColors.danger;
    final statusColor = _statusColor(status);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ────────────────────────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: KTColors.fleetAccent.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.local_shipping_rounded,
                    size: 18, color: KTColors.fleetAccent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(reg,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700,
                            color: KTColors.fleetAccent, letterSpacing: 0.4)),
                    Text(model,
                        style: const TextStyle(
                            fontSize: 11, color: KTColors.textMuted)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _rupee(profit),
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800,
                        color: profitColor),
                  ),
                  Container(
                    margin: const EdgeInsets.only(top: 3),
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: profitColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${isProfit ? '+' : ''}${profitPct.toStringAsFixed(1)}%',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                          color: profitColor),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: KTColors.borderColor),
          const SizedBox(height: 10),
          // ── Metrics row ───────────────────────────────────────────────
          Row(
            children: [
              _MetricCell(label: 'Revenue', value: _rupee(revenue), color: KTColors.info),
              _Vdivider(),
              _MetricCell(label: 'Var. Cost', value: _rupee(variableCost), color: KTColors.warning),
              _Vdivider(),
              _MetricCell(label: 'Maintenance', value: _rupee(maintenanceCost),
                  color: maintenanceCost > 0 ? KTColors.warning : KTColors.textMuted),
            ],
          ),
          const SizedBox(height: 10),
          // ── Footer tags ────────────────────────────────────────────────
          Row(
            children: [
              _Tag(
                label: '$completedTrips/$tripCount trips done',
                color: completedTrips > 0 ? KTColors.success : KTColors.textMuted,
              ),
              const SizedBox(width: 6),
              _Tag(
                label: status.replaceAll('_', ' ').toUpperCase(),
                color: statusColor,
              ),
              const Spacer(),
              Text(month,
                  style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
            ],
          ),
          if (totalCost > 0) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: revenue > 0 ? (totalCost / revenue).clamp(0.0, 1.0) : 0,
                minHeight: 5,
                backgroundColor: KTColors.success.withValues(alpha: 0.25),
                color: totalCost <= revenue ? KTColors.warning : KTColors.danger,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              'Cost ratio: ${revenue > 0 ? ((totalCost / revenue) * 100).toStringAsFixed(1) : '—'}%',
              style: const TextStyle(fontSize: 10, color: KTColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

String _rupee(double v) {
  if (v.abs() >= 100000) {
    return '₹${(v / 100000).toStringAsFixed(1)}L';
  }
  if (v.abs() >= 1000) {
    return '₹${(v / 1000).toStringAsFixed(1)}K';
  }
  return '₹${v.toStringAsFixed(0)}';
}

class _SummaryBanner extends StatelessWidget {
  const _SummaryBanner({
    required this.leftLabel,
    required this.leftValue,
    required this.rightLabel,
    required this.rightValue,
    required this.rightColor,
    required this.badge,
    required this.badgePositive,
  });

  final String leftLabel;
  final String leftValue;
  final String rightLabel;
  final String rightValue;
  final Color rightColor;
  final String badge;
  final bool badgePositive;

  @override
  Widget build(BuildContext context) {
    final badgeColor = badgePositive ? KTColors.success : KTColors.danger;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(leftLabel,
                    style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                const SizedBox(height: 3),
                Text(leftValue,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800,
                        color: KTColors.textHeading)),
              ],
            ),
          ),
          Container(width: 1, height: 36, color: KTColors.borderColor),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(rightLabel,
                  style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
              const SizedBox(height: 3),
              Text(rightValue,
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800,
                      color: rightColor)),
              Container(
                margin: const EdgeInsets.only(top: 3),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(badge,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                        color: badgeColor)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
          const SizedBox(height: 12),
          Text(message,
              style: const TextStyle(fontSize: 14, color: KTColors.textMuted)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.fleetAccent,
              foregroundColor: Colors.white,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 60, color: KTColors.textMuted),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: KTColors.textHeading),
          ),
        ],
      ),
    );
  }
}
