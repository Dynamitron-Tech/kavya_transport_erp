import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ═══════════════════════════════════════════════════════════════
//  Driver Expense Entry Screen — per trip
//  Categories: Loading Charge, Unloading Charge, Tolls, Repairs, Fuel
// ═══════════════════════════════════════════════════════════════

class DriverExpenseListScreen extends ConsumerStatefulWidget {
  final int? tripId;
  final String? tripNumber;
  final String? origin;
  final String? destination;

  const DriverExpenseListScreen({
    super.key,
    this.tripId,
    this.tripNumber,
    this.origin,
    this.destination,
  });

  @override
  ConsumerState<DriverExpenseListScreen> createState() => _DriverExpenseListScreenState();
}

class _DriverExpenseListScreenState extends ConsumerState<DriverExpenseListScreen> {
  bool _isSubmitting = false;
  final _loadingCtrl = TextEditingController();
  final _unloadingCtrl = TextEditingController();
  final _fuelCtrl = TextEditingController();
  final _fuelLitresCtrl = TextEditingController();
  final List<_RepairEntry> _repairs = [_RepairEntry()];
  final List<_TollEntry> _tolls = [_TollEntry()];

  // Route-specific toll plaza names loaded from asset
  List<String> _routeTollNames = [];
  String? _routeLabel;

  @override
  void initState() {
    super.initState();
    _loadTollPlazas();
  }

  Future<void> _loadTollPlazas() async {
    try {
      final jsonStr = await rootBundle.loadString('assets/toll_plazas_app.json');
      final data = json.decode(jsonStr) as Map<String, dynamic>;
      final names = _lookupTollPlazaNames(data, widget.origin, widget.destination);
      if (mounted) {
        setState(() {
          _routeTollNames = names;
          if (widget.origin != null && widget.destination != null) {
            _routeLabel = '${widget.origin} → ${widget.destination}';
          }
        });
      }
    } catch (_) {}
  }

  /// Returns the ordered list of toll plaza names for the given route.
  /// New JSON structure: city_aliases{}, route_index{from}{to}→[route_id],
  /// routes[] array with route_id + toll_plaza_ids[], toll_plazas{}.
  List<String> _lookupTollPlazaNames(
    Map<String, dynamic> data,
    String? origin,
    String? destination,
  ) {
    if (origin == null || destination == null) return [];
    final aliases = data['city_aliases'] as Map<String, dynamic>;
    final normOrigin = _normCity(origin, aliases);
    final normDest = _normCity(destination, aliases);
    if (normOrigin == null || normDest == null) return [];
    // route_index[from][to] → list of route_ids
    final routeIndex = data['route_index'] as Map<String, dynamic>;
    final fromMap = routeIndex[normOrigin] as Map<String, dynamic>?;
    if (fromMap == null) return [];
    final routeIds = (fromMap[normDest] as List?)?.cast<String>();
    if (routeIds == null || routeIds.isEmpty) return [];
    final targetId = routeIds.first;
    // routes is an array — find by route_id
    final routesList = data['routes'] as List<dynamic>;
    final route = routesList
        .cast<Map<String, dynamic>>()
        .where((r) => r['route_id'] == targetId)
        .firstOrNull;
    if (route == null) return [];
    final plazaIds = (route['toll_plaza_ids'] as List).cast<String>();
    final plazas = data['toll_plazas'] as Map<String, dynamic>;
    return plazaIds
        .map((id) => (plazas[id] as Map<String, dynamic>?)?['name'] as String?)
        .whereType<String>()
        .toList();
  }

  /// Matches a raw city string (any capitalisation/alias) to the
  /// canonical city key used in city_aliases and route_index.
  /// city_aliases is a map of canonical_key → List<String> of aliases.
  String? _normCity(String raw, Map<String, dynamic> cityAliases) {
    final lower = raw.trim().toLowerCase();
    for (final entry in cityAliases.entries) {
      if (entry.key.toLowerCase() == lower) return entry.key;
      final aliasList = (entry.value as List).cast<String>();
      if (aliasList.any((a) => a.toLowerCase() == lower)) return entry.key;
    }
    return null;
  }

  double get _total {
    double sum = 0;
    sum += double.tryParse(_loadingCtrl.text) ?? 0;
    sum += double.tryParse(_unloadingCtrl.text) ?? 0;
    sum += double.tryParse(_fuelCtrl.text) ?? 0;
    for (final r in _repairs) {
      sum += double.tryParse(r.amountCtrl.text) ?? 0;
    }
    for (final t in _tolls) {
      sum += double.tryParse(t.amountCtrl.text) ?? 0;
    }
    return sum;
  }

  @override
  void dispose() {
    _loadingCtrl.dispose();
    _unloadingCtrl.dispose();
    _fuelCtrl.dispose();
    _fuelLitresCtrl.dispose();
    for (final r in _repairs) {
      r.dispose();
    }
    for (final t in _tolls) {
      t.dispose();
    }
    super.dispose();  }

  @override
  Widget build(BuildContext context) {
    final title = widget.tripNumber != null
        ? 'Expenses — ${widget.tripNumber}'
        : 'Expenses';

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        title: Text(title),
        actions: [
          AnimatedBuilder(
            animation: Listenable.merge([
              _loadingCtrl,
              _unloadingCtrl,
              _fuelCtrl,
              ..._repairs.map((r) => r.amountCtrl),
              ..._tolls.map((t) => t.amountCtrl),
            ]),
            builder: (_, __) => Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  '₹${_total.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Loading Charge ──────────────────────────────────
          _ExpenseCard(
            icon: Icons.upload_rounded,
            iconColor: KTColors.success,
            label: 'Loading Charge',
            child: _AmountField(
              controller: _loadingCtrl,
              hint: 'Enter amount',
              onChanged: () => setState(() {}),
            ),
          ),
          const SizedBox(height: 12),

          // ── Unloading Charge ────────────────────────────────
          _ExpenseCard(
            icon: Icons.download_rounded,
            iconColor: KTColors.info,
            label: 'Unloading Charge',
            child: _AmountField(
              controller: _unloadingCtrl,
              hint: 'Enter amount',
              onChanged: () => setState(() {}),
            ),
          ),
          const SizedBox(height: 12),

          // ── Tolls ────────────────────────────────────────────
          _ExpenseCard(
            icon: Icons.toll_rounded,
            iconColor: KTColors.danger,
            label: 'Tolls',
            subtitle: _routeLabel != null
                ? '$_routeLabel · ${_routeTollNames.length} plazas'
                : null,
            trailing: TextButton.icon(
              onPressed: () => setState(() => _tolls.add(_TollEntry())),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add'),
              style: TextButton.styleFrom(
                foregroundColor: KTColors.driverAccent,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            child: Column(
              children: List.generate(_tolls.length, (i) {
                final toll = _tolls[i];
                return Padding(
                  padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 5,
                        child: _TollLocationField(
                          toll: toll,
                          suggestions: _routeTollNames,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 4,
                        child: _AmountField(
                          controller: toll.amountCtrl,
                          hint: 'Amount',
                          onChanged: () => setState(() {}),
                        ),
                      ),
                      if (_tolls.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(left: 6, top: 14),
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _tolls[i].dispose();
                              _tolls.removeAt(i);
                            }),
                            child: const Icon(
                              Icons.remove_circle_outline,
                              color: KTColors.danger,
                              size: 20,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 12),

          // ── Repairs ─────────────────────────────────────────
          _ExpenseCard(
            icon: Icons.build_rounded,
            iconColor: KTColors.warning,
            label: 'Repairs',
            trailing: TextButton.icon(
              onPressed: () => setState(() => _repairs.add(_RepairEntry())),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add'),
              style: TextButton.styleFrom(
                foregroundColor: KTColors.driverAccent,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            child: Column(
              children: List.generate(_repairs.length, (i) {
                final repair = _repairs[i];
                return Padding(
                  padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: _PlainTextField(
                          controller: repair.typeCtrl,
                          hint: 'Type of repair',
                          textCapitalization: TextCapitalization.sentences,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 4,
                        child: _AmountField(
                          controller: repair.amountCtrl,
                          hint: 'Amount',
                          onChanged: () => setState(() {}),
                        ),
                      ),
                      if (_repairs.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _repairs[i].dispose();
                              _repairs.removeAt(i);
                            }),
                            child: const Icon(
                              Icons.remove_circle_outline,
                              color: KTColors.danger,
                              size: 20,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 12),

          // ── Fuel ────────────────────────────────────────────
          _ExpenseCard(
            icon: Icons.local_gas_station_rounded,
            iconColor: KTColors.driverAccent,
            label: 'Fuel',
            child: Column(
              children: [
                _AmountField(
                  controller: _fuelCtrl,
                  hint: 'Enter amount',
                  onChanged: () => setState(() {}),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _fuelLitresCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  decoration: InputDecoration(
                    hintText: 'Enter litres',
                    hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 14),
                    suffixText: 'L',
                    suffixStyle: const TextStyle(color: KTColors.textSecondary, fontSize: 14),
                    filled: true,
                    fillColor: KTColors.lightBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // ── Total row ────────────────────────────────────────
          AnimatedBuilder(
            animation: Listenable.merge([
              _loadingCtrl,
              _unloadingCtrl,
              _fuelCtrl,
              ..._repairs.map((r) => r.amountCtrl),
              ..._tolls.map((t) => t.amountCtrl),
            ]),
            builder: (_, __) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: KTColors.driverAccentBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: KTColors.driverAccent.withValues(alpha: 0.25),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total Expenses',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: KTColors.textHeading,
                    ),
                  ),
                  Text(
                    '₹${_total.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: KTColors.driverAccent,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Submit Button ────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submitExpenses,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.upload_rounded),
              label: Text(_isSubmitting ? 'Submitting…' : 'Submit Expenses'),
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.driverAccent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Future<void> _submitExpenses() async {
    final tripId = widget.tripId;
    if (tripId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No trip selected'), backgroundColor: Colors.orange),
      );
      return;
    }

    final loading = double.tryParse(_loadingCtrl.text.trim());
    final unloading = double.tryParse(_unloadingCtrl.text.trim());
    final fuelAmount = double.tryParse(_fuelCtrl.text.trim());
    final fuelLitres = double.tryParse(_fuelLitresCtrl.text.trim());

    final bool hasAny = (loading != null && loading > 0) ||
        (unloading != null && unloading > 0) ||
        _repairs.any((r) => double.tryParse(r.amountCtrl.text.trim()) != null) ||
        (fuelAmount != null && fuelAmount > 0);

    if (!hasAny) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No expenses entered'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final api = ref.read(apiServiceProvider);

      if (loading != null && loading > 0) {
        await api.addTripExpense(tripId, category: 'LOADING', amount: loading);
      }
      if (unloading != null && unloading > 0) {
        await api.addTripExpense(tripId, category: 'UNLOADING', amount: unloading);
      }
      for (final t in _tolls) {
        final amt = double.tryParse(t.amountCtrl.text.trim());
        if (amt != null && amt > 0) {
          await api.addTripExpense(
            tripId,
            category: 'TOLL',
            amount: amt,
            subCategory: t.locationText.isNotEmpty ? t.locationText : null,
          );
        }
      }
      for (final r in _repairs) {
        final amt = double.tryParse(r.amountCtrl.text.trim());
        if (amt != null && amt > 0) {
          await api.addTripExpense(
            tripId,
            category: 'REPAIR',
            amount: amt,
            subCategory: r.typeCtrl.text.trim().isNotEmpty ? r.typeCtrl.text.trim() : null,
          );
        }
      }
      if (fuelAmount != null && fuelAmount > 0) {
        await api.addTripFuel(
          tripId,
          litres: fuelLitres ?? 0,
          totalAmount: fuelAmount,
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Expenses submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: $e'), backgroundColor: KTColors.danger),
        );
      }
    }
  }
}

// ── Data holder for a single repair entry ─────────────────────
class _RepairEntry {
  final typeCtrl = TextEditingController();
  final amountCtrl = TextEditingController();

  void dispose() {
    typeCtrl.dispose();
    amountCtrl.dispose();
  }
}

// ── Data holder for a single toll entry ───────────────────────
class _TollEntry {
  // locCtrl is assigned by _TollLocationField's fieldViewBuilder.
  // The Autocomplete widget owns and manages this controller's lifecycle.
  TextEditingController? locCtrl;
  final amountCtrl = TextEditingController();

  String get locationText => locCtrl?.text.trim() ?? '';

  void dispose() {
    amountCtrl.dispose();
    // Do NOT dispose locCtrl — it is owned by the Autocomplete widget.
  }
}

// ── Autocomplete location field for toll plazas ────────────────
class _TollLocationField extends StatelessWidget {
  final _TollEntry toll;
  final List<String> suggestions;

  const _TollLocationField({required this.toll, required this.suggestions});

  static InputDecoration _decoration(String hint, {bool showArrow = false}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 14),
        filled: true,
        fillColor: KTColors.lightBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        suffixIcon: showArrow
            ? const Icon(Icons.arrow_drop_down, color: KTColors.textMuted, size: 20)
            : null,
      );

  @override
  Widget build(BuildContext context) {
    return Autocomplete<String>(
      optionsBuilder: (TextEditingValue textEditingValue) {
        if (suggestions.isEmpty) return const Iterable<String>.empty();
        final q = textEditingValue.text.toLowerCase();
        if (q.isEmpty) return suggestions;
        return suggestions.where((s) => s.toLowerCase().contains(q));
      },
      fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) {
        toll.locCtrl = textController;
        return TextField(
          controller: textController,
          focusNode: focusNode,
          textCapitalization: TextCapitalization.sentences,
          decoration: _decoration('Toll location', showArrow: suggestions.isNotEmpty),
          style: const TextStyle(fontSize: 14, color: KTColors.textHeading),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(10),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 260, maxHeight: 200),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  return InkWell(
                    onTap: () => onSelected(option),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Text(
                        option,
                        style: const TextStyle(fontSize: 13, color: KTColors.textHeading),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── Card wrapper ──────────────────────────────────────────────
class _ExpenseCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;

  const _ExpenseCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.child,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
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
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: KTColors.textHeading,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 11,
                          color: KTColors.textMuted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

// ── Amount input ──────────────────────────────────────────────
class _AmountField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final VoidCallback? onChanged;

  const _AmountField({
    required this.controller,
    required this.hint,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
      ],
      onChanged: (_) => onChanged?.call(),
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: KTColors.textHeading,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
          color: KTColors.textMuted,
          fontWeight: FontWeight.w400,
        ),
        prefixText: '₹ ',
        prefixStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: KTColors.textMuted,
        ),
        filled: true,
        fillColor: KTColors.lightBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.driverAccent, width: 1.5),
        ),
      ),
    );
  }
}

// ── Plain text field (repair type) ────────────────────────────
class _PlainTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final TextCapitalization textCapitalization;

  const _PlainTextField({
    required this.controller,
    required this.hint,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      textCapitalization: textCapitalization,
      style: const TextStyle(fontSize: 14, color: KTColors.textHeading),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 13),
        filled: true,
        fillColor: KTColors.lightBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.driverAccent, width: 1.5),
        ),
      ),
    );
  }
}

