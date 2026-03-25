import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:share_plus/share_plus.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';

/// Fuel dispensing form — large touch targets for pump-side use.
class PumpDispenseScreen extends ConsumerStatefulWidget {
  const PumpDispenseScreen({super.key});

  @override
  ConsumerState<PumpDispenseScreen> createState() => _PumpDispenseScreenState();
}

class _PumpDispenseScreenState extends ConsumerState<PumpDispenseScreen> {
  static const _cardColor = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  final _formKey = GlobalKey<FormState>();
  int? _selectedTankId;
  String? _selectedTankName;
  int? _selectedVehicleId;
  String? _selectedVehicleReg;
  final _litresCtrl = TextEditingController();
  final _rateCtrl = TextEditingController(text: '93.21');
  final _odometerCtrl = TextEditingController();
  final _driverCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  // Auto-generated receipt number shown read-only
  late final String _receiptNumber;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final seq = now.millisecondsSinceEpoch % 10000;
    _receiptNumber =
        'FP-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${seq.toString().padLeft(4, '0')}';
  }

  @override
  void dispose() {
    _litresCtrl.dispose();
    _rateCtrl.dispose();
    _odometerCtrl.dispose();
    _driverCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tanksAsync = ref.watch(fuelTanksProvider);
    final vehiclesAsync = ref.watch(vehicleListProvider);
    final issueState = ref.watch(fuelIssueNotifierProvider);
    final isSubmitting = issueState is AsyncLoading;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Dispense Fuel',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Record a fuel dispensing entry',
              style: TextStyle(fontSize: 13, color: _textSecondary),
            ),
            const SizedBox(height: 20),

            // Receipt number (read-only)
            _label('Receipt Number'),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: _cardColor,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _amber.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: _amber, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    _receiptNumber,
                    style: const TextStyle(
                      color: _amber,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'JetBrains Mono',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Tank Selector
            _label('Select Tank'),
            const SizedBox(height: 8),
            tanksAsync.when(
              loading: () => const LinearProgressIndicator(color: _amber),
              error: (_, __) => const Text('Failed to load tanks', style: TextStyle(color: Colors.red)),
              data: (tanks) => _dropdownField<int>(
                initialValue: _selectedTankId,
                hint: 'Choose fuel tank',
                items: tanks
                    .map((t) => DropdownMenuItem(
                          value: t.id,
                          child: Text('${t.name} (${t.currentStockLitres.toStringAsFixed(0)} L remain)'),
                        ))
                    .toList(),
                onChanged: (v) {
                  final tank = tanks.firstWhere((t) => t.id == v);
                  setState(() {
                    _selectedTankId = v;
                    _selectedTankName = tank.name;
                  });
                },
                validator: (v) => v == null ? 'Select a tank' : null,
              ),
            ),
            const SizedBox(height: 20),

            // Vehicle Selector
            _label('Vehicle Number'),
            const SizedBox(height: 8),
            vehiclesAsync.when(
              loading: () => const LinearProgressIndicator(color: _amber),
              error: (_, __) => const Text('Failed to load vehicles', style: TextStyle(color: Colors.red)),
              data: (vehicles) => _dropdownField<int>(
                initialValue: _selectedVehicleId,
                hint: 'Search / select vehicle',
                items: vehicles
                    .map((v) => DropdownMenuItem(
                          value: v['id'] as int,
                          child: Text(v['registration_number']?.toString() ?? 'Vehicle #${v['id']}'),
                        ))
                    .toList(),
                onChanged: (v) {
                  final vehicle = vehicles.firstWhere((veh) => veh['id'] == v);
                  setState(() {
                    _selectedVehicleId = v;
                    _selectedVehicleReg = vehicle['registration_number']?.toString() ?? 'Vehicle #$v';
                  });
                },
                validator: (v) => v == null ? 'Select a vehicle' : null,
              ),
            ),
            const SizedBox(height: 20),

            // Driver name (optional free text)
            _label('Driver Name (optional)'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _driverCtrl,
              style: const TextStyle(color: _textPrimary),
              decoration: _inputDecoration('e.g. Raman Kumar'),
            ),
            const SizedBox(height: 20),

            // Litres
            _label('Litres Dispensed'),
            const SizedBox(height: 8),
            _numericField(
              controller: _litresCtrl,
              hint: 'e.g. 120',
              suffix: 'L',
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter litres';
                final n = double.tryParse(v);
                if (n == null || n <= 0) return 'Enter valid quantity';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Rate per litre
            _label('Rate per Litre (₹)'),
            const SizedBox(height: 8),
            _numericField(
              controller: _rateCtrl,
              hint: 'e.g. 93.21',
              prefix: '₹',
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter rate';
                final n = double.tryParse(v);
                if (n == null || n <= 0) return 'Enter valid rate';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Odometer (optional)
            _label('Odometer Reading (optional)'),
            const SizedBox(height: 8),
            _numericField(
              controller: _odometerCtrl,
              hint: 'e.g. 125430',
              suffix: 'km',
            ),
            const SizedBox(height: 20),

            // Notes
            _label('Notes (optional)'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _notesCtrl,
              maxLines: 2,
              style: const TextStyle(color: _textPrimary),
              decoration: _inputDecoration('Any remarks...'),
            ),
            const SizedBox(height: 32),

            // Total preview
            if (_litresCtrl.text.isNotEmpty && _rateCtrl.text.isNotEmpty)
              _totalPreview(),
            const SizedBox(height: 16),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _amber,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                onPressed: isSubmitting ? null : _submit,
                icon: isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(Icons.local_gas_station),
                label: Text(isSubmitting ? 'Submitting...' : 'Record Fuel Issue'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _totalPreview() {
    final litres = double.tryParse(_litresCtrl.text) ?? 0;
    final rate = double.tryParse(_rateCtrl.text) ?? 0;
    final total = litres * rate;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _amber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _amber.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Total Amount',
            style: TextStyle(fontSize: 14, color: _textSecondary, fontWeight: FontWeight.w600),
          ),
          Text(
            IndianFormat.currency(total),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: _amber,
              fontFamily: 'JetBrains Mono',
            ),
          ),
        ],
      ),
    );
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final litres = double.parse(_litresCtrl.text);
    final rate = double.parse(_rateCtrl.text);
    final odometer = _odometerCtrl.text.isNotEmpty ? double.parse(_odometerCtrl.text) : null;
    final notes = _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null;
    final driver = _driverCtrl.text.isNotEmpty ? _driverCtrl.text : null;

    bool ok = false;
    bool savedOffline = false;

    try {
      ok = await ref.read(fuelIssueNotifierProvider.notifier).issueFuel(
            tankId: _selectedTankId!,
            vehicleId: _selectedVehicleId!,
            quantityLitres: litres,
            ratePerLitre: rate,
            odometerReading: odometer,
            remarks: notes,
            receiptNumber: _receiptNumber,
          );
    } catch (_) {
      // Network failure — queue offline
      try {
        final box = await Hive.openBox<String>('offline_queue');
        final payload = jsonEncode({
          'method': 'POST',
          'path': '/fuel-pump/issues',
          'data': {
            'tank_id': _selectedTankId,
            'vehicle_id': _selectedVehicleId,
            'quantity_litres': litres,
            'rate_per_litre': rate,
            if (odometer != null) 'odometer_reading': odometer,
            if (notes != null) 'remarks': notes,
            if (driver != null) 'driver_name': driver,
            'receipt_number': _receiptNumber,
          },
          'timestamp': DateTime.now().toIso8601String(),
          'client_action_id': _receiptNumber,
        });
        await box.put('pump_${DateTime.now().millisecondsSinceEpoch}', payload);
        savedOffline = true;
        ok = true; // treat as success for receipt display
      } catch (_) {
        // Hive also failed — show error
      }
    }

    if (!mounted) return;

    if (ok) {
      // Refresh dashboard data
      ref.invalidate(pumpDashboardProvider);
      ref.invalidate(todayFuelIssuesProvider);

      // Show receipt bottom sheet
      await showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (_) => _FuelReceiptSheet(
          receiptNumber: _receiptNumber,
          vehicleReg: _selectedVehicleReg ?? 'Vehicle #$_selectedVehicleId',
          tankName: _selectedTankName ?? 'Tank #$_selectedTankId',
          litres: litres,
          rate: rate,
          driver: driver,
          isOffline: savedOffline,
          onNewEntry: _resetForm,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to record fuel issue. Please try again.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  void _resetForm() {
    _litresCtrl.clear();
    _odometerCtrl.clear();
    _driverCtrl.clear();
    _notesCtrl.clear();
    setState(() {
      _selectedVehicleId = null;
      _selectedVehicleReg = null;
    });
    // receipt number is final per entry, so we just navigate focus back to form
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Ready for next entry'),
        backgroundColor: Color(0xFF10B981),
        duration: Duration(seconds: 1),
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _textSecondary),
    );
  }

  Widget _numericField({
    required TextEditingController controller,
    String? hint,
    String? prefix,
    String? suffix,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      style: const TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
      onChanged: (_) => setState(() {}),
      validator: validator,
      decoration: _inputDecoration(hint ?? '').copyWith(
        prefixText: prefix,
        prefixStyle: const TextStyle(color: _amber, fontWeight: FontWeight.w700, fontSize: 16),
        suffixText: suffix,
        suffixStyle: const TextStyle(color: _textSecondary, fontSize: 14),
      ),
    );
  }

  Widget _dropdownField<T>({
    required T? initialValue,
    required String hint,
    required List<DropdownMenuItem<T>> items,
    required void Function(T?) onChanged,
    String? Function(T?)? validator,
  }) {
    return DropdownButtonFormField<T>(
      initialValue: initialValue,
      hint: Text(hint, style: const TextStyle(color: _textSecondary)),
      items: items,
      onChanged: onChanged,
      validator: validator,
      dropdownColor: _cardColor,
      style: const TextStyle(color: _textPrimary, fontSize: 14),
      decoration: _inputDecoration(''),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: _textSecondary),
      filled: true,
      fillColor: _cardColor,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _amber, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Fuel Receipt Bottom Sheet
// ---------------------------------------------------------------------------

class _FuelReceiptSheet extends StatelessWidget {
  const _FuelReceiptSheet({
    required this.receiptNumber,
    required this.vehicleReg,
    required this.tankName,
    required this.litres,
    required this.rate,
    this.driver,
    required this.isOffline,
    required this.onNewEntry,
  });

  final String receiptNumber;
  final String vehicleReg;
  final String tankName;
  final double litres;
  final double rate;
  final String? driver;
  final bool isOffline;
  final VoidCallback onNewEntry;

  static const _bg = Color(0xFFF7F9FC);
  static const _card = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  double get _total => litres * rate;

  String get _shareText {
    final now = DateTime.now();
    return '''
Kavya Transport — Fuel Receipt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Receipt No : $receiptNumber
Date/Time  : ${now.day}/${now.month}/${now.year} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}
Vehicle    : $vehicleReg
Tank       : $tankName${driver != null ? '\nDriver     : $driver' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quantity   : ${litres.toStringAsFixed(2)} L
Rate       : ₹${rate.toStringAsFixed(2)}/L
Total      : ${IndianFormat.currency(_total)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isOffline ? '⚠ Saved offline — will sync when online' : '✓ Recorded Successfully'}
''';
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Container(
      decoration: const BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFE8EEF4),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          // Offline badge
          if (isOffline)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.wifi_off, size: 14, color: Color(0xFFF59E0B)),
                  SizedBox(width: 6),
                  Text(
                    'Saved offline — will sync when back online',
                    style: TextStyle(fontSize: 12, color: Color(0xFFF59E0B), fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),

          // Receipt header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.receipt_long, color: _amber, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Fuel Receipt',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _textPrimary)),
                    Text(
                      '${now.day}/${now.month}/${now.year}  ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(fontSize: 12, color: _textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isOffline
                      ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                      : const Color(0xFF10B981).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isOffline ? 'QUEUED' : 'RECORDED',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isOffline ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Receipt body
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _card,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                _receiptRow('Receipt #', receiptNumber, mono: true),
                _receiptRow('Vehicle', vehicleReg),
                _receiptRow('Tank', tankName),
                if (driver != null) _receiptRow('Driver', driver!),
                const Divider(color: Color(0xFFE8EEF4), height: 20),
                _receiptRow('Quantity', '${litres.toStringAsFixed(2)} L'),
                _receiptRow('Rate', '₹${rate.toStringAsFixed(2)}/L'),
                const Divider(color: Color(0xFFE8EEF4), height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Amount',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _textPrimary)),
                    Text(
                      IndianFormat.currency(_total),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: _amber,
                        fontFamily: 'JetBrains Mono',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => SharePlus.instance.share(ShareParams(text: _shareText, subject: 'Fuel Receipt $receiptNumber')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _amber,
                    side: const BorderSide(color: _amber),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.share, size: 18),
                  label: const Text('Share Receipt'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    onNewEntry();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _amber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('New Entry', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _receiptRow(String label, String value, {bool mono = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: _textSecondary)),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _textPrimary,
              fontFamily: mono ? 'JetBrains Mono' : null,
            ),
          ),
        ],
      ),
    );
  }
}
