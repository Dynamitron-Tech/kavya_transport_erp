import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../models/trip.dart';
import '../../providers/driver_requests_provider.dart';
import '../../providers/fleet_dashboard_provider.dart';

/// Shows a bottom sheet for requesting a ₹1500 advance.
/// Pass [activeTrip] if the driver has an ongoing trip.
Future<void> showRequestAdvanceSheet(
  BuildContext context,
  WidgetRef ref, {
  Trip? activeTrip,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RequestAdvanceSheet(activeTrip: activeTrip, ref: ref),
  );
}

class _RequestAdvanceSheet extends StatefulWidget {
  final Trip? activeTrip;
  final WidgetRef ref;
  const _RequestAdvanceSheet({required this.activeTrip, required this.ref});

  @override
  State<_RequestAdvanceSheet> createState() => _RequestAdvanceSheetState();
}

class _RequestAdvanceSheetState extends State<_RequestAdvanceSheet> {
  bool _submitting = false;
  bool _submitted = false;

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final api = widget.ref.read(apiServiceProvider);
      final body = <String, dynamic>{};
      if (widget.activeTrip != null) body['trip_id'] = widget.activeTrip!.id;

      final resp =
          await api.post('/driver-requests/advance-requests', data: body);
      if (resp['success'] == true) {
        widget.ref.invalidate(myAdvanceRequestsProvider);
        if (mounted) setState(() => _submitted = true);
      } else {
        _showSnack(resp['message'] ?? 'Request failed.', isError: true);
      }
    } catch (_) {
      _showSnack('Failed to submit request. Please try again.', isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? KTColors.danger : KTColors.success,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: _submitted ? _buildSuccess() : _buildForm(),
    );
  }

  Widget _buildForm() {
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
        Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: KTColors.driverAccentBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.account_balance_wallet_rounded,
                  color: KTColors.driverAccent, size: 22),
            ),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Request Advance',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: KTColors.textHeading)),
                SizedBox(height: 2),
                Text('Instant advance payment for your trip',
                    style: TextStyle(
                        fontSize: 13, color: KTColors.textMuted)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Amount tile
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: KTColors.lightBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Row(
            children: [
              const Icon(Icons.currency_rupee_rounded,
                  color: KTColors.driverAccent, size: 20),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Advance Amount',
                        style:
                            TextStyle(fontSize: 12, color: KTColors.textMuted)),
                    SizedBox(height: 2),
                    Text('₹ 1,500',
                        style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: KTColors.textHeading)),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.successBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Fixed',
                    style: TextStyle(
                        color: KTColors.success,
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Trip tile (if active trip)
        if (widget.activeTrip != null) ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: KTColors.lightBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_shipping_rounded,
                    color: KTColors.driverAccent, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('For Trip',
                          style: TextStyle(
                              fontSize: 11, color: KTColors.textMuted)),
                      const SizedBox(height: 2),
                      Text(
                          '${widget.activeTrip!.tripNumber}  ·  ${widget.activeTrip!.origin} → ${widget.activeTrip!.destination}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: KTColors.textHeading)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Note
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: KTColors.warningBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: const [
              Icon(Icons.info_outline_rounded,
                  size: 16, color: KTColors.warning),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'The Fleet Manager will be notified and will process your request.',
                  style: TextStyle(
                      fontSize: 12, color: KTColors.warning, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Buttons
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  side: const BorderSide(color: KTColors.borderColor),
                ),
                child: const Text('Cancel',
                    style: TextStyle(color: KTColors.textMuted)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.driverAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Request ₹1,500 Advance',
                        style: TextStyle(
                            fontWeight: FontWeight.w700)),
              ),
            ),
          ],
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
            decoration: const BoxDecoration(
              color: KTColors.successBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded,
                color: KTColors.success, size: 40),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Request Sent!',
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: KTColors.textHeading)),
        const SizedBox(height: 8),
        const Text(
          'Your ₹1,500 advance request has been sent to the Fleet Manager.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: KTColors.textMuted, height: 1.5),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.driverAccent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Done',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}
