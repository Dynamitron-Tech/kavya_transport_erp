import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import 'fleet_tank_detail_screen.dart';

class FleetBranchTanksScreen extends ConsumerStatefulWidget {
  final Branch branch;
  final List<FuelTank> tanks;

  const FleetBranchTanksScreen({
    super.key,
    required this.branch,
    required this.tanks,
  });

  @override
  ConsumerState<FleetBranchTanksScreen> createState() =>
      _FleetBranchTanksScreenState();
}

class _FleetBranchTanksScreenState
    extends ConsumerState<FleetBranchTanksScreen> {
  late List<FuelTank> _tanks;

  @override
  void initState() {
    super.initState();
    _tanks = widget.tanks;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded,
              color: KTColors.textHeading),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.branch.name,
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none)),
            Text(
              widget.branch.city != null
                  ? '${widget.branch.city} · ${_tanks.length} ${_tanks.length == 1 ? 'Tank' : 'Tanks'}'
                  : '${_tanks.length} ${_tanks.length == 1 ? 'Tank' : 'Tanks'}',
              style: KTTextStyles.labelSmall.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(fuelTanksProvider);
          final fresh = await ref.read(fuelTanksProvider.future);
          setState(() {
            _tanks =
                fresh.where((t) => t.branchId == widget.branch.id).toList();
          });
        },
        child: _tanks.isEmpty
            ? _EmptyTanks(onAdd: () => _showAddTankSheet(context))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: _tanks
                    .map((t) => _TankCard(
                          tank: t,
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    FleetTankDetailScreen(tank: t),
                              ),
                            );
                            // Refresh after returning in case stock changed
                            ref.invalidate(fuelTanksProvider);
                            final fresh = await ref
                                .read(fuelTanksProvider.future);
                            setState(() {
                              _tanks = fresh
                                  .where((x) =>
                                      x.branchId == widget.branch.id)
                                  .toList();
                            });
                          },
                        ))
                    .toList(),
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddTankSheet(context),
        backgroundColor: const Color(0xFF0288D1),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Add Tank',
            style:
                TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  void _showAddTankSheet(BuildContext context) {
    final branches = ref.read(branchesProvider).valueOrNull ?? [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddTankSheet(
        branches: branches,
        preselectedBranchId: widget.branch.id,
        onCreated: () async {
          ref.invalidate(fuelTanksProvider);
          final fresh = await ref.read(fuelTanksProvider.future);
          setState(() {
            _tanks =
                fresh.where((t) => t.branchId == widget.branch.id).toList();
          });
        },
      ),
    );
  }
}

// ─── Tank card ─────────────────────────────────────────────────────────────

class _TankCard extends StatelessWidget {
  final FuelTank tank;
  final VoidCallback? onTap;
  const _TankCard({required this.tank, this.onTap});

  @override
  Widget build(BuildContext context) {
    final pct = tank.stockPercent.clamp(0.0, 100.0);
    final isLow = tank.isLowStock;
    final barColor = isLow
        ? Colors.red
        : pct < 40
            ? Colors.orange
            : const Color(0xFF0288D1);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isLow
                  ? Colors.red.withOpacity(0.35)
                  : KTColors.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0288D1).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.water_drop_rounded,
                      size: 20, color: Color(0xFF0288D1)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tank.name,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: KTColors.textHeading)),
                      if (tank.location != null &&
                          tank.location!.isNotEmpty)
                        Text(tank.location!,
                            style: const TextStyle(
                                fontSize: 12, color: KTColors.textMuted)),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0288D1).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(tank.fuelType.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0288D1))),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded,
                    color: KTColors.textMuted),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${tank.currentStockLitres.toStringAsFixed(0)} L',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: barColor)),
                Text('/ ${tank.capacityLitres.toStringAsFixed(0)} L',
                    style: const TextStyle(
                        fontSize: 13, color: KTColors.textMuted)),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: pct / 100,
                backgroundColor: KTColors.borderColor,
                color: barColor,
                minHeight: 6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Empty tanks ───────────────────────────────────────────────────────────

class _EmptyTanks extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyTanks({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.water_drop_outlined,
                size: 52, color: KTColors.borderColor),
            const SizedBox(height: 14),
            const Text('No tanks yet',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading)),
            const SizedBox(height: 6),
            const Text('Add a tank to this bunk',
                style: TextStyle(fontSize: 13, color: KTColors.textMuted)),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: const Text('Add Tank',
                  style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0288D1)),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Add Tank sheet ────────────────────────────────────────────────────────

class _AddTankSheet extends ConsumerStatefulWidget {
  final List<Branch> branches;
  final int? preselectedBranchId;
  final VoidCallback onCreated;

  const _AddTankSheet({
    required this.branches,
    required this.onCreated,
    this.preselectedBranchId,
  });

  @override
  ConsumerState<_AddTankSheet> createState() => _AddTankSheetState();
}

class _AddTankSheetState extends ConsumerState<_AddTankSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  String _fuelType = 'DIESEL';
  int? _branchId;

  @override
  void initState() {
    super.initState();
    _branchId = widget.preselectedBranchId;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _capacityCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_branchId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select a branch')));
      return;
    }
    final ok = await ref.read(createTankProvider.notifier).createTank(
          name: _nameCtrl.text.trim(),
          branchId: _branchId!,
          capacityLitres: double.parse(_capacityCtrl.text.trim()),
          fuelType: _fuelType,
          location: '',
        );
    if (!mounted) return;
    if (ok) {
      widget.onCreated();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Tank created'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to create tank'),
            backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = ref.watch(createTankProvider).isLoading;
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Form(
          key: _formKey,
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
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0288D1).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.water_drop_rounded,
                        size: 18, color: Color(0xFF0288D1)),
                  ),
                  const SizedBox(width: 10),
                  const Text('Add New Tank',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: KTColors.textHeading)),
                ],
              ),
              const SizedBox(height: 20),
              if (widget.preselectedBranchId != null)
                TextFormField(
                  initialValue: widget.branches
                      .firstWhere((b) => b.id == widget.preselectedBranchId,
                          orElse: () => widget.branches.first)
                      .name,
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Branch',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                    filled: true,
                    fillColor: KTColors.lightBg,
                    suffixIcon: const Icon(Icons.lock_outline_rounded,
                        size: 16, color: KTColors.textMuted),
                  ),
                )
              else if (widget.branches.isNotEmpty)
                DropdownButtonFormField<int>(
                  initialValue: _branchId,
                  decoration: InputDecoration(
                    labelText: 'Branch *',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    isDense: true,
                  ),
                  isExpanded: true,
                  selectedItemBuilder: (context) => widget.branches
                      .map((b) => Text(
                            b.name,
                            overflow: TextOverflow.ellipsis,
                          ))
                      .toList(),
                  items: widget.branches
                      .map((b) => DropdownMenuItem(
                            value: b.id,
                            child: Text(
                              b.displayName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _branchId = v),
                  validator: (v) => v == null ? 'Select a branch' : null,
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Tank Name *',
                  hintText: 'e.g. Tank A',
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
                controller: _capacityCtrl,
                keyboardType: const TextInputType.numberWithOptions(
                    decimal: true),
                decoration: InputDecoration(
                  labelText: 'Capacity (Litres) *',
                  hintText: 'e.g. 5000',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  isDense: true,
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  if (double.tryParse(v) == null) return 'Invalid number';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _fuelType,
                decoration: InputDecoration(
                  labelText: 'Fuel Type',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  isDense: true,
                ),
                items: ['DIESEL', 'PETROL', 'CNG']
                    .map((f) =>
                        DropdownMenuItem(value: f, child: Text(f)))
                    .toList(),
                onChanged: (v) =>
                    setState(() => _fuelType = v ?? 'DIESEL'),
              ),
              const SizedBox(height: 20),
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
                      : const Text('Create Tank',
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
    );
  }
}
