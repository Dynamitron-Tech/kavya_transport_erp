import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

final _tripForClosureProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/trips/$tripId');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

class PATripClosureScreen extends ConsumerStatefulWidget {
  final int tripId;
  const PATripClosureScreen({super.key, required this.tripId});

  @override
  ConsumerState<PATripClosureScreen> createState() => _PATripClosureScreenState();
}

class _PATripClosureScreenState extends ConsumerState<PATripClosureScreen> {
  // 4-step checklist
  bool _podUploaded = false;
  bool _expensesLogged = false;
  bool _advanceReconciled = false;
  bool _endOdometerSet = false;

  final _endOdometerCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  bool _isClosing = false;

  @override
  void dispose() {
    _endOdometerCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  bool get _allChecked =>
      _podUploaded && _expensesLogged && _advanceReconciled && _endOdometerSet;

  Future<void> _closeTrip(Map<String, dynamic> trip) async {
    if (!_allChecked) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KTColors.darkSurface,
        title: Text('Close Trip', style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
        content: Text(
          'This will mark the trip as completed '
          'and generate an invoice. Proceed?',
          style: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: KTColors.darkTextSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Close Trip', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isClosing = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.put('/trips/${widget.tripId}/close', data: {
        'end_odometer_km': double.tryParse(_endOdometerCtrl.text) ?? 0,
        'remarks': _remarksCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Trip closed successfully — invoice queued'),
            backgroundColor: KTColors.success,
          ),
        );
        context.go('/pa/jobs');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(_tripForClosureProvider(widget.tripId));

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        title: Text('Close Trip', style: KTTextStyles.h2.copyWith(color: KTColors.darkTextPrimary)),
        leading: const BackButton(color: KTColors.darkTextPrimary),
      ),
      body: tripAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.card),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_tripForClosureProvider(widget.tripId)),
        ),
        data: (trip) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Trip summary ─────────────────────────────────────────
              _TripSummaryCard(trip: trip),
              const SizedBox(height: 16),

              // ── Checklist ────────────────────────────────────────────
              Text('Closure Checklist',
                  style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
              const SizedBox(height: 8),
              _CheckItem(
                label: 'POD / Delivery receipt uploaded',
                checked: _podUploaded,
                onChanged: (v) => setState(() => _podUploaded = v),
              ),
              _CheckItem(
                label: 'All trip expenses logged',
                checked: _expensesLogged,
                onChanged: (v) => setState(() => _expensesLogged = v),
              ),
              _CheckItem(
                label: 'Driver advance reconciled',
                checked: _advanceReconciled,
                onChanged: (v) => setState(() => _advanceReconciled = v),
              ),
              _CheckItem(
                label: 'End odometer recorded (below)',
                checked: _endOdometerSet,
                onChanged: (v) => setState(() => _endOdometerSet = v),
              ),
              const SizedBox(height: 16),

              // ── End odometer ─────────────────────────────────────────
              _inputField('End Odometer (km)', _endOdometerCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true)),
              _inputField('Closing Remarks (optional)', _remarksCtrl,
                  maxLines: 2, required: false),
              const SizedBox(height: 16),

              // ── P&L Summary card ─────────────────────────────────────
              _PLCard(trip: trip, endOdomCtrl: _endOdometerCtrl),
              const SizedBox(height: 24),

              // ── Close Trip button ────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _allChecked ? KTColors.danger : KTColors.darkBorder,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: (_allChecked && !_isClosing) ? () => _closeTrip(trip) : null,
                  child: _isClosing
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          _allChecked ? 'Close Trip' : 'Complete checklist to close',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _inputField(
    String label,
    TextEditingController ctrl, {
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
    bool required = true,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          controller: ctrl,
          keyboardType: keyboardType,
          maxLines: maxLines,
          style: const TextStyle(color: KTColors.darkTextPrimary),
          decoration: InputDecoration(
            labelText: label,
            labelStyle: const TextStyle(color: KTColors.darkTextSecondary),
            filled: true,
            fillColor: KTColors.darkSurface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: KTColors.darkBorder),
            ),
          ),
        ),
      );
}

class _CheckItem extends StatelessWidget {
  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;

  const _CheckItem({required this.label, required this.checked, required this.onChanged});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: checked ? KTColors.success : KTColors.darkBorder,
          ),
        ),
        child: CheckboxListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 14),
          title: Text(label,
              style: KTTextStyles.body.copyWith(
                color: checked ? KTColors.success : KTColors.darkTextPrimary,
              )),
          value: checked,
          activeColor: KTColors.success,
          checkColor: Colors.white,
          onChanged: (v) => onChanged(v ?? false),
        ),
      );
}

class _TripSummaryCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripSummaryCard({required this.trip});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.darkBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Trip Summary',
                style: KTTextStyles.h3.copyWith(color: KTColors.darkTextPrimary)),
            const SizedBox(height: 8),
            _R('Vehicle', trip['vehicle_reg_number'] ?? '—'),
            _R('Driver', trip['driver_name'] ?? '—'),
            _R('Route', '${trip['origin'] ?? ''} → ${trip['destination'] ?? ''}'),
            _R('Freight', '₹${trip['freight_amount'] ?? '—'}'),
          ],
        ),
      );
}

class _PLCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final TextEditingController endOdomCtrl;
  const _PLCard({required this.trip, required this.endOdomCtrl});

  @override
  Widget build(BuildContext context) {
    final freight = (trip['freight_amount'] as num?)?.toDouble() ?? 0;
    final advance = (trip['driver_advance'] as num?)?.toDouble() ?? 0;
    final expenses = (trip['total_expenses'] as num?)?.toDouble() ?? 0;
    final net = freight - advance - expenses;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.primary.withOpacity(0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profit & Loss (Estimate)',
              style: KTTextStyles.h3.copyWith(color: KTColors.primary)),
          const SizedBox(height: 8),
          _R('Freight', '₹${freight.toStringAsFixed(0)}'),
          _R('Driver Advance', '- ₹${advance.toStringAsFixed(0)}'),
          _R('Trip Expenses', '- ₹${expenses.toStringAsFixed(0)}'),
          const Divider(color: KTColors.darkBorder, height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Net', style: KTTextStyles.body.copyWith(color: KTColors.darkTextPrimary, fontWeight: FontWeight.bold)),
              Text(
                '₹${net.toStringAsFixed(0)}',
                style: KTTextStyles.body.copyWith(
                  color: net >= 0 ? KTColors.success : KTColors.danger,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _R extends StatelessWidget {
  final String label;
  final String value;
  const _R(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.darkTextSecondary)),
            Text(value, style: KTTextStyles.bodySmall.copyWith(color: KTColors.darkTextPrimary)),
          ],
        ),
      );
}
