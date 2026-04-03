import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

Future<void> showSalaryAdvanceSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _SalaryAdvanceSheet(ref: ref),
  );
}

class _SalaryAdvanceSheet extends StatefulWidget {
  final WidgetRef ref;
  const _SalaryAdvanceSheet({required this.ref});

  @override
  State<_SalaryAdvanceSheet> createState() => _SalaryAdvanceSheetState();
}

class _SalaryAdvanceSheetState extends State<_SalaryAdvanceSheet> {
  final _amountCtrl = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  static const int _maxAmount = 20000;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final raw = int.tryParse(_amountCtrl.text.trim());
    if (raw == null || raw <= 0) {
      setState(() => _error = 'Please enter a valid amount.');
      return;
    }
    if (raw > _maxAmount) {
      setState(() => _error = 'Maximum salary advance is ₹$_maxAmount.');
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      final api = widget.ref.read(apiServiceProvider);
      final resp = await api.post(
        '/driver-requests/salary-advance',
        data: {'amount': raw},
      );
      if (resp['success'] == true) {
        if (mounted) setState(() => _submitted = true);
      } else {
        setState(() => _error = resp['message'] ?? 'Request failed.');
      }
    } catch (e) {
      setState(() => _error = 'Failed to submit request. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      child: _submitted ? _buildSuccess() : _buildForm(),
    );
  }

  Widget _buildForm() {
    final canSubmit = _amountCtrl.text.trim().isNotEmpty && !_submitting;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Handle bar
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
        const SizedBox(height: 20),

        // Header
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: KTColors.driverAccentBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.payments_rounded,
                  color: KTColors.driverAccent, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Salary Advance Request',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                          color: KTColors.textHeading)),
                  const Text('Notify fleet manager',
                      style: TextStyle(
                          fontSize: 13, color: KTColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Amount input
        const Text('Request Amount',
            style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: KTColors.textBody)),
        const SizedBox(height: 8),
        TextField(
          controller: _amountCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            _MaxValueFormatter(_maxAmount),
          ],
          decoration: InputDecoration(
            prefixText: '₹ ',
            hintText: '0',
            hintStyle:
                const TextStyle(color: KTColors.textMuted, fontSize: 18),
            prefixStyle: const TextStyle(
                color: KTColors.textHeading,
                fontSize: 18,
                fontWeight: FontWeight.w700),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: KTColors.borderColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: KTColors.driverAccent, width: 2),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            errorText: _error,
          ),
          style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: KTColors.textHeading),
          onChanged: (_) => setState(() => _error = null),
        ),
        const SizedBox(height: 8),

        // Max label
        Row(
          children: [
            const Icon(Icons.info_outline_rounded,
                size: 13, color: KTColors.textMuted),
            const SizedBox(width: 4),
            Text('Maximum ₹$_maxAmount per request',
                style: const TextStyle(
                    fontSize: 12, color: KTColors.textMuted)),
          ],
        ),
        const SizedBox(height: 20),

        // Amount quick-select chips
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [2000, 5000, 10000, 15000, 20000].map((amt) {
            final selected =
                _amountCtrl.text.trim() == amt.toString();
            return GestureDetector(
              onTap: () {
                _amountCtrl.text = amt.toString();
                setState(() => _error = null);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: selected
                      ? KTColors.driverAccent
                      : KTColors.driverAccentBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected
                        ? KTColors.driverAccent
                        : KTColors.borderColor,
                  ),
                ),
                child: Text('₹$amt',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected
                            ? Colors.white
                            : KTColors.driverAccent)),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 24),

        // Notification preview
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: KTColors.lightBg,
            borderRadius: BorderRadius.circular(10),
            border:
                Border.all(color: KTColors.borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.notifications_outlined,
                  size: 16, color: KTColors.textMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Fleet manager will be notified: "[Your name] has requested for salary advance of amount ₹${_amountCtrl.text.isEmpty ? '—' : _amountCtrl.text}"',
                  style: const TextStyle(
                      fontSize: 12,
                      color: KTColors.textMuted,
                      fontStyle: FontStyle.italic),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Submit button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: canSubmit ? _submit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.driverAccent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Send Request',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 16)),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: KTColors.successBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded,
                color: KTColors.success, size: 36),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Request Sent!',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 20,
                color: KTColors.textHeading)),
        const SizedBox(height: 8),
        Text(
          'Your salary advance request of ₹${_amountCtrl.text} has been sent to the fleet manager.',
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 14, color: KTColors.textMuted, height: 1.5),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.success,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Done',
                style: TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 16)),
          ),
        ),
      ],
    );
  }
}

/// Prevents entering a value greater than [max].
class _MaxValueFormatter extends TextInputFormatter {
  final int max;
  const _MaxValueFormatter(this.max);

  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;
    final val = int.tryParse(newValue.text);
    if (val == null || val > max) return oldValue;
    return newValue;
  }
}
