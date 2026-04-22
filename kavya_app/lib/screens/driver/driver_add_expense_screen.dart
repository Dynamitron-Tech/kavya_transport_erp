import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/expense.dart';
import '../../providers/expense_provider.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_text_field.dart';
import '../../core/widgets/photo_capture.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider
import 'pin_verification_screen.dart';
import '../../core/localization/locale_provider.dart';

class DriverAddExpenseScreen extends ConsumerStatefulWidget {
  const DriverAddExpenseScreen({super.key});

  @override
  ConsumerState<DriverAddExpenseScreen> createState() => _DriverAddExpenseScreenState();
}

class _DriverAddExpenseScreenState extends ConsumerState<DriverAddExpenseScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _upiRefCtrl = TextEditingController();
  String _category = 'fuel';
  String _paymentMethod = 'cash'; // 'cash' | 'gpay_upi'
  File? _receipt;
  bool _submitting = false;
  bool _ocrRunning = false;
  double? _ocrAmount;
  String? _ocrWarning;

  // Field expenses: driver_advance is NOT here (issued by admin pre-trip via Razorpay X)
  static const _categories = [
    'fuel', 'toll', 'food', 'vehicle_spare_part',
    'loading_unloading', 'parking', 'police', 'misc_field',
  ];

  static const _categoryLabels = <String, String>{
    'fuel':              'Fuel',
    'toll':              'Toll',
    'food':              'Food / Meals',
    'vehicle_spare_part': 'Spare Parts',
    'loading_unloading': 'Loading / Unloading',
    'parking':           'Parking',
    'police':            'Police / Challan',
    'misc_field':        'Miscellaneous',
  };

  static const double _biometricThreshold = 500.0;
  // Threshold above which GPay is REQUIRED
  static const double _gpayThresholdSpare = 3000.0;
  static const double _gpayThresholdLoading = 4000.0;

  bool get _isGpayRequiredByThreshold {
    final amt = double.tryParse(_amountCtrl.text) ?? 0;
    if (_category == 'vehicle_spare_part' && amt > _gpayThresholdSpare) return true;
    if (_category == 'loading_unloading'  && amt > _gpayThresholdLoading) return true;
    return false;
  }

  bool get _showUpiRef =>
      _paymentMethod == 'gpay_upi' || _isGpayRequiredByThreshold;

  bool get _upiRefRequired => _isGpayRequiredByThreshold;

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(_onAmountChanged);
  }

  void _onAmountChanged() => setState(() {});

  @override
  void dispose() {
    _amountCtrl.removeListener(_onAmountChanged);
    _amountCtrl.dispose();
    _descCtrl.dispose();
    _upiRefCtrl.dispose();
    super.dispose();
  }

  /// Run OCR on the receipt image and compare with user-entered amount.
  Future<void> _runOcrVerification(File file) async {
    setState(() {
      _ocrRunning = true;
      _ocrWarning = null;
      _ocrAmount = null;
    });

    try {
      final api = ref.read(apiServiceProvider);
      final result = await api.ocrReceipt(file);
      final data = result['data'] is Map
          ? Map<String, dynamic>.from(result['data'] as Map)
          : <String, dynamic>{};

      final extracted = data['extracted'] == true;
      final ocrAmount = (data['amount'] as num?)?.toDouble();

      if (extracted && ocrAmount != null) {
        _ocrAmount = ocrAmount;
        // Auto-fill category if detected
        final ocrCategory = data['category'] as String?;
        if (ocrCategory != null) {
          final lower = ocrCategory.toLowerCase();
          if (_categoryLabels.containsKey(lower)) {
            setState(() => _category = lower);
          }
        }

        // Comparste with user-entered amount
        final userAmount = double.tryParse(_amountCtrl.text);
        if (userAmount != null && (userAmount - ocrAmount).abs() > 1.0) {
          setState(() {
            _ocrWarning =
                'Receipt shows ₹${ocrAmount.toStringAsFixed(2)} but you entered ₹${userAmount.toStringAsFixed(2)}. Please verify the amount.';
          });
        } else if (userAmount == null && _amountCtrl.text.isEmpty) {
          // Auto-fill amount from OCR
          _amountCtrl.text = ocrAmount.toStringAsFixed(0);
        }
      }
    } catch (e) {
      debugPrint('OCR failed: $e');
      // OCR failure is non-blocking — user can still submit
    } finally {
      if (mounted) {
        setState(() => _ocrRunning = false);
      }
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final amount = double.tryParse(_amountCtrl.text) ?? 0;
    final effectiveMethod = _isGpayRequiredByThreshold ? 'gpay_upi' : _paymentMethod;

    // Validate UPI ref when required
    if (effectiveMethod == 'gpay_upi' && _upiRefRequired && _upiRefCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('UPI transaction reference is required for this amount.')),
      );
      return;
    }

    setState(() => _submitting = true);
    final s = ref.read(sProvider);

    bool biometricVerified = false;

    // Check OCR amount mismatch before submitting
    if (_ocrAmount != null && (_ocrAmount! - amount).abs() > 1.0) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(s.amountMismatch),
          content: Text(
            'The receipt shows ₹${_ocrAmount!.toStringAsFixed(2)} but you entered ₹${amount.toStringAsFixed(2)}.\n\nDo you want to proceed anyway?',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(s.correctAmount)),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(s.proceedAnyway)),
          ],
        ),
      );
      if (proceed != true) {
        setState(() => _submitting = false);
        return;
      }
    }

    // Security PIN verification for expenses >= ₹500
    if (amount >= _biometricThreshold) {
      if (!mounted) return;
      final api = ref.read(apiServiceProvider);
      final pinResult = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => PinVerificationScreen(
            subtitle: 'Verify identity for expense of ₹${amount.toStringAsFixed(0)}',
            onVerify: (pin) => api.verifySecurityPin(pin),
          ),
        ),
      );
      if (pinResult == true) {
        biometricVerified = true;
      } else {
        setState(() => _submitting = false);
        return;
      }
    }

    // Upload receipt image to server if present
    String? receiptServerUrl;
    if (_receipt != null) {
      try {
        final api = ref.read(apiServiceProvider);
        receiptServerUrl = await api.uploadReceiptImage(_receipt!);
      } catch (e) {
        debugPrint('Receipt upload failed: $e');
        // Non-blocking — submit expense without receipt URL
      }
    }

    final expense = Expense(
      category: _category,
      amount: amount,
      description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
      date: DateTime.now().toIso8601String().split('T').first,
      receiptUrl: receiptServerUrl,
    );

    // Build extra fields for the new /expenses endpoint
    final extraPayload = <String, dynamic>{
      'payment_method': effectiveMethod,
      if (_upiRefCtrl.text.trim().isNotEmpty) 'upi_ref_number': _upiRefCtrl.text.trim(),
      // Map old category names to new enum values where needed
      'expense_category': _category,
    };

    await ref.read(expensesProvider(null).notifier).addExpense(
      expense,
      biometricVerified: biometricVerified,
      extraPayload: extraPayload,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.expenseAdded)));
      Navigator.of(context).pop(true); // Return true so list screen can refresh
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);
    final amountRs = double.tryParse(_amountCtrl.text) ?? 0;
    final showSpareWarning = _category == 'vehicle_spare_part' && amountRs > _gpayThresholdSpare;
    final showLoadingWarning = _category == 'loading_unloading'  && amountRs > _gpayThresholdLoading;

    return Scaffold(
      appBar: AppBar(title: Text(s.addExpenseTitle)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(s.category, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              InputDecorator(
                decoration: const InputDecoration(),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _category,
                    isDense: true,
                    isExpanded: true,
                    items: _categories.map((c) => DropdownMenuItem(
                      value: c,
                      child: Text(_categoryLabels[c] ?? c.replaceAll('_', ' ').toUpperCase()),
                    )).toList(),
                    onChanged: (v) => setState(() {
                      _category = v ?? 'fuel';
                      if (_category == 'vehicle_spare_part' || _category == 'loading_unloading') {
                        _paymentMethod = 'gpay_upi';
                      } else {
                        _paymentMethod = 'cash';
                      }
                    }),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              KtTextField(
                label: s.amount,
                controller: _amountCtrl,
                keyboardType: TextInputType.number,
                hint: 'e.g., 500',
                validator: (v) {
                  if (v == null || v.isEmpty) return s.required_;
                  if (double.tryParse(v) == null) return s.invalidAmount;
                  return null;
                },
              ),
              // Threshold warning banners
              if (showSpareWarning)
                _ThresholdWarning(message: 'Spare parts above ₹3,000 — GPay payment required. Enter UPI ref.'),
              if (showLoadingWarning)
                _ThresholdWarning(message: 'Loading/Unloading above ₹4,000 — GPay payment required. Enter UPI ref.'),
              // OCR warning banner
              if (_ocrWarning != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.orange.shade300),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.orange.shade700, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_ocrWarning!, style: TextStyle(fontSize: 12, color: Colors.orange.shade900))),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              // Payment method
              Text('Payment Method', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              InputDecorator(
                decoration: const InputDecoration(),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _isGpayRequiredByThreshold ? 'gpay_upi' : _paymentMethod,
                    isDense: true,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'cash',     child: Text('Cash')),
                      DropdownMenuItem(value: 'gpay_upi', child: Text('GPay / UPI')),
                    ],
                    onChanged: _isGpayRequiredByThreshold
                        ? null
                        : (v) => setState(() => _paymentMethod = v ?? 'cash'),
                  ),
                ),
              ),
              // UPI Ref field (shown when GPay selected or threshold exceeded)
              if (_showUpiRef)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GPay UPI Transaction Ref${_upiRefRequired ? ' *' : ''}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _upiRefCtrl,
                              decoration: InputDecoration(
                                hintText: 'e.g. T20260409123456789',
                                border: const OutlineInputBorder(),
                                suffixIcon: _upiRefCtrl.text.isNotEmpty
                                    ? IconButton(
                                        icon: const Icon(Icons.clear, size: 18),
                                        onPressed: () => setState(() => _upiRefCtrl.clear()),
                                      )
                                    : null,
                              ),
                              onChanged: (_) => setState(() {}),
                              validator: _upiRefRequired
                                  ? (v) => (v == null || v.trim().isEmpty) ? 'UPI ref is required' : null
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 8),
                          // "Paste from clipboard" button
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green.shade50,
                              foregroundColor: Colors.green.shade800,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                            ),
                            icon: const Icon(Icons.paste, size: 16),
                            label: const Text('Paste', style: TextStyle(fontSize: 12)),
                            onPressed: () async {
                              final data = await Clipboard.getData('text/plain');
                              if (data?.text != null && data!.text!.isNotEmpty) {
                                setState(() => _upiRefCtrl.text = data.text!.trim());
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              KtTextField(label: s.description, controller: _descCtrl, hint: s.optionalNotes, maxLines: 2),
              const SizedBox(height: 16),
              Text(s.receiptPhoto, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              PhotoCapture(onCaptured: (file) {
                setState(() => _receipt = file);
                _runOcrVerification(file);
              }),
              if (_ocrRunning)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                      const SizedBox(width: 8),
                      Text(s.verifyingReceipt, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              KtButton(label: s.saveExpense, icon: Icons.save, isLoading: _submitting, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}

class _ThresholdWarning extends StatelessWidget {
  final String message;
  const _ThresholdWarning({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.amber.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.amber.shade400),
        ),
        child: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber.shade800, size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(message, style: TextStyle(fontSize: 12, color: Colors.amber.shade900))),
          ],
        ),
      ),
    );
  }
}
