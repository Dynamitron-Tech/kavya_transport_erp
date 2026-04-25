import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';

class FleetTankDetailScreen extends ConsumerStatefulWidget {
  final FuelTank tank;
  const FleetTankDetailScreen({super.key, required this.tank});

  @override
  ConsumerState<FleetTankDetailScreen> createState() =>
      _FleetTankDetailScreenState();
}

class _FleetTankDetailScreenState
    extends ConsumerState<FleetTankDetailScreen>
    with SingleTickerProviderStateMixin {
  late FuelTank _tank;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tank = widget.tank;
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      floatingActionButton: ListenableBuilder(
        listenable: _tabController,
        builder: (_, __) {
          if (_tabController.index != 0) return const SizedBox.shrink();
          return SizedBox(
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ElevatedButton.icon(
                onPressed: () => _showTopUpSheet(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0288D1),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                icon: const Icon(Icons.local_gas_station_rounded,
                    color: Colors.white),
                label: const Text('Top Up Tank',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
              ),
            ),
          );
        },
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_tank.name,
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none)),
            Text('Fuel Tank',
                style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none)),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF0288D1).withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_tank.fuelType.toUpperCase(),
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0288D1))),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF0288D1),
          labelColor: const Color(0xFF0288D1),
          unselectedLabelColor: KTColors.textMuted,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Pumps'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OverviewTab(tank: _tank),
          _PumpsTab(tank: _tank),
          _HistoryTab(tankId: _tank.id),
        ],
      ),
    );
  }

  void _showTopUpSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TopUpSheet(
        tank: _tank,
        onDone: () => ref.invalidate(fuelTanksProvider),
      ),
    );
  }
}

// ─── Overview tab ──────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final FuelTank tank;
  const _OverviewTab({required this.tank});

  Color get _barColor {
    final pct = tank.stockPercent.clamp(0.0, 100.0);
    if (tank.isLowStock) return Colors.red;
    if (pct < 40) return Colors.orange;
    return const Color(0xFF0288D1);
  }

  @override
  Widget build(BuildContext context) {
    final pct = tank.stockPercent.clamp(0.0, 100.0);
    final barColor = _barColor;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: tank.isLowStock
                    ? Colors.red.withOpacity(0.4)
                    : KTColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Stock Level',
                      style: KTTextStyles.label
                          .copyWith(color: KTColors.textMuted)),
                  const Spacer(),
                  if (tank.isLowStock)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('LOW STOCK',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.red)),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(tank.currentStockLitres.toStringAsFixed(0),
                      style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          color: barColor,
                          height: 1)),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3, left: 3),
                    child: Text('L',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: barColor)),
                  ),
                  const Spacer(),
                  Text('/ ${tank.capacityLitres.toStringAsFixed(0)} L',
                      style: const TextStyle(
                          fontSize: 14, color: KTColors.textMuted)),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: LinearProgressIndicator(
                  value: pct / 100,
                  backgroundColor: KTColors.borderColor,
                  color: barColor,
                  minHeight: 8,
                ),
              ),
              const SizedBox(height: 6),
              Text('${pct.toStringAsFixed(1)}% filled',
                  style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted)),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Pumps tab ─────────────────────────────────────────────────────────────

class _PumpsTab extends ConsumerWidget {
  final FuelTank tank;
  const _PumpsTab({required this.tank});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pumpsAsync = ref.watch(pumpsForTankProvider(tank.id));
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(pumpsForTankProvider(tank.id)),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        children: [
          pumpsAsync.when(
            loading: () => const _PumpsSkeleton(),
            error: (e, _) => _ErrorRow(
              message: 'Could not load pumps',
              onRetry: () => ref.invalidate(pumpsForTankProvider(tank.id)),
            ),
            data: (pumps) {
              if (pumps.isEmpty) return const _EmptyPumps();
              return Column(
                  children: pumps.map((p) => _PumpCard(pump: p)).toList());
            },
          ),
        ],
      ),
    );
  }
}

// ─── History tab ───────────────────────────────────────────────────────────

class _HistoryTab extends ConsumerWidget {
  final int tankId;
  const _HistoryTab({required this.tankId});

  static const _amber = Color(0xFFEA580C);
  static const _green = Color(0xFF10B981);
  static const _blue = Color(0xFF3B82F6);
  static const _textSecondary = Color(0xFF8494A4);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final issuesAsync = ref.watch(tankIssuesProvider(tankId));
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(tankIssuesProvider(tankId)),
      child: issuesAsync.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(
            5,
            (_) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              height: 72,
              decoration: BoxDecoration(
                  color: KTColors.borderColor,
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 40),
                const SizedBox(height: 12),
                const Text('Failed to load history',
                    style: TextStyle(color: Colors.red)),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => ref.invalidate(tankIssuesProvider(tankId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (issues) {
          if (issues.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history_rounded,
                        size: 48, color: KTColors.borderColor),
                    const SizedBox(height: 12),
                    Text('No fuel logs for this tank',
                        style: KTTextStyles.label
                            .copyWith(color: KTColors.textMuted)),
                  ],
                ),
              ),
            );
          }

          // Summary stats
          final totalL =
              issues.fold<double>(0, (s, i) => s + i.quantityLitres);
          final totalAmt =
              issues.fold<double>(0, (s, i) => s + i.totalAmount);
          final uniqueVehicles = issues
              .map((i) => i.vehicleRegistration ?? i.vehicleId?.toString())
              .whereType<String>()
              .toSet()
              .length;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              // ── Summary bar ────────────────────────────────
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _stat('${issues.length}', 'Entries', _green),
                    _divider(),
                    _stat(
                        '${totalL.toStringAsFixed(0)} L', 'Dispensed', _amber),
                    _divider(),
                    _stat('₹${_compact(totalAmt)}', 'Total Cost', _blue),
                    _divider(),
                    _stat('$uniqueVehicles', 'Vehicles', _textSecondary),
                  ],
                ),
              ),
              // ── Entries list ────────────────────────────────
              ...issues.map((issue) => _IssueCard(issue: issue)),
            ],
          );
        },
      ),
    );
  }

  Widget _divider() => Container(
        width: 1, height: 28, color: KTColors.borderColor);

  Widget _stat(String value, String label, Color color) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                  fontSize: 10, color: _textSecondary)),
        ],
      );

  String _compact(double v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}

// ─── History issue card ─────────────────────────────────────────────────────

class _IssueCard extends StatelessWidget {
  final FuelIssue issue;
  const _IssueCard({required this.issue});

  static const _amber = Color(0xFFEA580C);
  static const _green = Color(0xFF10B981);
  static const _red = Color(0xFFEF4444);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  @override
  Widget build(BuildContext context) {
    final t = issue.issuedAt.toLocal();
    final date =
        '${t.day.toString().padLeft(2, '0')} ${_month(t.month)} ${t.year}';
    final time =
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    final vehicleLabel = issue.vehicleRegistration ??
        (issue.vehicleId != null ? 'Vehicle #${issue.vehicleId}' : 'Manual Entry');
    final fuelColor = issue.fuelType.toUpperCase() == 'PETROL' ? _green : _amber;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: issue.isFlagged
              ? _red.withOpacity(0.3)
              : KTColors.borderColor,
        ),
      ),
      child: Row(
        children: [
          // Fuel type dot
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: fuelColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.local_gas_station_rounded,
                color: fuelColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vehicleLabel,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _textPrimary)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      '${issue.quantityLitres.toStringAsFixed(1)} L',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: fuelColor),
                    ),
                    const Text('  ·  ',
                        style: TextStyle(
                            fontSize: 12, color: _textSecondary)),
                    Text(
                      '₹${issue.totalAmount.toStringAsFixed(0)}',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _textPrimary),
                    ),
                    if (issue.driverName != null) ...[
                      const Text('  ·  ',
                          style: TextStyle(
                              fontSize: 12, color: _textSecondary)),
                      Flexible(
                        child: Text(
                          issue.driverName!,
                          style: const TextStyle(
                              fontSize: 12, color: _textSecondary),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(time,
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _textSecondary)),
              const SizedBox(height: 2),
              Text(date,
                  style: const TextStyle(
                      fontSize: 10, color: _textSecondary)),
            ],
          ),
        ],
      ),
    );
  }

  String _month(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];
}

// ─── Pump card ─────────────────────────────────────────────────────────────

class _PumpCard extends StatelessWidget {
  final DepotPump pump;
  const _PumpCard({required this.pump});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(
            color: pump.isActive
                ? KTColors.borderColor
                : Colors.grey.withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 6,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: pump.isActive
                  ? const Color(0xFF0288D1).withOpacity(0.1)
                  : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.ev_station_rounded,
                size: 20,
                color: pump.isActive
                    ? const Color(0xFF0288D1)
                    : Colors.grey),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(pump.name,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: KTColors.textHeading)),
                if (pump.pumpNumber != null && pump.pumpNumber!.isNotEmpty)
                  Text('No. ${pump.pumpNumber}',
                      style: const TextStyle(
                          fontSize: 12, color: KTColors.textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: pump.isActive
                  ? Colors.green.withOpacity(0.1)
                  : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              pump.isActive ? 'Active' : 'Inactive',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: pump.isActive ? Colors.green : Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Pumps skeleton ────────────────────────────────────────────────────────

class _PumpsSkeleton extends StatelessWidget {
  const _PumpsSkeleton();
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 60,
          decoration: BoxDecoration(
              color: KTColors.borderColor,
              borderRadius: BorderRadius.circular(13)),
        ),
      ),
    );
  }
}

// ─── Empty pumps ───────────────────────────────────────────────────────────

class _EmptyPumps extends StatelessWidget {
  const _EmptyPumps();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 30),
        child: Column(
          children: [
            const Icon(Icons.ev_station_outlined,
                size: 44, color: KTColors.borderColor),
            const SizedBox(height: 10),
            Text('No pumps connected',
                style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 4),
            Text('Add a pump dispensing from this tank',
                style: KTTextStyles.labelSmall.copyWith(color: KTColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

// ─── Error row ─────────────────────────────────────────────────────────────

class _ErrorRow extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorRow({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.error_outline, color: Colors.red, size: 16),
        const SizedBox(width: 6),
        Expanded(
            child: Text(message,
                style: const TextStyle(color: Colors.red, fontSize: 13))),
        TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}

// ─── Add Pump sheet ────────────────────────────────────────────────────────

class _AddPumpSheet extends ConsumerStatefulWidget {
  final FuelTank tank;
  final VoidCallback onCreated;
  const _AddPumpSheet({required this.tank, required this.onCreated});

  @override
  ConsumerState<_AddPumpSheet> createState() => _AddPumpSheetState();
}

class _AddPumpSheetState extends ConsumerState<_AddPumpSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _numberCtrl = TextEditingController();
  int? _secondaryTankId;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _numberCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(createPumpProvider.notifier).create(
          name: _nameCtrl.text.trim(),
          pumpNumber: _numberCtrl.text.trim(),
          boothNumber: '',
          fuelType: widget.tank.fuelType,
          tankId: widget.tank.id,
          secondaryTankId: _secondaryTankId,
          branchId: widget.tank.branchId,
        );
    if (!mounted) return;
    if (ok) {
      widget.onCreated();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pump added'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to add pump'), backgroundColor: Colors.red),
      );
    }
  }

  Color _fuelColor(String ft) {
    switch (ft.toUpperCase()) {
      case 'DIESEL': return const Color(0xFFF59E0B);
      case 'PETROL': return const Color(0xFF10B981);
      case 'CNG':    return const Color(0xFF0288D1);
      default:       return Colors.grey;
    }
  }

  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      text,
      style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: KTColors.textMuted,
          letterSpacing: 0.6),
    ),
  );

  Widget _nozzleLockedCard() {
    final ft = widget.tank.fuelType;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        border: Border.all(color: KTColors.borderColor),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Nozzle 1 — Primary',
                    style: TextStyle(fontSize: 11, color: KTColors.textMuted)),
                const SizedBox(height: 2),
                Text(widget.tank.name,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: KTColors.textHeading)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: _fuelColor(ft).withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(ft,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _fuelColor(ft))),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.lock_outline, size: 14, color: Colors.grey),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final saving = ref.watch(createPumpProvider).isLoading;
    final allTanks = ref.watch(fuelTanksProvider).valueOrNull ?? [];
    final otherTanks = allTanks.where((t) => t.id != widget.tank.id).toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // drag handle
                Center(
                  child: Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                        color: KTColors.borderColor,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0288D1).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.ev_station_rounded,
                        size: 18, color: Color(0xFF0288D1)),
                  ),
                  const SizedBox(width: 10),
                  const Text('Add Pump',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: KTColors.textHeading)),
                ]),
                const SizedBox(height: 20),

                // ── Pump Details ─────────────────────────────────
                _sectionLabel('PUMP DETAILS'),
                TextFormField(
                  controller: _nameCtrl,
                  decoration: InputDecoration(
                    labelText: 'Pump Name *',
                    hintText: 'e.g. Pump 1',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _numberCtrl,
                  decoration: InputDecoration(
                    labelText: 'Pump Number (optional)',
                    hintText: 'e.g. P001',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                // ── Nozzles ──────────────────────────────────────
                _sectionLabel('NOZZLES'),
                _nozzleLockedCard(),
                const SizedBox(height: 10),
                Text('Nozzle 2 (optional)',
                    style: const TextStyle(fontSize: 12, color: KTColors.textMuted)),
                const SizedBox(height: 6),
                DropdownButtonFormField<int?>(
                  initialValue: _secondaryTankId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  selectedItemBuilder: (_) => [
                    const Text('None — single-nozzle pump',
                        overflow: TextOverflow.ellipsis),
                    ...otherTanks.map((t) => Text(
                        '${t.name}  •  ${t.fuelType}',
                        overflow: TextOverflow.ellipsis)),
                  ],
                  items: [
                    const DropdownMenuItem<int?>(
                      value: null,
                      child: Text('None — single-nozzle pump'),
                    ),
                    ...otherTanks.map((t) => DropdownMenuItem<int?>(
                          value: t.id,
                          child: Row(
                            children: [
                              Expanded(
                                  child: Text(t.name,
                                      overflow: TextOverflow.ellipsis)),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _fuelColor(t.fuelType).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(t.fuelType,
                                    style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: _fuelColor(t.fuelType))),
                              ),
                            ],
                          ),
                        )),
                  ],
                  onChanged: (v) => setState(() => _secondaryTankId = v),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: saving ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0288D1),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Add Pump',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Top-up sheet ──────────────────────────────────────────────────────────

class _TopUpSheet extends ConsumerStatefulWidget {
  final FuelTank tank;
  final VoidCallback onDone;
  const _TopUpSheet({required this.tank, required this.onDone});

  @override
  ConsumerState<_TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends ConsumerState<_TopUpSheet> {
  final _formKey = GlobalKey<FormState>();
  final _qtyCtrl = TextEditingController();
  final _rateCtrl = TextEditingController();
  final _totalAmountCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Pre-fill rate from pump operator's "rate of the day" — pick petrol or diesel
    final isPetrol = widget.tank.fuelType.toUpperCase() == 'PETROL';
    final todayRate = isPetrol
        ? ref.read(pumpPetrolRatePerLitreProvider)
        : ref.read(pumpRatePerLitreProvider);
    _rateCtrl.text = todayRate.toStringAsFixed(2);
    _qtyCtrl.addListener(_recalcTotal);
    _rateCtrl.addListener(_recalcTotal);
  }

  void _recalcTotal() {
    final qty = double.tryParse(_qtyCtrl.text.trim());
    final rate = double.tryParse(_rateCtrl.text.trim());
    if (qty != null && rate != null) {
      _totalAmountCtrl.text = (qty * rate).toStringAsFixed(2);
    } else {
      _totalAmountCtrl.clear();
    }
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _rateCtrl.dispose();
    _totalAmountCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(topUpTankProvider.notifier).topUp(
          tankId: widget.tank.id,
          quantityLitres: double.parse(_qtyCtrl.text.trim()),
          totalAmount: _totalAmountCtrl.text.trim().isEmpty
              ? null
              : double.tryParse(_totalAmountCtrl.text.trim()),
          remarks: _remarksCtrl.text.trim(),
        );
    if (!mounted) return;
    if (!mounted) return;
    // Capture messenger before pop to avoid using an inactive context
    final messenger = ScaffoldMessenger.of(context);
    if (ok) {
      widget.onDone();
      Navigator.pop(context);
      messenger.showSnackBar(
        const SnackBar(
            content: Text('Top-up request sent to Finance Manager ✓'),
            backgroundColor: Colors.green),
      );
    } else {
      messenger.showSnackBar(
        const SnackBar(
            content: Text('Failed to send top-up request. Check your connection.'),
            backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(topUpTankProvider) is AsyncLoading;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40, height: 4,
                decoration: BoxDecoration(
                    color: KTColors.borderColor,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text('Top Up — ${widget.tank.name}',
                  style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
            ),
            const Divider(height: 1),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _qtyCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Quantity (Litres) *',
                          prefixIcon: Icon(Icons.water_drop_outlined, size: 18),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Required';
                          if (double.tryParse(v) == null) return 'Invalid number';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      Builder(builder: (context) {
                        final isPetrol = widget.tank.fuelType.toUpperCase() == 'PETROL';
                        final rateLabel = isPetrol ? 'Petrol rate' : 'Diesel rate';
                        final rateColor = isPetrol ? const Color(0xFF10B981) : const Color(0xFFEA580C);
                        return TextFormField(
                          controller: _rateCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                            labelText: 'Rate per Litre (₹)',
                            prefixIcon: const Icon(Icons.currency_rupee_rounded, size: 18),
                            border: const OutlineInputBorder(),
                            suffixIcon: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: rateColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                rateLabel,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: rateColor,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            helperText: 'Auto-filled from pump operator log',
                            helperStyle: const TextStyle(fontSize: 11),
                          ),
                        );
                      }),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _totalAmountCtrl,
                        readOnly: true,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Total Amount (₹)',
                          prefixIcon: Icon(Icons.receipt_outlined, size: 18),
                          border: OutlineInputBorder(),
                          helperText: 'Auto-calculated (Qty × Rate)',
                          helperStyle: TextStyle(fontSize: 11),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0288D1),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _remarksCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Remarks (optional)',
                          prefixIcon: Icon(Icons.notes_rounded, size: 18),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: isLoading ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0288D1),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          child: isLoading
                              ? const SizedBox(
                                  height: 18, width: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Text('Confirm Top Up',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
