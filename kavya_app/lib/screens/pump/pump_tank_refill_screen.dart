import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../services/api_service.dart';

/// Standalone screen to record a tank refill / stock receipt from supplier.
/// Accessible via /pump/refill (not a bottom-nav tab).
class PumpTankRefillScreen extends ConsumerStatefulWidget {
  const PumpTankRefillScreen({super.key});

  @override
  ConsumerState<PumpTankRefillScreen> createState() => _PumpTankRefillScreenState();
}

class _PumpTankRefillScreenState extends ConsumerState<PumpTankRefillScreen> {
  static const _bg = Color(0xFFF7F9FC);
  static const _card = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  final _formKey = GlobalKey<FormState>();
  final _api = ApiService();

  int? _selectedTankId;
  final _supplierCtrl = TextEditingController();
  final _invoiceCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _rateCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  bool _submitting = false;

  @override
  void dispose() {
    _supplierCtrl.dispose();
    _invoiceCtrl.dispose();
    _qtyCtrl.dispose();
    _rateCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double get _totalAmount {
    final qty = double.tryParse(_qtyCtrl.text) ?? 0;
    final rate = double.tryParse(_rateCtrl.text) ?? 0;
    return qty * rate;
  }

  @override
  Widget build(BuildContext context) {
    final tanksAsync = ref.watch(fuelTanksProvider);

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0D1B2A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('Tank Refill',
            style: TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Record Tank Refill',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary)),
              const SizedBox(height: 4),
              const Text('Log incoming fuel stock from supplier',
                  style: TextStyle(fontSize: 13, color: _textSecondary)),
              const SizedBox(height: 24),

              // Tank selector
              _label('Select Tank *'),
              const SizedBox(height: 8),
              tanksAsync.when(
                loading: () => const LinearProgressIndicator(color: _amber),
                error: (_, __) => const Text('Failed to load tanks',
                    style: TextStyle(color: Colors.red)),
                data: (tanks) => DropdownButtonFormField<int>(
                  initialValue: _selectedTankId,
                  hint: const Text('Choose tank to refill',
                      style: TextStyle(color: Color(0xFF94A3B8))),
                  dropdownColor: _card,
                  style: const TextStyle(color: _textPrimary, fontSize: 14),
                  decoration: _inputDecoration(''),
                  items: tanks
                      .map((t) => DropdownMenuItem(
                            value: t.id,
                            child: Text(
                                '${t.name} — ${t.currentStockLitres.toStringAsFixed(0)} L / ${t.capacityLitres.toStringAsFixed(0)} L'),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedTankId = v),
                  validator: (v) => v == null ? 'Select a tank' : null,
                ),
              ),
              const SizedBox(height: 20),

              // Supplier
              _label('Supplier Name *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _supplierCtrl,
                style: const TextStyle(color: _textPrimary),
                decoration: _inputDecoration('e.g. Indian Oil Corporation'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Enter supplier name' : null,
              ),
              const SizedBox(height: 20),

              // Invoice number
              _label('Invoice / Challan Number *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _invoiceCtrl,
                style: const TextStyle(color: _textPrimary),
                decoration: _inputDecoration('e.g. INV-2025-4821'),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Enter invoice number' : null,
              ),
              const SizedBox(height: 20),

              // Quantity
              _label('Quantity Received (L) *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _qtyCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                ],
                style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700),
                decoration: _inputDecoration('e.g. 5000').copyWith(
                  suffixText: 'L',
                  suffixStyle:
                      const TextStyle(color: _textSecondary, fontSize: 14),
                ),
                onChanged: (_) => setState(() {}),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Enter quantity';
                  final n = double.tryParse(v);
                  if (n == null || n <= 0) return 'Enter valid quantity';
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Rate per litre
              _label('Rate per Litre (₹) *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _rateCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                ],
                style: const TextStyle(
                    color: _textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700),
                decoration: _inputDecoration('e.g. 91.20').copyWith(
                  prefixText: '₹ ',
                  prefixStyle: const TextStyle(
                      color: _amber,
                      fontWeight: FontWeight.w700,
                      fontSize: 18),
                  suffixText: '/L',
                  suffixStyle:
                      const TextStyle(color: _textSecondary, fontSize: 14),
                ),
                onChanged: (_) => setState(() {}),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Enter rate';
                  final n = double.tryParse(v);
                  if (n == null || n <= 0) return 'Enter valid rate';
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Date picker
              _label('Receipt Date'),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now().add(const Duration(days: 1)),
                    builder: (ctx, child) => Theme(
                      data: Theme.of(ctx).copyWith(
                        colorScheme: const ColorScheme.light(
                          primary: _amber,
                          surface: Color(0xFFF7F9FC),
                        ),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) setState(() => _date = picked);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: _card,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today, color: _amber, size: 18),
                      const SizedBox(width: 10),
                      Text(
                        '${_date.day}/${_date.month}/${_date.year}',
                        style: const TextStyle(color: _textPrimary, fontSize: 14),
                      ),
                      const Spacer(),
                      const Icon(Icons.arrow_drop_down, color: _textSecondary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Notes
              _label('Notes (optional)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _notesCtrl,
                maxLines: 2,
                style: const TextStyle(color: _textPrimary),
                decoration: _inputDecoration('Any remarks about this delivery...'),
              ),
              const SizedBox(height: 28),

              // Total preview
              if (_qtyCtrl.text.isNotEmpty && _rateCtrl.text.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: _amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: _amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Invoice Amount',
                          style: TextStyle(
                              fontSize: 14,
                              color: _textSecondary,
                              fontWeight: FontWeight.w600)),
                      Text(
                        '₹${_totalAmount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: _amber,
                          fontFamily: 'JetBrains Mono',
                        ),
                      ),
                    ],
                  ),
                ),

              // Submit
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _amber,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    textStyle: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  icon: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black),
                        )
                      : const Icon(Icons.add_road),
                  label: Text(_submitting ? 'Submitting...' : 'Record Refill'),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    try {
      await _api.post('/fuel-pump/stock', data: {
        'tank_id': _selectedTankId,
        'transaction_type': 'TANKER_REFILL',
        'quantity_litres': double.parse(_qtyCtrl.text),
        'rate_per_litre': double.parse(_rateCtrl.text),
        if (_invoiceCtrl.text.trim().isNotEmpty)
          'reference_number': _invoiceCtrl.text.trim(),
        if (_supplierCtrl.text.trim().isNotEmpty || _notesCtrl.text.trim().isNotEmpty)
          'remarks': [
            if (_supplierCtrl.text.trim().isNotEmpty) 'Supplier: ${_supplierCtrl.text.trim()}',
            if (_notesCtrl.text.trim().isNotEmpty) _notesCtrl.text.trim(),
          ].join(' | '),
      });

      if (!mounted) return;
      ref.invalidate(fuelTanksProvider);
      ref.invalidate(pumpDashboardProvider);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tank refill recorded successfully'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to record refill: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _label(String text) {
    return Text(text,
        style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF0D1B2A)));
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: _textSecondary),
      filled: true,
      fillColor: _card,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
    );
  }
}
