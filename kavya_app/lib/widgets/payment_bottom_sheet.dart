// Payment Bottom Sheet — UPI deep-link + NEFT / RTGS / Cheque / Cash recording
// Transport ERP Flutter App — Accountant role
//
// SAFETY RULES enforced here:
//  1. Payment is NEVER auto-recorded on url_launcher return. User must tap "Yes, I Paid".
//  2. Bottom sheet is NEVER closed on API error. User can retry.
//  3. amount_paid > outstanding is rejected in form validator AND on server.
//  4. canLaunchUrl() is always checked before launchUrl().
//  5. Every async call is guarded with mounted checks.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme/kt_colors.dart';
import '../models/payment_models.dart';
import '../services/payment_service.dart';
import '../utils/upi_launcher.dart';

// ─────────────────────────────────────────────────────────────────────────────
// PaymentBottomSheet
// ─────────────────────────────────────────────────────────────────────────────

class PaymentBottomSheet extends ConsumerStatefulWidget {
  final int invoiceId;
  final int clientId;
  final String invoiceNumber;
  final double outstandingAmount;
  final String clientName;
  final VoidCallback onPaymentRecorded;

  const PaymentBottomSheet({
    super.key,
    required this.invoiceId,
    required this.clientId,
    required this.invoiceNumber,
    required this.outstandingAmount,
    required this.clientName,
    required this.onPaymentRecorded,
  });

  @override
  ConsumerState<PaymentBottomSheet> createState() => _PaymentBottomSheetState();
}

class _PaymentBottomSheetState extends ConsumerState<PaymentBottomSheet> {
  // ── State ──────────────────────────────────────────────────────────────────
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();

  String _selectedMode = 'UPI';
  DateTime _paymentDate = DateTime.now();
  bool _submitting = false;
  bool _showRefField = false;  // revealed after UPI confirm or when mode ≠ UPI

  ClientPaymentInfo? _paymentInfo;
  bool _paymentInfoLoading = true;

  // UPI confirm context
  String? _confirmedUpiTxnId;

  final _currencyFormat = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.outstandingAmount.toStringAsFixed(0);
    _fetchPaymentInfo();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _fetchPaymentInfo() async {
    try {
      final info = await ref
          .read(paymentServiceProvider)
          .getClientPaymentInfo(widget.clientId);
      if (!mounted) return;
      setState(() {
        _paymentInfo = info;
        _paymentInfoLoading = false;
        // Default to UPI if available, else NEFT
        _selectedMode = info.upiAvailable ? 'UPI' : 'NEFT';
        _showRefField = _selectedMode != 'UPI';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _paymentInfoLoading = false;
        _selectedMode = 'NEFT';
        _showRefField = true;
      });
    }
  }

  // ── UPI launch ─────────────────────────────────────────────────────────────

  Future<void> _launchUpiApp(UpiApp app) async {
    // 1. Validate amount first
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final upiId = _paymentInfo?.upiId ?? _paymentInfo?.phone ?? '';
    if (upiId.isEmpty) return;

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;

    UpiApp launchedApp = app;

    try {
      await UpiLauncher.launch(
        upiId: upiId,
        payeeName: widget.clientName,
        amount: amount,
        transactionNote: widget.invoiceNumber,
        app: app,
      );
    } on UpiAppNotFoundException {
      if (app != UpiApp.any) {
        // Fallback to generic UPI scheme
        try {
          await UpiLauncher.launch(
            upiId: upiId,
            payeeName: widget.clientName,
            amount: amount,
            transactionNote: widget.invoiceNumber,
            app: UpiApp.any,
          );
          launchedApp = UpiApp.any;
        } on UpiAppNotFoundException {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
              'No UPI app found. Please pay manually and enter details below.',
            ),
            backgroundColor: KTColors.warning,
          ));
          setState(() => _showRefField = true);
          return;
        }
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
            'No UPI app found. Please pay manually and enter details below.',
          ),
          backgroundColor: KTColors.warning,
        ));
        setState(() => _showRefField = true);
        return;
      }
    }

    // 3. User is back in the app — show confirmation dialog
    if (!mounted) return;
    final result = await _showUpiConfirmDialog(launchedApp);
    if (!mounted) return;

    if (result != null && result.confirmed) {
      setState(() {
        _confirmedUpiTxnId = result.txnId;
        _showRefField = true;
        if (result.txnId != null && result.txnId!.isNotEmpty) {
          _referenceController.text = result.txnId!;
        }
      });
      await _submitPayment();
    }
    // If cancelled — stay on sheet, do nothing
  }

  // ── UPI confirm dialog ─────────────────────────────────────────────────────

  Future<_UpiConfirmResult?> _showUpiConfirmDialog(UpiApp app) async {
    final txnController = TextEditingController();
    final appName = UpiLauncher.appDisplayName(app);

    final result = await showDialog<_UpiConfirmResult>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _ConfirmUpiPaymentDialog(
        appName: appName,
        txnController: txnController,
      ),
    );
    txnController.dispose();
    return result;
  }

  // ── Confirm dialog for non-UPI modes  ─────────────────────────────────────

  Future<void> _showConfirmDialog() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    final ref = _referenceController.text.trim();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: KTColors.darkSurface,
        title: const Text(
          'Confirm Payment',
          style: TextStyle(color: KTColors.darkTextPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _confirmRow('Amount', _currencyFormat.format(amount)),
            _confirmRow('Mode', _selectedMode),
            if (ref.isNotEmpty) _confirmRow('Reference', ref),
            _confirmRow(
              'Date',
              DateFormat('dd MMM yyyy').format(_paymentDate),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel',
                style: TextStyle(color: KTColors.darkTextSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.amber600,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _submitPayment();
    }
  }

  Widget _confirmRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(color: KTColors.darkTextSecondary)),
            Text(value,
                style: const TextStyle(color: KTColors.darkTextPrimary)),
          ],
        ),
      );

  // ── Submit payment ─────────────────────────────────────────────────────────

  Future<void> _submitPayment() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    final refNo = _referenceController.text.trim();

    final request = RecordPaymentRequest(
      invoiceId: widget.invoiceId,
      amountPaid: amount,
      paymentMode: _selectedMode,
      referenceNumber: refNo.isNotEmpty ? refNo : null,
      upiTxnId: _confirmedUpiTxnId,
      paymentDate: _paymentDate,
    );

    try {
      await ref.read(paymentServiceProvider).recordPayment(request);

      if (!mounted) return;
      // Close bottom sheet on success
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
          '${_currencyFormat.format(amount)} recorded for ${widget.invoiceNumber}',
        ),
        backgroundColor: KTColors.success,
      ));

      widget.onPaymentRecorded();
    } on PaymentValidationException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showErrorDialog(e.message);
    } on PaymentNetworkException {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showErrorDialog(
        'Network error. Payment was NOT recorded. Please try again.',
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showErrorDialog('An unexpected error occurred. Please try again.');
    }
  }

  void _showErrorDialog(String message) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: KTColors.darkSurface,
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: KTColors.danger, size: 20),
            SizedBox(width: 8),
            Text('Payment Error',
                style: TextStyle(
                    color: KTColors.danger, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(message,
            style: const TextStyle(color: KTColors.darkTextPrimary)),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPadding + 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: KTColors.darkBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // ── Section A — Invoice summary ──────────────────────────────
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: KTColors.darkElevated,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.clientName,
                      style: const TextStyle(
                        color: KTColors.darkTextPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.invoiceNumber,
                      style: const TextStyle(
                        color: KTColors.darkTextSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Outstanding',
                            style: TextStyle(
                                color: KTColors.darkTextSecondary,
                                fontSize: 12)),
                        Text(
                          _currencyFormat.format(widget.outstandingAmount),
                          style: const TextStyle(
                            color: KTColors.amber500,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Section B — Amount field ─────────────────────────────────
              TextFormField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                      RegExp(r'^\d+\.?\d{0,2}')),
                ],
                style: const TextStyle(color: KTColors.darkTextPrimary),
                decoration: InputDecoration(
                  labelText: 'Amount (₹)',
                  labelStyle:
                      const TextStyle(color: KTColors.darkTextSecondary),
                  prefixText: '₹ ',
                  prefixStyle:
                      const TextStyle(color: KTColors.darkTextSecondary),
                  filled: true,
                  fillColor: KTColors.darkElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
                validator: (v) {
                  final val = double.tryParse(v?.trim() ?? '');
                  if (val == null || val <= 0) {
                    return 'Enter an amount greater than ₹0';
                  }
                  if (val > widget.outstandingAmount + 0.01) {
                    return 'Cannot exceed outstanding '
                        '${_currencyFormat.format(widget.outstandingAmount)}';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // ── Section C — Payment mode chips ───────────────────────────
              const Text('Payment Mode',
                  style: TextStyle(
                      color: KTColors.darkTextSecondary, fontSize: 12)),
              const SizedBox(height: 8),
              _paymentInfoLoading
                  ? const SizedBox(
                      height: 40,
                      child: Center(
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: KTColors.amber500),
                        ),
                      ),
                    )
                  : Wrap(
                      spacing: 8,
                      children: ['UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CASH']
                          .map((mode) {
                        final isUpi = mode == 'UPI';
                        final upiDisabled =
                            isUpi && !(_paymentInfo?.upiAvailable ?? false);
                        final isSelected = _selectedMode == mode;
                        return Tooltip(
                          message: upiDisabled
                              ? 'No UPI ID on file for this client. '
                                  'Edit client profile to add.'
                              : '',
                          child: FilterChip(
                            label: Text(mode),
                            selected: isSelected,
                            onSelected: upiDisabled
                                ? null
                                : (v) {
                                    if (v) {
                                      setState(() {
                                        _selectedMode = mode;
                                        _showRefField = mode != 'UPI';
                                        if (mode != 'UPI') {
                                          _confirmedUpiTxnId = null;
                                        }
                                      });
                                    }
                                  },
                            selectedColor: KTColors.amber600,
                            backgroundColor: KTColors.darkElevated,
                            labelStyle: TextStyle(
                              color: upiDisabled
                                  ? KTColors.darkTextSecondary
                                  : isSelected
                                      ? Colors.white
                                      : KTColors.darkTextPrimary,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
              const SizedBox(height: 16),

              // ── Section D — UPI app picker ───────────────────────────────
              if (_selectedMode == 'UPI' &&
                  (_paymentInfo?.upiAvailable ?? false)) ...[
                const Text('Pay via',
                    style: TextStyle(
                        color: KTColors.darkTextSecondary, fontSize: 12)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: UpiApp.values.map((app) {
                    return _UpiAppButton(
                      app: app,
                      onTap: () => _launchUpiApp(app),
                      enabled: !_submitting,
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
              ],

              // ── Section E — Reference number ─────────────────────────────
              if (_showRefField || _selectedMode != 'UPI') ...[
                TextFormField(
                  controller: _referenceController,
                  style:
                      const TextStyle(color: KTColors.darkTextPrimary),
                  decoration: InputDecoration(
                    labelText: 'UTR / Transaction ID',
                    labelStyle: const TextStyle(
                        color: KTColors.darkTextSecondary),
                    hintText: _selectedMode == 'NEFT' ||
                            _selectedMode == 'RTGS'
                        ? 'Required for $_selectedMode'
                        : 'Optional',
                    hintStyle: const TextStyle(
                        color: KTColors.darkTextSecondary),
                    filled: true,
                    fillColor: KTColors.darkElevated,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  validator: (v) {
                    if ((_selectedMode == 'NEFT' ||
                            _selectedMode == 'RTGS') &&
                        (v == null || v.trim().isEmpty)) {
                      return '$_selectedMode requires a UTR reference number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
              ],

              // ── Section F — Date picker ───────────────────────────────────
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _paymentDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                    builder: (ctx, child) => Theme(
                      data: ThemeData.dark().copyWith(
                        colorScheme:
                            const ColorScheme.dark(primary: KTColors.amber500),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null && mounted) {
                    setState(() => _paymentDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: KTColors.darkElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          size: 18, color: KTColors.darkTextSecondary),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Payment Date',
                              style: TextStyle(
                                  color: KTColors.darkTextSecondary,
                                  fontSize: 11)),
                          Text(
                            DateFormat('dd MMM yyyy').format(_paymentDate),
                            style: const TextStyle(
                                color: KTColors.darkTextPrimary,
                                fontSize: 15),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ── Section G — Record Payment button ────────────────────────
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.amber600,
                    disabledBackgroundColor:
                        KTColors.amber600.withOpacity(0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _submitting
                      ? null
                      : () {
                          if (_selectedMode == 'UPI') {
                            // For UPI: user must use the app buttons above.
                            // This button acts as a fallback if they skip.
                            _showConfirmDialog();
                          } else {
                            _showConfirmDialog();
                          }
                        },
                  child: _submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'Record Payment',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPI App Button widget
// ─────────────────────────────────────────────────────────────────────────────

class _UpiAppButton extends StatelessWidget {
  final UpiApp app;
  final VoidCallback onTap;
  final bool enabled;

  const _UpiAppButton({
    required this.app,
    required this.onTap,
    required this.enabled,
  });

  IconData get _icon {
    switch (app) {
      case UpiApp.gpay:
        return Icons.g_mobiledata_rounded;
      case UpiApp.phonepe:
        return Icons.phone_android;
      case UpiApp.paytm:
        return Icons.account_balance_wallet;
      case UpiApp.bhim:
        return Icons.currency_rupee;
      case UpiApp.any:
        return Icons.more_horiz;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.4,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: KTColors.darkElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: KTColors.darkBorder),
              ),
              child: Icon(_icon, color: KTColors.amber500, size: 24),
            ),
            const SizedBox(height: 4),
            Text(
              UpiLauncher.appDisplayName(app),
              style: const TextStyle(
                  color: KTColors.darkTextSecondary, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPI confirm dialog result
// ─────────────────────────────────────────────────────────────────────────────

class _UpiConfirmResult {
  final bool confirmed;
  final String? txnId;
  const _UpiConfirmResult({required this.confirmed, this.txnId});
}

// ─────────────────────────────────────────────────────────────────────────────
// _ConfirmUpiPaymentDialog
// ─────────────────────────────────────────────────────────────────────────────

class _ConfirmUpiPaymentDialog extends StatelessWidget {
  final String appName;
  final TextEditingController txnController;

  const _ConfirmUpiPaymentDialog({
    required this.appName,
    required this.txnController,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: KTColors.darkSurface,
      title: Text(
        'Did you complete the payment?',
        style: const TextStyle(
            color: KTColors.darkTextPrimary, fontWeight: FontWeight.bold),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Please confirm only if the payment was successful in $appName.\n',
            style: const TextStyle(color: KTColors.darkTextSecondary),
          ),
          Text(
            'Enter the transaction ID shown in $appName\n(optional but recommended):',
            style: const TextStyle(
                color: KTColors.darkTextSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: txnController,
            style: const TextStyle(color: KTColors.darkTextPrimary),
            decoration: InputDecoration(
              hintText: 'e.g. T2603210001234',
              hintStyle: const TextStyle(color: KTColors.darkTextSecondary),
              filled: true,
              fillColor: KTColors.darkElevated,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(
            context,
            const _UpiConfirmResult(confirmed: false),
          ),
          child: const Text('No, Cancel',
              style: TextStyle(color: KTColors.darkTextSecondary)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.success),
          onPressed: () {
            final txn = txnController.text.trim();
            Navigator.pop(
              context,
              _UpiConfirmResult(
                confirmed: true,
                txnId: txn.isNotEmpty ? txn : null,
              ),
            );
          },
          child: const Text('Yes, I Paid'),
        ),
      ],
    );
  }
}
