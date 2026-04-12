import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

final marketTripsProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/market-trips', queryParameters: {'limit': 500});
  if (res is Map<String, dynamic>) {
    final data = res['data'];
    if (data is List) return data;
  }
  return [];
});

class FleetMarketTripsScreen extends ConsumerStatefulWidget {
  const FleetMarketTripsScreen({super.key});

  @override
  ConsumerState<FleetMarketTripsScreen> createState() =>
      _FleetMarketTripsScreenState();
}

class _FleetMarketTripsScreenState
    extends ConsumerState<FleetMarketTripsScreen> {
  String _filter = 'All';

  static const _statuses = [
    'All',
    'PENDING',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'SETTLED',
    'CANCELLED',
  ];

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(marketTripsProvider);
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          color: KTColors.textHeading,
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Market Trips',
          style: KTTextStyles.h3.copyWith(
            color: KTColors.textHeading,
            decoration: TextDecoration.none,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            color: KTColors.textMuted,
            onPressed: () => ref.invalidate(marketTripsProvider),
          ),
        ],
      ),
      body: tripsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 40),
              const SizedBox(height: 10),
              Text(
                'Failed to load market trips',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
        ),
        data: (allTrips) {
          final filtered = _filter == 'All'
              ? allTrips
              : allTrips
                  .where((t) =>
                      (t['status'] as String?)?.toUpperCase() == _filter)
                  .toList();

          return Column(
            children: [
              // ── Stats strip ───────────────────────────────────────────
              Container(
                color: KTColors.surface,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    _StatChip('Total', '${allTrips.length}', KTColors.info),
                    const SizedBox(width: 8),
                    _StatChip(
                      'In Transit',
                      '${allTrips.where((t) => t['status'] == 'IN_TRANSIT').length}',
                      KTColors.warning,
                    ),
                    const SizedBox(width: 8),
                    _StatChip(
                      'Settled',
                      '${allTrips.where((t) => t['status'] == 'SETTLED').length}',
                      KTColors.success,
                    ),
                  ],
                ),
              ),
              // ── Filter chips ──────────────────────────────────────────
              Container(
                color: KTColors.surface,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _statuses.map((s) {
                      final active = _filter == s;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(s == 'All' ? 'All' : _labelFor(s)),
                          selected: active,
                          onSelected: (_) => setState(() => _filter = s),
                          selectedColor:
                              _colorFor(s).withValues(alpha: 0.15),
                          labelStyle: KTTextStyles.labelSmall.copyWith(
                            color: active
                                ? _colorFor(s)
                                : KTColors.textMuted,
                            fontWeight: active
                                ? FontWeight.w700
                                : FontWeight.w400,
                          ),
                          side: BorderSide(
                            color: active
                                ? _colorFor(s)
                                : KTColors.borderColor,
                          ),
                          backgroundColor: KTColors.lightBg,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 4),
                          showCheckmark: false,
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              const Divider(height: 1, color: KTColors.borderColor),
              // ── Trip list ──────────────────────────────────────────────
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.route_rounded,
                                color: KTColors.textMuted.withValues(alpha: 0.4),
                                size: 48),
                            const SizedBox(height: 12),
                            Text(
                              'No market trips found',
                              style: KTTextStyles.body.copyWith(
                                color: KTColors.textMuted,
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 10),
                        itemBuilder: (_, i) =>
                            _MarketTripCard(trip: filtered[i] as Map<String, dynamic>),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  static String _labelFor(String status) {
    switch (status) {
      case 'IN_TRANSIT':
        return 'In Transit';
      case 'PENDING':
        return 'Pending';
      case 'ASSIGNED':
        return 'Assigned';
      case 'DELIVERED':
        return 'Delivered';
      case 'SETTLED':
        return 'Settled';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status;
    }
  }

  static Color _colorFor(String status) {
    switch (status) {
      case 'PENDING':
        return KTColors.textMuted;
      case 'ASSIGNED':
        return KTColors.info;
      case 'IN_TRANSIT':
        return KTColors.warning;
      case 'DELIVERED':
        return KTColors.primary;
      case 'SETTLED':
        return KTColors.success;
      case 'CANCELLED':
        return KTColors.danger;
      default:
        return KTColors.info;
    }
  }
}

// ─── Market Trip Card ──────────────────────────────────────────────────────────
class _MarketTripCard extends StatefulWidget {
  final Map<String, dynamic> trip;
  const _MarketTripCard({required this.trip});

  @override
  State<_MarketTripCard> createState() => _MarketTripCardState();
}

class _MarketTripCardState extends State<_MarketTripCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.trip;
    final status = (t['status'] as String?) ?? 'PENDING';
    final color = _FleetMarketTripsScreenState._colorFor(status);
    final label = _FleetMarketTripsScreenState._labelFor(status);
    final regNo = (t['vehicle_registration'] as String?) ?? '—';
    final driverName = (t['driver_name'] as String?) ?? '—';
    final driverPhone = (t['driver_phone'] as String?) ?? '';
    final clientRate = _parseAmount(t['client_rate']);
    final contractorRate = _parseAmount(t['contractor_rate']);
    final margin = _parseAmount(t['margin']);
    final marginPct = (t['margin_pct'] is num)
        ? (t['margin_pct'] as num).toDouble()
        : double.tryParse(t['margin_pct']?.toString() ?? '') ?? 0.0;
    final vehicleType = (t['vehicle_type'] as String?) ?? '';
    final vehicleMake = (t['vehicle_make'] as String?) ?? '';
    final advance = _parseAmount(t['advance_amount']);
    final loading = _parseAmount(t['loading_charges']);
    final unloading = _parseAmount(t['unloading_charges']);

    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          // Header row
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.local_shipping_rounded, color: color, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                regNo,
                                style: KTTextStyles.label.copyWith(
                                  color: KTColors.textHeading,
                                  fontWeight: FontWeight.w700,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                label,
                                style: KTTextStyles.labelSmall.copyWith(
                                  color: color,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 10,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${vehicleMake.isNotEmpty ? vehicleMake : 'Unknown Make'} · $driverName',
                          style: KTTextStyles.bodySmall.copyWith(
                            color: KTColors.textMuted,
                            decoration: TextDecoration.none,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: KTColors.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          // Rate summary row (always visible)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Row(
              children: [
                _AmountBadge(
                    'Client Rate', _formatAmt(clientRate), KTColors.primary),
                const SizedBox(width: 8),
                _AmountBadge('Contractor', _formatAmt(contractorRate),
                    KTColors.warning),
                const SizedBox(width: 8),
                _AmountBadge(
                  'Margin',
                  '${_formatAmt(margin)} (${marginPct.toStringAsFixed(1)}%)',
                  margin >= 0 ? KTColors.success : KTColors.danger,
                ),
              ],
            ),
          ),
          // Expanded detail
          if (_expanded) ...[
            const Divider(height: 1, color: KTColors.borderColor),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DetailRow('Vehicle Type', vehicleType.isNotEmpty ? vehicleType : '—'),
                  _DetailRow('Driver Phone', driverPhone.isNotEmpty ? driverPhone : '—'),
                  _DetailRow('Advance', '₹${_formatAmt(advance)}'),
                  _DetailRow('Loading Charges', '₹${_formatAmt(loading)}'),
                  _DetailRow('Unloading Charges', '₹${_formatAmt(unloading)}'),
                  if (t['driver_license'] != null && t['driver_license'].toString().isNotEmpty)
                    _DetailRow('DL Number', t['driver_license'].toString()),
                  if (t['owner_name'] != null && t['owner_name'].toString().isNotEmpty)
                    _DetailRow('Owner', t['owner_name'].toString()),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static double _parseAmount(dynamic val) {
    if (val == null) return 0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0;
  }

  static String _formatAmt(double amt) {
    if (amt >= 100000) return '₹${(amt / 100000).toStringAsFixed(1)}L';
    if (amt >= 1000) return '₹${(amt / 1000).toStringAsFixed(1)}k';
    return '₹${amt.toStringAsFixed(0)}';
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: KTTextStyles.label.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: KTTextStyles.labelSmall.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountBadge extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _AmountBadge(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.none,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: KTTextStyles.bodySmall.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: KTTextStyles.bodySmall.copyWith(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
