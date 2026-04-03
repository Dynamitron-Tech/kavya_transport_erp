import 'dart:io';
import 'package:flutter/material.dart';
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
  String _category = 'fuel';
  File? _receipt;
  bool _submitting = false;
  bool _ocrRunning = false;
  double? _ocrAmount;
  String? _ocrWarning;

  static const _categories = ['fuel', 'toll', 'food', 'maintenance', 'loading', 'unloading', 'parking', 'police', 'other'];
  static const double _biometricThreshold = 500.0;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _descCtrl.dispose();
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
          if (_categories.contains(lower)) {
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
    setState(() => _submitting = true);
    final s = ref.read(sProvider);

    final amount = double.tryParse(_amountCtrl.text) ?? 0;
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

    await ref.read(expensesProvider(null).notifier).addExpense(expense, biometricVerified: biometricVerified);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.expenseAdded)));
      Navigator.of(context).pop(true); // Return true so list screen can refresh
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(sProvider);
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
              DropdownButtonFormField<String>(
                initialValue: _category,
                items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ').toUpperCase()))).toList(),
                onChanged: (v) => setState(() => _category = v ?? 'fuel'),
                decoration: const InputDecoration(),
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
              KtTextField(label: s.description, controller: _descCtrl, hint: s.optionalNotes, maxLines: 2),
              const SizedBox(height: 16),
              Text(s.receiptPhoto, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              PhotoCapture(onCaptured: (file) {
                setState(() => _receipt = file);
                // Run OCR verification on the captured receipt
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
