import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';
// NozzleInfo is exported from pump_dashboard_provider

// ── Indian vehicle plate regex (e.g. TN23AB1234 or TN 23 AB 1234) ──────────
final _plateRegex = RegExp(
  r'[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4}',
  caseSensitive: false,
);

/// Fuel Log — redesigned for any vehicle (neutral pump).
class PumpFuelLogScreen extends ConsumerStatefulWidget {
  const PumpFuelLogScreen({super.key});

  @override
  ConsumerState<PumpFuelLogScreen> createState() => _PumpFuelLogScreenState();
}

class _PumpFuelLogScreenState extends ConsumerState<PumpFuelLogScreen> {
  static const _amber = Color(0xFFEA580C);
  static const _red = Color(0xFFEF4444);
  static const _green = Color(0xFF10B981);
  static const _blue = Color(0xFF3B82F6);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);
  static const _cardColor = Color(0xFFFFFFFF);

  final _formKey = GlobalKey<FormState>();
  final _vehicleCtrl = TextEditingController();
  final _litresCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();

  bool _submitting = false;
  bool _scanningPlate = false;
  String _selectedFuelType = 'diesel'; // 'diesel' or 'petrol'
  NozzleInfo? _selectedNozzle;

  double _effectiveRate() {
    return _selectedFuelType == 'petrol'
        ? ref.read(pumpPetrolRatePerLitreProvider)
        : ref.read(pumpRatePerLitreProvider);
  }

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _litresCtrl.dispose();
    _amountCtrl.dispose();
    _vehicleCtrl.dispose();
    super.dispose();
  }

  // ── Cross-calculation ──────────────────────────────────────────────────
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

  // ── OCR plate scan ─────────────────────────────────────────────────────
  Future<void> _scanPlate() async {
    setState(() => _scanningPlate = true);
    try {
      final picker = ImagePicker();
      final xfile = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
        maxWidth: 1920,
      );
      if (xfile == null || !mounted) return;

      final inputImage = InputImage.fromFilePath(xfile.path);
      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final result = await recognizer.processImage(inputImage);
      recognizer.close();

      try {
        File(xfile.path).deleteSync();
      } catch (_) {}

      String? plate;
      for (final block in result.blocks) {
        final raw =
            block.text.toUpperCase().replaceAll(' ', '').replaceAll('\n', '');
        final match = _plateRegex.firstMatch(raw);
        if (match != null) {
          plate = match.group(0)!.toUpperCase().replaceAll(' ', '');
          break;
        }
      }
      if (plate == null) {
        final allText = result.text.toUpperCase().replaceAll('\n', ' ');
        final match = _plateRegex.firstMatch(allText);
        if (match != null) {
          plate = match.group(0)!.toUpperCase().replaceAll(' ', '');
        }
      }

      if (mounted) {
        if (plate != null) {
          _vehicleCtrl.text = plate;
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not detect plate. Enter manually.'),
              backgroundColor: _amber,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Scan error: $e'), backgroundColor: _red),
        );
      }
    } finally {
      if (mounted) setState(() => _scanningPlate = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final logAsync = ref.watch(todayFuelIssuesProvider);
    final checklist = ref.watch(pumpChecklistProvider);
    final allChecked = checklist.length >= kPumpChecklistItems.length;
    final dieselRate = ref.watch(pumpRatePerLitreProvider);
    final petrolRate = ref.watch(pumpPetrolRatePerLitreProvider);
    final ratePerLitre = _selectedFuelType == 'petrol' ? petrolRate : dieselRate;
    final nozzlesAsync = ref.watch(nozzlesForCurrentBranchProvider);

    // Look up selected tank's current stock from dashboard
    final dashAsync = ref.watch(pumpDashboardProvider);
    double? selectedTankStock;
    if (_selectedNozzle != null) {
      final tanks = dashAsync.valueOrNull?.tanks ?? [];
      final tank = tanks.where((t) => t.id == _selectedNozzle!.tankId).firstOrNull;
      selectedTankStock = tank?.currentStockLitres;
    }
    final isTankEmpty = selectedTankStock != null && selectedTankStock <= 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        // ─── Checklist gate ───
        if (!allChecked) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _amber.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _amber.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_outline, color: _amber, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Checklist Incomplete',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _amber)),
                      const SizedBox(height: 2),
                      Text(
                        'Complete the shift checklist on Dashboard to unlock fuel entry (${checklist.length}/${kPumpChecklistItems.length})',
                        style: TextStyle(
                            fontSize: 12,
                            color: _amber.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ─── Entry Form ───
        AnimatedOpacity(
          opacity: allChecked ? 1.0 : 0.4,
          duration: const Duration(milliseconds: 300),
          child: IgnorePointer(
            ignoring: !allChecked,
            child: Form(
              key: _formKey,
              child: Container(
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
                        const Icon(Icons.local_gas_station_rounded,
                            color: _amber, size: 20),
                        const SizedBox(width: 8),
                        const Text('New Fuel Entry',
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: _textPrimary)),
                        const Spacer(),
                        // Rate badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: (_selectedFuelType == 'petrol' ? _green : _amber).withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: (_selectedFuelType == 'petrol' ? _green : _amber).withValues(alpha: 0.3)),
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

                    // ── Fuel type selector ──
                    Row(
                      children: [
                        _fuelTypeChip('diesel', 'Diesel', _amber),
                        const SizedBox(width: 10),
                        _fuelTypeChip('petrol', 'Petrol', _green),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Fuel Retrieved from ──
                    nozzlesAsync.when(
                      data: (nozzles) => _nozzleSelectorField(nozzles),
                      loading: () => _shimmer(54),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                    if (nozzlesAsync.hasValue && (nozzlesAsync.value ?? []).isNotEmpty)
                      const SizedBox(height: 12),

                    // ── Pump + Tank Used (auto-filled) ──
                    if (_selectedNozzle != null) ...
                      [
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
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _red),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],

                    // ── Vehicle number with OCR ──
                    TextFormField(
                      controller: _vehicleCtrl,
                      decoration: _inputDecor('Vehicle Number').copyWith(
                        hintText: 'e.g. TN23AB1234',
                        hintStyle: const TextStyle(
                            color: Color(0xFFB0BEC5), fontSize: 13),
                        suffixIcon: _scanningPlate
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: _amber),
                                ),
                              )
                            : IconButton(
                                icon: const Icon(
                                    Icons.document_scanner_rounded,
                                    color: _amber,
                                    size: 22),
                                tooltip: 'Scan number plate',
                                onPressed: _scanPlate,
                              ),
                      ),
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                            RegExp(r'[A-Za-z0-9]')),
                        TextInputFormatter.withFunction((old, newVal) =>
                            newVal.copyWith(
                                text: newVal.text.toUpperCase())),
                      ],
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Enter vehicle number';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    // ── Litres + Amount (cross-computed) ──
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _litresCtrl,
                            decoration: _inputDecor('Litres'),
                            keyboardType:
                                const TextInputType.numberWithOptions(
                                    decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(
                                  RegExp(r'[\d.]'))
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
                                const TextInputType.numberWithOptions(
                                    decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(
                                  RegExp(r'[\d.]'))
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
                            border: Border.all(
                                color: _amber.withValues(alpha: 0.2)),
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
                                fontSize: 15,
                                fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),

        // ─── Today's running log ───
        const Text("Today's Log",
            style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: _textPrimary)),
        const SizedBox(height: 10),
        logAsync.when(
          data: (issues) {
            if (issues.isEmpty) return _emptyCard('No fuel entries today');
            final totalL =
                issues.fold<double>(0, (s, i) => s + i.quantityLitres);
            final totalA =
                issues.fold<double>(0, (s, i) => s + i.totalAmount);
            return Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: _cardColor,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _stat('${issues.length}', 'Entries', _green),
                      Container(
                          width: 1,
                          height: 28,
                          color: const Color(0xFFE2E8F0)),
                      _stat(IndianFormat.litres(totalL), 'Litres', _amber),
                      Container(
                          width: 1,
                          height: 28,
                          color: const Color(0xFFE2E8F0)),
                      _stat(IndianFormat.currencyCompact(totalA), 'Cost',
                          _blue),
                    ],
                  ),
                ),
                ...issues.map(_logEntryCard),
              ],
            );
          },
          loading: () => _shimmer(80),
          error: (_, __) => _emptyCard("Failed to load today's log"),
        ),
      ],
    );
  }

  // ─── Submit ──────────────────────────────────────────────────────────────
  Future<void> _submitEntry() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    final ratePerLitre = _effectiveRate();
    final submittedTankId = _selectedNozzle?.tankId; // capture before clearing
    final notifier = ref.read(fuelIssueNotifierProvider.notifier);
    final vehicleNum = _vehicleCtrl.text.trim().toUpperCase();
    final ok = await notifier.issueFuel(
      externalVehicleNumber: vehicleNum.isNotEmpty ? vehicleNum : null,
      quantityLitres: double.parse(_litresCtrl.text),
      ratePerLitre: ratePerLitre,
      fuelType: _selectedFuelType.toUpperCase(),
      tankId: submittedTankId,
    );
    setState(() => _submitting = false);

    if (!mounted) return;
    if (ok) {
      _vehicleCtrl.clear();
      _litresCtrl.clear();
      _amountCtrl.clear();
      setState(() => _selectedNozzle = null);
      ref.invalidate(todayFuelIssuesProvider);
      ref.invalidate(pumpDashboardProvider);
      // Refresh fleet-side providers so tank History tab + stock level update
      if (submittedTankId != null) {
        ref.invalidate(tankIssuesProvider(submittedTankId));
      }
      ref.invalidate(fuelTanksProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Fuel entry logged'),
            backgroundColor: _green),
      );
    } else {
      final err = ref.read(fuelIssueNotifierProvider).error?.toString() ??
          'Failed to log entry';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(err.replaceAll('Exception:', '').trim()),
            backgroundColor: _red),
      );
    }
  }

  // ─── Fuel type chip ───────────────────────────────────────────────────
  Widget _fuelTypeChip(String type, String label, Color color) {
    final selected = _selectedFuelType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (_selectedFuelType == type) return;
          setState(() => _selectedFuelType = type);
          // Recalculate amount with new rate
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
            color: selected ? color.withValues(alpha: 0.12) : const Color(0xFFF7F9FC),
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
                width: 8, height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
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

  // ─── Log entry card ───────────────────────────────────────────────────
  Widget _logEntryCard(FuelIssue issue) {
    final t = issue.issuedAt.toLocal();
    final ts =
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    final vehicleLabel = issue.vehicleRegistration ??
        (issue.vehicleId != null ? 'Vehicle #${issue.vehicleId}' : 'Manual Entry');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: issue.isFlagged
              ? _red.withValues(alpha: 0.3)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: (issue.isFlagged ? _red : _amber)
                  .withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              issue.isFlagged
                  ? Icons.warning_amber_rounded
                  : Icons.local_gas_station_rounded,
              color: issue.isFlagged ? _red : _amber,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  vehicleLabel,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  '${issue.quantityLitres.toStringAsFixed(1)} L  •  ${IndianFormat.currency(issue.totalAmount)}',
                  style: const TextStyle(
                      fontSize: 12, color: _textSecondary),
                ),
              ],
            ),
          ),
          Text(ts,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: _textSecondary)),
        ],
      ),
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
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

  Widget _stat(String value, String label, Color color) => Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                  fontSize: 10, color: _textSecondary)),
        ],
      );

  Widget _emptyCard(String msg) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Center(
          child: Text(msg,
              style: const TextStyle(
                  fontSize: 13, color: _textSecondary)),
        ),
      );

  Widget _shimmer(double h) => Container(
        height: h,
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(12),
        ),
      );

  // ─── Nozzle selector field ─────────────────────────────────────────────
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
            Icon(
              Icons.tune_rounded,
              color: selected != null ? _amber : _textSecondary,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: selected == null
                  ? Text(
                      'Fuel Retrieved from — Select nozzle',
                      style: const TextStyle(
                          fontSize: 13, color: _textSecondary),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Fuel Retrieved from',
                            style: TextStyle(
                                fontSize: 11, color: _textSecondary)),
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
            Icon(
              Icons.arrow_drop_down_rounded,
              color: _textSecondary,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }

  void _showNozzlePicker(List<NozzleInfo> nozzles) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
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
                final color = n.fuelType.toUpperCase() == 'PETROL' ? _green : _amber;
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
                      child: Text(
                        n.nozzleId,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: color),
                      ),
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
                    style: const TextStyle(
                        fontSize: 12, color: _textSecondary),
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

  // ─── Auto-filled info tile ─────────────────────────────────────────────
  Widget _autoFilledTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 15),
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
}
