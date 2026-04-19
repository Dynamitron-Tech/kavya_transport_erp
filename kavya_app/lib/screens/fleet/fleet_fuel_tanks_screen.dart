import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/pump_dashboard_provider.dart';
import 'fleet_branch_hub_screen.dart';

class FleetFuelTanksScreen extends ConsumerWidget {
  const FleetFuelTanksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchesAsync = ref.watch(branchesProvider);
    final tanksAsync = ref.watch(fuelTanksProvider);

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
            Text('Pump Management',
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none)),
            Text('Select a bunk to manage',
                style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none)),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(branchesProvider);
          ref.invalidate(fuelTanksProvider);
        },
        child: branchesAsync.when(
          loading: () => _BunksSkeleton(),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 36),
                const SizedBox(height: 8),
                const Text('Could not load branches',
                    style: TextStyle(color: Colors.red)),
                TextButton(
                  onPressed: () => ref.invalidate(branchesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (branches) {
            final tanks = tanksAsync.valueOrNull ?? [];
            if (branches.isEmpty) {
              return _EmptyBunks(
                onAdd: () => _showAddBranchSheet(context, ref),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: branches
                  .map((b) {
                    final branchTanks =
                        tanks.where((t) => t.branchId == b.id).toList();
                    final totalCap = branchTanks.fold<double>(
                        0, (s, t) => s + t.capacityLitres);
                    final totalStock = branchTanks.fold<double>(
                        0, (s, t) => s + t.currentStockLitres);
                    final pct = totalCap > 0
                        ? (totalStock / totalCap) * 100
                        : 0.0;
                    final hasLow =
                        branchTanks.any((t) => t.isLowStock);
                    return _BunkCard(
                      branch: b,
                      tankCount: branchTanks.length,
                      totalCapacity: totalCap,
                      totalStock: totalStock,
                      fillPercent: pct,
                      hasLowStock: hasLow,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => FleetBranchHubScreen(
                            branch: b,
                            tanks: branchTanks,
                          ),
                        ),
                      ).then((_) {
                        ref.invalidate(branchesProvider);
                        ref.invalidate(fuelTanksProvider);
                      }),
                    );
                  })
                  .toList(),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddBranchSheet(context, ref),
        backgroundColor: const Color(0xFF0288D1),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Add Bunk',
            style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  void _showAddBranchSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddBranchSheet(
        onCreated: () => ref.invalidate(branchesProvider),
      ),
    );
  }
}

// ─── Bunk card ─────────────────────────────────────────────────────────────

class _BunkCard extends StatelessWidget {
  final Branch branch;
  final int tankCount;
  final double totalCapacity;
  final double totalStock;
  final double fillPercent;
  final bool hasLowStock;
  final VoidCallback onTap;

  const _BunkCard({
    required this.branch,
    required this.tankCount,
    required this.totalCapacity,
    required this.totalStock,
    required this.fillPercent,
    required this.hasLowStock,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final pct = fillPercent.clamp(0.0, 100.0);
    final barColor = hasLowStock
        ? Colors.red
        : pct < 40
            ? Colors.orange
            : const Color(0xFF0288D1);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: hasLowStock
                  ? Colors.red.withOpacity(0.35)
                  : KTColors.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
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
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0288D1).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.local_gas_station_rounded,
                      size: 22, color: Color(0xFF0288D1)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(branch.name,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: KTColors.textHeading)),
                      if (branch.city != null)
                        Text(branch.city!,
                            style: const TextStyle(
                                fontSize: 12, color: KTColors.textMuted)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: KTColors.borderColor,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                          '$tankCount ${tankCount == 1 ? 'Tank' : 'Tanks'}',
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: KTColors.textMuted)),
                    ),
                    if (hasLowStock)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text('LOW STOCK',
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: Colors.red)),
                      ),
                  ],
                ),
                const SizedBox(width: 6),
                const Icon(Icons.chevron_right_rounded,
                    color: KTColors.textMuted),
              ],
            ),
            if (tankCount > 0) ...[
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${totalStock.toStringAsFixed(0)} L',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: barColor),
                  ),
                  Text('/ ${totalCapacity.toStringAsFixed(0)} L',
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
            ] else
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text('No tanks added yet',
                    style: KTTextStyles.labelSmall
                        .copyWith(color: KTColors.textMuted)),
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Bunk skeleton ─────────────────────────────────────────────────────────

class _BunksSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        3,
        (_) => Container(
          margin: const EdgeInsets.only(bottom: 14),
          height: 115,
          decoration: BoxDecoration(
            color: KTColors.borderColor,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}

// ─── Empty bunks ───────────────────────────────────────────────────────────

class _EmptyBunks extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyBunks({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.local_gas_station_outlined,
                size: 56, color: KTColors.borderColor),
            const SizedBox(height: 14),
            const Text('No bunks configured',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading)),
            const SizedBox(height: 6),
            const Text('Add a bunk to start managing fuel tanks',
                style: TextStyle(fontSize: 13, color: KTColors.textMuted),
                textAlign: TextAlign.center),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: const Text('Add Bunk',
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

// ─── Add Branch sheet ──────────────────────────────────────────────────────

class _AddBranchSheet extends ConsumerStatefulWidget {
  final VoidCallback onCreated;
  const _AddBranchSheet({required this.onCreated});

  @override
  ConsumerState<_AddBranchSheet> createState() => _AddBranchSheetState();
}

class _AddBranchSheetState extends ConsumerState<_AddBranchSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  String _autoCode(String name) =>
      name.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toUpperCase().padRight(3).substring(0, 3);

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(createBranchProvider.notifier).create(
          name: _nameCtrl.text.trim(),
          code: _codeCtrl.text.trim().toUpperCase(),
          city: _cityCtrl.text.trim(),
          stateProvince: _stateCtrl.text.trim(),
          pincode: _pincodeCtrl.text.trim(),
        );
    if (!mounted) return;
    if (ok) {
      widget.onCreated();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Branch created'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to create branch'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = ref.watch(createBranchProvider).isLoading;
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
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
                    child: const Icon(Icons.location_on_rounded,
                        size: 18, color: Color(0xFF0288D1)),
                  ),
                  const SizedBox(width: 10),
                  const Text('Add New Branch',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: KTColors.textHeading)),
                ],
              ),
              const SizedBox(height: 20),
              _field(
                controller: _nameCtrl,
                label: 'Branch Name *',
                hint: 'e.g. Tuticorin',
                onChanged: (v) {
                  if (_codeCtrl.text.isEmpty || _codeCtrl.text.length <= 3) {
                    _codeCtrl.text = _autoCode(v);
                  }
                },
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              _field(
                controller: _codeCtrl,
                label: 'Branch Code *',
                hint: 'e.g. TUT',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  if (v.trim().length < 2) return 'Min 2 chars';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _field(
                        controller: _cityCtrl,
                        label: 'City',
                        hint: 'e.g. Tuticorin')),
                const SizedBox(width: 10),
                Expanded(
                    child: _field(
                        controller: _stateCtrl,
                        label: 'State',
                        hint: 'e.g. Tamil Nadu')),
              ]),
              const SizedBox(height: 12),
              _field(
                controller: _pincodeCtrl,
                label: 'Pin Code',
                hint: 'e.g. 628001',
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v != null && v.trim().isNotEmpty && v.trim().length != 6) {
                    return 'Must be 6 digits';
                  }
                  return null;
                },
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
                      : const Text('Create Branch',
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

  Widget _field({
    required TextEditingController controller,
    required String label,
    String? hint,
    String? Function(String?)? validator,
    ValueChanged<String>? onChanged,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      validator: validator,
      onChanged: onChanged,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF0288D1), width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
    );
  }
}

// ─── Add Tank sheet ────────────────────────────────────────────────────────

class _AddTankSheet extends ConsumerStatefulWidget {
  final List<Branch> branches;
  final VoidCallback onCreated;

  const _AddTankSheet({
    required this.branches,
    required this.onCreated,
  });

  @override
  ConsumerState<_AddTankSheet> createState() => _AddTankSheetState();
}

class _AddTankSheetState extends ConsumerState<_AddTankSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  String _fuelType = 'DIESEL';
  int? _branchId;

  @override
  void initState() {
    super.initState();
    _branchId = null;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _capacityCtrl.dispose();
    _locationCtrl.dispose();
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
          location: _locationCtrl.text.trim(),
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
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
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

              // Branch selector
              DropdownButtonFormField<int>(
                initialValue: _branchId,
                decoration: InputDecoration(
                  labelText: 'Branch *',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color(0xFF0288D1), width: 1.5),
                  ),
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
                  hintText: 'e.g. Main Diesel Tank',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color(0xFF0288D1), width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  isDense: true,
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),

              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: _capacityCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Capacity (L) *',
                      hintText: 'e.g. 5000',
                      suffixText: 'L',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                            color: Color(0xFF0288D1), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      isDense: true,
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Required';
                      if (double.tryParse(v.trim()) == null) {
                        return 'Invalid number';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _fuelType,
                    decoration: InputDecoration(
                      labelText: 'Fuel Type',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                            color: Color(0xFF0288D1), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      isDense: true,
                    ),
                    items: const [
                      DropdownMenuItem(
                          value: 'DIESEL', child: Text('Diesel')),
                      DropdownMenuItem(
                          value: 'PETROL', child: Text('Petrol')),
                      DropdownMenuItem(value: 'CNG', child: Text('CNG')),
                    ],
                    onChanged: (v) => setState(() => _fuelType = v!),
                  ),
                ),
              ]),
              const SizedBox(height: 12),

              TextFormField(
                controller: _locationCtrl,
                decoration: InputDecoration(
                  labelText: 'Location (optional)',
                  hintText: 'e.g. Shed B',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color(0xFF0288D1), width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  isDense: true,
                ),
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


