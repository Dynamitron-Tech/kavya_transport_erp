import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../services/api_service.dart';

/// Screen to create a new depot fuel tank.
/// Accessible via /pump/create-tank (standalone, no bottom nav).
class PumpCreateTankScreen extends ConsumerStatefulWidget {
  const PumpCreateTankScreen({super.key});

  @override
  ConsumerState<PumpCreateTankScreen> createState() =>
      _PumpCreateTankScreenState();
}

class _PumpCreateTankScreenState extends ConsumerState<PumpCreateTankScreen> {
  static const _bg = Color(0xFFF7F9FC);
  static const _card = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _emerald = Color(0xFF10B981);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  final _formKey = GlobalKey<FormState>();
  final _api = ApiService();

  final _nameCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  final _openingStockCtrl = TextEditingController();
  final _minStockCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();

  String _fuelType = 'DIESEL';
  bool _submitting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _capacityCtrl.dispose();
    _openingStockCtrl.dispose();
    _minStockCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0D1B2A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Text('Create Fuel Tank',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Info banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _emerald.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.local_gas_station, color: _emerald, size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Create a new depot fuel tank. Once created, you can issue fuel and record refills against this tank.',
                        style: TextStyle(
                            fontSize: 13, color: _textSecondary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Tank Name
              _label('Tank Name'),
              const SizedBox(height: 6),
              _textField(
                controller: _nameCtrl,
                hint: 'e.g. Main Diesel Tank',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Tank name is required' : null,
              ),
              const SizedBox(height: 16),

              // Fuel Type
              _label('Fuel Type'),
              const SizedBox(height: 6),
              _fuelTypeSelector(),
              const SizedBox(height: 16),

              // Capacity
              _label('Tank Capacity (Litres)'),
              const SizedBox(height: 6),
              _textField(
                controller: _capacityCtrl,
                hint: 'e.g. 5000',
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))
                ],
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Capacity is required';
                  if ((double.tryParse(v) ?? 0) <= 0) {
                    return 'Enter a valid capacity';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Opening Stock
              _label('Opening Stock (Litres)'),
              const SizedBox(height: 6),
              _textField(
                controller: _openingStockCtrl,
                hint: '0  —  leave blank if empty',
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))
                ],
              ),
              const SizedBox(height: 16),

              // Min Stock Alert
              _label('Low Stock Alert (Litres)  — optional'),
              const SizedBox(height: 6),
              _textField(
                controller: _minStockCtrl,
                hint: 'e.g. 500  —  alert when stock falls below',
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))
                ],
              ),
              const SizedBox(height: 16),

              // Location
              _label('Location  — optional'),
              const SizedBox(height: 6),
              _textField(
                controller: _locationCtrl,
                hint: 'e.g. Depot Gate A',
              ),
              const SizedBox(height: 32),

              // Submit button
              ElevatedButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : const Icon(Icons.check_circle_outline, size: 20),
                label: Text(
                    _submitting ? 'Creating Tank…' : 'Create Tank',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _emerald,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: _emerald.withValues(alpha: 0.5),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Helpers ───

  Widget _label(String text) => Text(
        text,
        style: const TextStyle(
            fontSize: 13, fontWeight: FontWeight.w600, color: _textPrimary),
      );

  Widget _textField({
    required TextEditingController controller,
    String? hint,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      style: const TextStyle(color: _textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: _textSecondary, fontSize: 13),
        filled: true,
        fillColor: _card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: const Color(0xFFE8EEF4)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: const Color(0xFFE8EEF4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: _amber, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  Widget _fuelTypeSelector() {
    const options = [
      ('DIESEL', 'Diesel', Color(0xFFFBBF24)),
      ('PETROL', 'Petrol', Color(0xFF60A5FA)),
      ('CNG', 'CNG', Color(0xFF34D399)),
      ('DEF', 'DEF', Color(0xFFA78BFA)),
    ];
    return Row(
      children: options.map((opt) {
        final (value, label, color) = opt;
        final selected = _fuelType == value;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _fuelType = value),
            child: Container(
              margin: EdgeInsets.only(
                  right: value != 'DEF' ? 8 : 0),
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: selected
                    ? color.withValues(alpha: 0.2)
                    : _card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: selected ? color : const Color(0xFFE8EEF4),
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? color : _textSecondary,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final capacity = double.tryParse(_capacityCtrl.text.trim()) ?? 0;
    final openingStock = double.tryParse(_openingStockCtrl.text.trim()) ?? 0;

    if (openingStock > capacity) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Opening stock cannot exceed tank capacity'),
        backgroundColor: Color(0xFFEF4444),
      ));
      return;
    }

    setState(() => _submitting = true);
    try {
      await _api.post('/fuel-pump/tanks', data: {
        'name': _nameCtrl.text.trim(),
        'fuel_type': _fuelType,
        'capacity_litres': capacity,
        'current_stock_litres': openingStock,
        if (_minStockCtrl.text.trim().isNotEmpty)
          'min_stock_alert': double.parse(_minStockCtrl.text.trim()),
        if (_locationCtrl.text.trim().isNotEmpty)
          'location': _locationCtrl.text.trim(),
      });

      // Refresh tanks list
      ref.invalidate(fuelTanksProvider);
      ref.invalidate(pumpDashboardProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              'Tank "${_nameCtrl.text.trim()}" created successfully'),
          backgroundColor: const Color(0xFF10B981),
        ));
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to create tank: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
