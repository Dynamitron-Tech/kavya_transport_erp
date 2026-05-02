import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';

class FleetBranchPumpsScreen extends ConsumerWidget {
  final Branch branch;
  const FleetBranchPumpsScreen({super.key, required this.branch});

  void _showAddPumpSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddPumpFromBranchSheet(
        branch: branch,
        onCreated: () => ref.invalidate(pumpsForBranchProvider(branch.id)),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pumpsAsync = ref.watch(pumpsForBranchProvider(branch.id));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddPumpSheet(context, ref),
        backgroundColor: const Color(0xFF00897B),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Add Pump',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
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
            Text('Pumps',
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none)),
            Text(branch.name,
                style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none)),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(pumpsForBranchProvider(branch.id)),
        child: pumpsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 36),
                const SizedBox(height: 8),
                const Text('Could not load pumps',
                    style: TextStyle(color: Colors.red)),
                TextButton(
                  onPressed: () => ref.invalidate(pumpsForBranchProvider(branch.id)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (pumps) {
            if (pumps.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.ev_station_outlined,
                          size: 52, color: KTColors.borderColor),
                      const SizedBox(height: 14),
                      const Text('No pumps yet',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: KTColors.textHeading)),
                      const SizedBox(height: 6),
                      const Text('Pumps are added from inside each tank',
                          style: TextStyle(
                              fontSize: 13, color: KTColors.textMuted),
                          textAlign: TextAlign.center),
                    ],
                  ),
                ),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              itemCount: pumps.length,
              itemBuilder: (_, i) => _PumpCard(
                pump: pumps[i],
                branchId: branch.id,
                pumpIndex: i,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PumpCard extends StatelessWidget {
  final DepotPump pump;
  final int branchId;
  final int pumpIndex;
  const _PumpCard({required this.pump, required this.branchId, required this.pumpIndex});

  @override
  Widget build(BuildContext context) {
    final fuelType = pump.fuelType ?? '';
    final fuelColor = fuelType.toUpperCase() == 'PETROL'
        ? Colors.green
        : fuelType.toUpperCase() == 'CNG'
            ? Colors.blue
            : const Color(0xFFF59E0B); // amber for diesel

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _PumpDetailSheet(pump: pump, branchId: branchId, pumpIndex: pumpIndex),
      ),
      child: Container(
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
                color: pump.isActive ? const Color(0xFF0288D1) : Colors.grey),
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
          if (fuelType.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: fuelColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(fuelType.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: fuelColor)),
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
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded,
              size: 18, color: KTColors.textMuted),
        ],
      ),
    ),
    );
  }
}

// ─── Pump Detail Sheet ──────────────────────────────────────────────────────

class _PumpDetailSheet extends ConsumerWidget {
  final DepotPump pump;
  final int branchId;
  final int pumpIndex;
  const _PumpDetailSheet({required this.pump, required this.branchId, required this.pumpIndex});

  Color _fuelColor(String? ft) {
    switch ((ft ?? '').toUpperCase()) {
      case 'PETROL': return const Color(0xFF10B981);
      case 'CNG':    return const Color(0xFF0288D1);
      default:       return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tanksAsync = ref.watch(tanksForBranchProvider(branchId));
    final tanks = tanksAsync.valueOrNull ?? [];

    FuelTank? primaryTank;
    FuelTank? secondaryTank;
    if (tanks.isNotEmpty) {
      primaryTank = pump.tankId != null
          ? tanks.where((t) => t.id == pump.tankId).firstOrNull
          : null;
      secondaryTank = pump.secondaryTankId != null
          ? tanks.where((t) => t.id == pump.secondaryTankId).firstOrNull
          : null;
    }

    final fuelType = pump.fuelType ?? '';
    final fuelColor = _fuelColor(fuelType);

    final primaryNozzleNum = pumpIndex * 2 + 1;
    final secondaryNozzleNum = pumpIndex * 2 + 2;
    final primaryNozzleId = 'N${primaryNozzleNum.toString().padLeft(3, '0')}';
    final secondaryNozzleId = 'N${secondaryNozzleNum.toString().padLeft(3, '0')}';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36, height: 4,
              margin: const EdgeInsets.only(bottom: 18, top: 8),
              decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0288D1).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.ev_station_rounded,
                    size: 26, color: Color(0xFF0288D1)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pump.name,
                        style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: KTColors.textHeading)),
                    if (pump.pumpNumber != null && pump.pumpNumber!.isNotEmpty)
                      Text('No. ${pump.pumpNumber}',
                          style: const TextStyle(
                              fontSize: 12, color: KTColors.textMuted)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: pump.isActive
                      ? Colors.green.withOpacity(0.1)
                      : Colors.grey.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  pump.isActive ? 'Active' : 'Inactive',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: pump.isActive ? Colors.green : Colors.grey),
                ),
              ),
            ],
          ),

          const SizedBox(height: 22),

          // Quick info row
          Row(
            children: [
              if (fuelType.isNotEmpty)
                _InfoChip(
                  icon: Icons.local_gas_station_rounded,
                  label: fuelType.toUpperCase(),
                  color: fuelColor,
                ),
              if (pump.boothNumber != null && pump.boothNumber!.isNotEmpty) ...[
                const SizedBox(width: 8),
                _InfoChip(
                  icon: Icons.storefront_outlined,
                  label: 'Booth ${pump.boothNumber}',
                  color: Colors.purple,
                ),
              ],
            ],
          ),

          const SizedBox(height: 20),
          const Divider(height: 1),
          const SizedBox(height: 18),

          // Tank connections
          const Text('Tank Connections',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: KTColors.textMuted,
                  letterSpacing: 0.6)),
          const SizedBox(height: 10),

          if (pump.tankId == null && pump.secondaryTankId == null)
            const Text(
              'No tanks connected yet.',
              style: TextStyle(fontSize: 13, color: KTColors.textMuted),
            )
          else ...[
            if (pump.tankId != null)
              _TankConnectionTile(
                label: 'Primary Nozzle',
                nozzleId: primaryNozzleId,
                nozzleNumber: primaryNozzleNum,
                tank: primaryTank,
                tankId: pump.tankId!,
                isLoading: tanksAsync.isLoading,
              ),
            if (pump.secondaryTankId != null) ...[
              const SizedBox(height: 8),
              _TankConnectionTile(
                label: 'Secondary Nozzle',
                nozzleId: secondaryNozzleId,
                nozzleNumber: secondaryNozzleNum,
                tank: secondaryTank,
                tankId: pump.secondaryTankId!,
                isLoading: tanksAsync.isLoading,
              ),
            ],
          ],

          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _InfoChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}

class _TankConnectionTile extends StatelessWidget {
  final String label;
  final String nozzleId;
  final int nozzleNumber;
  final FuelTank? tank;
  final int tankId;
  final bool isLoading;
  const _TankConnectionTile({
    required this.label,
    required this.nozzleId,
    required this.nozzleNumber,
    required this.tank,
    required this.tankId,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    final fuelType = tank?.fuelType ?? '';
    Color fuelColor;
    switch (fuelType.toUpperCase()) {
      case 'PETROL': fuelColor = const Color(0xFF10B981); break;
      case 'CNG':    fuelColor = const Color(0xFF0288D1); break;
      default:       fuelColor = const Color(0xFFF59E0B);
    }

    return Container(
      padding: const EdgeInsets.all(14),
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
              color: fuelColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.water_drop_rounded, size: 16, color: fuelColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: isLoading
                ? const SizedBox(
                    height: 12,
                    width: 80,
                    child: LinearProgressIndicator())
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(label,
                              style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: KTColors.textMuted,
                                  letterSpacing: 0.4)),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0288D1).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Nozzle $nozzleNumber · $nozzleId',
                              style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0288D1)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tank?.name ?? 'Tank #$tankId',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: KTColors.textHeading),
                      ),
                      if (tank != null) ...[
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Text(
                              '${tank!.currentStockLitres.toStringAsFixed(0)} L / ${tank!.capacityLitres.toStringAsFixed(0)} L',
                              style: const TextStyle(
                                  fontSize: 11, color: KTColors.textMuted),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: fuelColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                fuelType.toUpperCase(),
                                style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: fuelColor),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: tank!.capacityLitres > 0
                                ? (tank!.currentStockLitres / tank!.capacityLitres)
                                    .clamp(0.0, 1.0)
                                : 0.0,
                            minHeight: 5,
                            backgroundColor: fuelColor.withOpacity(0.15),
                            valueColor:
                                AlwaysStoppedAnimation<Color>(fuelColor),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

// ─── Add Pump sheet (from branch context) ──────────────────────────────────

class _AddPumpFromBranchSheet extends ConsumerStatefulWidget {
  final Branch branch;
  final VoidCallback onCreated;
  const _AddPumpFromBranchSheet({required this.branch, required this.onCreated});

  @override
  ConsumerState<_AddPumpFromBranchSheet> createState() =>
      _AddPumpFromBranchSheetState();
}

class _AddPumpFromBranchSheetState
    extends ConsumerState<_AddPumpFromBranchSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _numberCtrl = TextEditingController();
  int? _primaryTankId;
  int? _secondaryTankId;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _numberCtrl.dispose();
    super.dispose();
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
    child: Text(text,
        style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: KTColors.textMuted,
            letterSpacing: 0.6)),
  );

  Future<void> _submit(List<FuelTank> branchTanks) async {
    if (!_formKey.currentState!.validate()) return;
    final primaryTank = branchTanks.firstWhere((t) => t.id == _primaryTankId);
    final ok = await ref.read(createPumpProvider.notifier).create(
          name: _nameCtrl.text.trim(),
          pumpNumber: _numberCtrl.text.trim(),
          boothNumber: '',
          fuelType: primaryTank.fuelType,
          tankId: _primaryTankId!,
          secondaryTankId: _secondaryTankId,
          branchId: widget.branch.id,
        );
    if (!mounted) return;
    if (ok) {
      widget.onCreated();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Pump added'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to add pump'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = ref.watch(createPumpProvider).isLoading;
    final branchTanksAsync = ref.watch(tanksForBranchProvider(widget.branch.id));
    final branchTanks = branchTanksAsync.valueOrNull ?? [];
    final secondaryTanks =
        branchTanks.where((t) => t.id != _primaryTankId).toList();

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
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
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
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
                      color: const Color(0xFF00897B).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.ev_station_rounded,
                        size: 18, color: Color(0xFF00897B)),
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
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _numberCtrl,
                  decoration: InputDecoration(
                    labelText: 'Pump Number (optional)',
                    hintText: 'e.g. P001',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                // ── Nozzles ──────────────────────────────────────
                _sectionLabel('NOZZLES'),
                Text('Nozzle 1 — Primary *',
                    style: const TextStyle(
                        fontSize: 12, color: KTColors.textMuted)),
                const SizedBox(height: 6),
                DropdownButtonFormField<int?>(
                  initialValue: _primaryTankId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  hint: const Text('Select primary tank'),
                  selectedItemBuilder: (_) => [
                    const Text('Select primary tank',
                        overflow: TextOverflow.ellipsis),
                    ...branchTanks.map((t) => Text(
                        '${t.name}  •  ${t.fuelType}',
                        overflow: TextOverflow.ellipsis)),
                  ],
                  items: [
                    const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('Select primary tank')),
                    ...branchTanks.map((t) => DropdownMenuItem<int?>(
                          value: t.id,
                          child: Row(children: [
                            Expanded(
                                child: Text(t.name,
                                    overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color:
                                    _fuelColor(t.fuelType).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(t.fuelType,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: _fuelColor(t.fuelType))),
                            ),
                          ]),
                        )),
                  ],
                  validator: (v) => v == null ? 'Select a primary tank' : null,
                  onChanged: (v) => setState(() {
                    _primaryTankId = v;
                    if (_secondaryTankId == v) _secondaryTankId = null;
                  }),
                ),
                const SizedBox(height: 10),
                Text('Nozzle 2 (optional)',
                    style: const TextStyle(
                        fontSize: 12, color: KTColors.textMuted)),
                const SizedBox(height: 6),
                DropdownButtonFormField<int?>(
                  initialValue: _secondaryTankId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  selectedItemBuilder: (_) => [
                    const Text('None — single-nozzle pump',
                        overflow: TextOverflow.ellipsis),
                    ...secondaryTanks.map((t) => Text(
                        '${t.name}  •  ${t.fuelType}',
                        overflow: TextOverflow.ellipsis)),
                  ],
                  items: [
                    const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('None — single-nozzle pump')),
                    ...secondaryTanks.map((t) => DropdownMenuItem<int?>(
                          value: t.id,
                          child: Row(children: [
                            Expanded(
                                child: Text(t.name,
                                    overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color:
                                    _fuelColor(t.fuelType).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(t.fuelType,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: _fuelColor(t.fuelType))),
                            ),
                          ]),
                        )),
                  ],
                  onChanged: (v) => setState(() => _secondaryTankId = v),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: saving ? null : () => _submit(branchTanks),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00897B),
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
