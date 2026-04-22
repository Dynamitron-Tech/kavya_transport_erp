import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';

// ─── Shared color constants ───────────────────────────────────────────────────
const _amber = Color(0xFFEA580C);
const _green = Color(0xFF10B981);
const _textPrimary = Color(0xFF0D1B2A);
const _textSecondary = Color(0xFF8494A4);
const _cardColor = Color(0xFFFFFFFF);

/// Pump Vehicles — Company fleet + Market/leased vehicles.
class PumpVehiclesScreen extends ConsumerStatefulWidget {
  const PumpVehiclesScreen({super.key});

  @override
  ConsumerState<PumpVehiclesScreen> createState() => _PumpVehiclesScreenState();
}

class _PumpVehiclesScreenState extends ConsumerState<PumpVehiclesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _search = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final companyAsync = ref.watch(pumpCompanyVehiclesProvider);
    final marketAsync = ref.watch(pumpMarketVehiclesProvider);

    return Column(
      children: [
        // ─── Search bar ───
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (v) => setState(() => _query = v.toLowerCase()),
            decoration: InputDecoration(
              hintText: 'Search vehicles...',
              hintStyle: const TextStyle(color: _textSecondary, fontSize: 14),
              prefixIcon: const Icon(Icons.search, color: _textSecondary, size: 20),
              filled: true,
              fillColor: _cardColor,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: _amber),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // ─── Tabs ───
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
          ),
          child: TabBar(
            controller: _tabCtrl,
            indicator: BoxDecoration(
              color: _amber,
              borderRadius: BorderRadius.circular(10),
            ),
            labelColor: Colors.white,
            unselectedLabelColor: _textSecondary,
            labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            tabs: [
              Tab(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.business, size: 16),
                    const SizedBox(width: 6),
                    const Text('Company'),
                    companyAsync.whenOrNull(
                          data: (v) => _badge(v.length),
                        ) ??
                        const SizedBox.shrink(),
                  ],
                ),
              ),
              Tab(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.handshake_outlined, size: 16),
                    const SizedBox(width: 6),
                    const Text('Market'),
                    marketAsync.whenOrNull(
                          data: (v) => _badge(v.length),
                        ) ??
                        const SizedBox.shrink(),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),

        // ─── Tab content ───
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: [
              _vehicleList(companyAsync),
              _vehicleList(marketAsync),
            ],
          ),
        ),
      ],
    );
  }

  Widget _badge(int count) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text('$count',
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }

  Widget _vehicleList(AsyncValue<List<Map<String, dynamic>>> asyncVehicles) {
    return asyncVehicles.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: _amber),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Failed to load vehicles\n$e',
              textAlign: TextAlign.center,
              style: const TextStyle(color: _textSecondary)),
        ),
      ),
      data: (vehicles) {
        var filtered = vehicles;
        if (_query.isNotEmpty) {
          filtered = vehicles.where((v) {
            final reg = (v['registration_number'] ?? '').toString().toLowerCase();
            final type = (v['vehicle_type'] ?? '').toString().toLowerCase();
            final owner = (v['owner_name'] ?? '').toString().toLowerCase();
            return reg.contains(_query) ||
                type.contains(_query) ||
                owner.contains(_query);
          }).toList();
        }

        if (filtered.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.local_shipping_outlined,
                    size: 48, color: _textSecondary.withValues(alpha: 0.4)),
                const SizedBox(height: 12),
                Text(
                  _query.isEmpty ? 'No vehicles found' : 'No vehicles match "$_query"',
                  style: const TextStyle(fontSize: 14, color: _textSecondary),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: _amber,
          onRefresh: () async {
            ref.invalidate(pumpCompanyVehiclesProvider);
            ref.invalidate(pumpMarketVehiclesProvider);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _vehicleCard(filtered[i]),
          ),
        );
      },
    );
  }

  Widget _vehicleCard(Map<String, dynamic> v) {
    final reg = v['registration_number'] ?? 'N/A';
    final type = (v['vehicle_type'] ?? '').toString();
    final owner = v['owner_name'] ?? '';
    final ownershipType = (v['ownership_type'] ?? '').toString().toUpperCase();

    // Determine owner label: MARKET → owner_name, else → Kavya Transports
    final ownerLabel = ownershipType == 'MARKET'
        ? (owner.toString().isNotEmpty ? owner.toString() : 'Unknown Owner')
        : 'Kavya Transports';

    return GestureDetector(
      onTap: () => _showFuelLogSheet(context, reg.toString(), ownerLabel, ownershipType == 'MARKET'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.local_shipping_rounded,
                  color: _amber, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(reg.toString(),
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: _textPrimary,
                          letterSpacing: 0.5)),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (type.isNotEmpty) ...[
                        Text(type.toUpperCase(),
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _textSecondary)),
                        const SizedBox(width: 8),
                      ],
                      if (owner.toString().isNotEmpty)
                        Flexible(
                          child: Text(owner.toString(),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: _textSecondary)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // ── History button ──
            GestureDetector(
              onTap: () => _showVehicleHistory(context, reg.toString()),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _amber.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _amber.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history_rounded, color: _amber, size: 14),
                    SizedBox(width: 4),
                    Text('History',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: _amber)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showVehicleHistory(BuildContext context, String vehicleReg) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _VehicleHistorySheet(vehicleReg: vehicleReg),
    );
  }

  void _showFuelLogSheet(BuildContext context, String vehicleReg, String ownerLabel, bool isMarket) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _VehicleFuelLogSheet(
        vehicleReg: vehicleReg,
        ownerLabel: ownerLabel,
        isMarket: isMarket,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle Fuel History Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _VehicleHistorySheet extends ConsumerWidget {
  final String vehicleReg;
  const _VehicleHistorySheet({required this.vehicleReg});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(vehicleFuelHistoryProvider(vehicleReg));

    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.80),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // ── Handle ─────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // ── Header ─────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
              children: [
                const Icon(Icons.history_rounded, color: _amber, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    vehicleReg,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: _textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, color: _textSecondary),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // ── List ────────────────────────────────────────────────────────────
          Expanded(
            child: historyAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Error: $e',
                    style: const TextStyle(color: _textSecondary)),
              ),
              data: (issues) {
                if (issues.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.local_gas_station_outlined,
                            size: 48, color: _textSecondary),
                        SizedBox(height: 12),
                        Text('No fuel records found',
                            style: TextStyle(
                                color: _textSecondary,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  itemCount: issues.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final issue = issues[i];
                    final dt = issue.issuedAt;
                    final dateStr = '${dt.day.toString().padLeft(2, '0')}/'
                            '${dt.month.toString().padLeft(2, '0')}/'
                            '${dt.year}';
                    final timeStr = '${dt.hour.toString().padLeft(2, '0')}:'
                            '${dt.minute.toString().padLeft(2, '0')}';
                    final fuelColor = issue.fuelType.toLowerCase() == 'petrol'
                        ? const Color(0xFF10B981)
                        : _amber;
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          // Fuel type indicator
                          Container(
                            width: 4,
                            height: 44,
                            decoration: BoxDecoration(
                              color: fuelColor,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Date/time + fuel type
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(dateStr,
                                        style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: _textPrimary)),
                                    const SizedBox(width: 6),
                                    Text(timeStr,
                                        style: const TextStyle(
                                            fontSize: 12,
                                            color: _textSecondary)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  issue.fuelType.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: fuelColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Litres + Amount
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${issue.quantityLitres.toStringAsFixed(1)} L',
                                style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: _textPrimary),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '₹${IndianFormat.number(issue.totalAmount.toInt())}',
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: _green),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle Fuel Log Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _VehicleFuelLogSheet extends ConsumerStatefulWidget {
  final String vehicleReg;
  final String ownerLabel;
  final bool isMarket;

  const _VehicleFuelLogSheet({
    required this.vehicleReg,
    required this.ownerLabel,
    required this.isMarket,
  });

  @override
  ConsumerState<_VehicleFuelLogSheet> createState() =>
      _VehicleFuelLogSheetState();
}

class _VehicleFuelLogSheetState extends ConsumerState<_VehicleFuelLogSheet> {
  static const _red = Color(0xFFEF4444);

  final _formKey = GlobalKey<FormState>();
  final _litresCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();

  bool _submitting = false;
  String _selectedFuelType = 'diesel';
  NozzleInfo? _selectedNozzle;

  double _effectiveRate() {
    return _selectedFuelType == 'petrol'
        ? ref.read(pumpPetrolRatePerLitreProvider)
        : ref.read(pumpRatePerLitreProvider);
  }

  @override
  void dispose() {
    _litresCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  void _onLitresChanged(String val) {
    final rate = _effectiveRate();
    final litres = double.tryParse(val);
    if (litres != null && litres > 0 && rate > 0) {
      _amountCtrl.text = (litres * rate).toStringAsFixed(2);
    } else if (val.isEmpty) {
      _amountCtrl.clear();
    }
    setState(() {});
  }

  void _onAmountChanged(String val) {
    final rate = _effectiveRate();
    final amt = double.tryParse(val);
    if (amt != null && amt > 0 && rate > 0) {
      _litresCtrl.text = (amt / rate).toStringAsFixed(2);
    } else if (val.isEmpty) {
      _litresCtrl.clear();
    }
    setState(() {});
  }

  Future<void> _submitEntry() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final ratePerLitre = _effectiveRate();
    final submittedTankId = _selectedNozzle?.tankId;
    final notifier = ref.read(fuelIssueNotifierProvider.notifier);

    final ok = await notifier.issueFuel(
      externalVehicleNumber: widget.vehicleReg.isNotEmpty ? widget.vehicleReg : null,
      quantityLitres: double.parse(_litresCtrl.text),
      ratePerLitre: ratePerLitre,
      fuelType: _selectedFuelType.toUpperCase(),
      tankId: submittedTankId,
    );
    setState(() => _submitting = false);

    if (!mounted) return;
    if (ok) {
      ref.invalidate(todayFuelIssuesProvider);
      ref.invalidate(pumpDashboardProvider);
      if (submittedTankId != null) ref.invalidate(tankIssuesProvider(submittedTankId));
      ref.invalidate(fuelTanksProvider);
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fuel entry logged'), backgroundColor: _green),
      );
    } else {
      final err = ref.read(fuelIssueNotifierProvider).error?.toString() ?? 'Failed to log entry';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err.replaceAll('Exception:', '').trim()), backgroundColor: _red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final dieselRate = ref.watch(pumpRatePerLitreProvider);
    final petrolRate = ref.watch(pumpPetrolRatePerLitreProvider);
    final ratePerLitre = _selectedFuelType == 'petrol' ? petrolRate : dieselRate;
    final nozzlesAsync = ref.watch(nozzlesForCurrentBranchProvider);

    // Tank empty check
    final dashAsync = ref.watch(pumpDashboardProvider);
    double? selectedTankStock;
    if (_selectedNozzle != null) {
      final tanks = dashAsync.valueOrNull?.tanks ?? [];
      final tank = tanks.where((t) => t.id == _selectedNozzle!.tankId).firstOrNull;
      selectedTankStock = tank?.currentStockLitres;
    }
    final isTankEmpty = selectedTankStock != null && selectedTankStock <= 0;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Drag handle ──
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header ──
                    Row(
                      children: [
                        const Icon(Icons.local_gas_station_rounded, color: _amber, size: 20),
                        const SizedBox(width: 8),
                        Text(
                            widget.isMarket ? 'Market Vehicle' : 'Company Vehicle',
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: _textPrimary)),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: (_selectedFuelType == 'petrol' ? _green : _amber)
                                .withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: (_selectedFuelType == 'petrol' ? _green : _amber)
                                    .withValues(alpha: 0.3)),
                          ),
                          child: Text(
                            '₹${ratePerLitre.toStringAsFixed(2)}/L',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: _selectedFuelType == 'petrol' ? _green : _amber),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Fuel type chips ──
                    Row(
                      children: [
                        _fuelTypeChip('diesel', 'Diesel', _amber),
                        const SizedBox(width: 10),
                        _fuelTypeChip('petrol', 'Petrol', _green),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Nozzle selector ──
                    nozzlesAsync.when(
                      data: (nozzles) => _nozzleSelectorField(nozzles),
                      loading: () => _shimmer(54),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                    if (nozzlesAsync.hasValue && (nozzlesAsync.value ?? []).isNotEmpty)
                      const SizedBox(height: 12),

                    // ── Pump + Tank auto-filled ──
                    if (_selectedNozzle != null) ...[
                      Row(
                        children: [
                          Expanded(
                            child: _autoFilledTile(
                              icon: Icons.local_gas_station_rounded,
                              label: 'Pump',
                              value: '${_selectedNozzle!.pumpName} · ${_selectedNozzle!.pumpNumber}',
                              color: _amber,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _autoFilledTile(
                              icon: Icons.water_drop_rounded,
                              label: 'Tank Used',
                              value: _selectedNozzle!.tankName,
                              color: _selectedNozzle!.fuelType.toUpperCase() == 'PETROL'
                                  ? _green
                                  : _amber,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // ── Tank Empty warning ──
                      if (isTankEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: _red.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: _red.withValues(alpha: 0.35)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.error_outline_rounded, color: _red, size: 18),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Tank Empty — No fuel available in this tank',
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: _red),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],

                    // ── Owner (auto-filled, read-only) ──
                    _autoFilledTile(
                      icon: Icons.business_rounded,
                      label: 'Owner',
                      value: widget.ownerLabel,
                      color: _textPrimary,
                    ),
                    const SizedBox(height: 12),

                    // ── Vehicle Number (pre-filled, read-only) ──
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F9FC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.directions_car_rounded,
                              color: _amber, size: 18),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('Vehicle Number',
                                  style: TextStyle(
                                      fontSize: 11, color: _textSecondary)),
                              const SizedBox(height: 2),
                              Text(
                                widget.vehicleReg,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: _textPrimary,
                                    letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // ── Litres + Amount ──
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _litresCtrl,
                            decoration: _inputDecor('Litres'),
                            keyboardType:
                                const TextInputType.numberWithOptions(decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))
                            ],
                            onChanged: _onLitresChanged,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              final n = double.tryParse(v);
                              if (n == null || n <= 0) return 'Invalid';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _amountCtrl,
                            decoration: _inputDecor('Amount (₹)'),
                            keyboardType:
                                const TextInputType.numberWithOptions(decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))
                            ],
                            onChanged: _onAmountChanged,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              final n = double.tryParse(v);
                              if (n == null || n <= 0) return 'Invalid';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),

                    // ── Summary row ──
                    Builder(builder: (_) {
                      final l = double.tryParse(_litresCtrl.text) ?? 0;
                      final a = double.tryParse(_amountCtrl.text) ?? 0;
                      if (l <= 0 || a <= 0) return const SizedBox(height: 16);
                      return Padding(
                        padding: const EdgeInsets.only(top: 10, bottom: 4),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: _amber.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: _amber.withValues(alpha: 0.2)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calculate_outlined,
                                  color: _amber, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                '${l.toStringAsFixed(2)} L  ×  ₹${ratePerLitre.toStringAsFixed(2)}/L',
                                style: const TextStyle(
                                    fontSize: 12, color: _textSecondary),
                              ),
                              const Spacer(),
                              Text(IndianFormat.currency(a),
                                  style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: _amber)),
                            ],
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 16),

                    // ── Submit ──
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _amber,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: (_submitting || isTankEmpty) ? null : _submitEntry,
                        icon: _submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.check_circle, size: 20),
                        label: Text(
                            _submitting ? 'Saving...' : 'Log Fuel Entry',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  Widget _fuelTypeChip(String type, String label, Color color) {
    final selected = _selectedFuelType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (_selectedFuelType == type) return;
          setState(() => _selectedFuelType = type);
          if (_litresCtrl.text.isNotEmpty) {
            _onLitresChanged(_litresCtrl.text);
          } else if (_amountCtrl.text.isNotEmpty) {
            _onAmountChanged(_amountCtrl.text);
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? color.withValues(alpha: 0.12)
                : const Color(0xFFF7F9FC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? color : const Color(0xFFE2E8F0),
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration:
                    BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? color : _textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _nozzleSelectorField(List<NozzleInfo> nozzles) {
    if (nozzles.isEmpty) return const SizedBox.shrink();
    final selected = _selectedNozzle;
    return GestureDetector(
      onTap: () => _showNozzlePicker(nozzles),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F9FC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected != null ? _amber : const Color(0xFFE2E8F0),
            width: selected != null ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(Icons.tune_rounded,
                color: selected != null ? _amber : _textSecondary, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: selected == null
                  ? const Text('Fuel Retrieved from — Select nozzle',
                      style: TextStyle(fontSize: 13, color: _textSecondary))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Fuel Retrieved from',
                            style:
                                TextStyle(fontSize: 11, color: _textSecondary)),
                        const SizedBox(height: 2),
                        Text(
                          '${selected.nozzleId} · Nozzle ${selected.nozzleNumber}  —  ${selected.pumpName}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _textPrimary),
                        ),
                      ],
                    ),
            ),
            const Icon(Icons.arrow_drop_down_rounded,
                color: _textSecondary, size: 22),
          ],
        ),
      ),
    );
  }

  void _showNozzlePicker(List<NozzleInfo> nozzles) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 4),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(Icons.tune_rounded, color: _amber, size: 18),
                SizedBox(width: 8),
                Text('Select Nozzle',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _textPrimary)),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.only(bottom: 16),
              itemCount: nozzles.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final n = nozzles[i];
                final isSelected = _selectedNozzle?.nozzleId == n.nozzleId;
                final color =
                    n.fuelType.toUpperCase() == 'PETROL' ? _green : _amber;
                return ListTile(
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedNozzle = n;
                      _selectedFuelType = n.fuelType.toLowerCase();
                    });
                    if (_litresCtrl.text.isNotEmpty) {
                      _onLitresChanged(_litresCtrl.text);
                    } else if (_amountCtrl.text.isNotEmpty) {
                      _onAmountChanged(_amountCtrl.text);
                    }
                  },
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(n.nozzleId,
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: color)),
                    ),
                  ),
                  title: Text(
                    '${n.pumpName} · ${n.isPrimary ? 'Primary' : 'Secondary'} Nozzle',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _textPrimary),
                  ),
                  subtitle: Text(
                    '${n.tankName}  ·  ${n.fuelType[0]}${n.fuelType.substring(1).toLowerCase()}',
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded,
                          color: _amber, size: 20)
                      : null,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _autoFilledTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color == _textPrimary
              ? const Color(0xFFF7F9FC)
              : color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: color == _textPrimary
                ? const Color(0xFFE2E8F0)
                : color.withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: color == _textPrimary ? _amber : color, size: 15),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 10, color: _textSecondary)),
                  const SizedBox(height: 1),
                  Text(value,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: color),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      );

  InputDecoration _inputDecor(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 13, color: _textSecondary),
        filled: true,
        fillColor: const Color(0xFFF7F9FC),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _amber),
        ),
      );

  Widget _shimmer(double h) => Container(
        height: h,
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(12),
        ),
      );
}
