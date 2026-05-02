import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

class PATripSheetScreen extends ConsumerStatefulWidget {
  final int jobId;
  const PATripSheetScreen({super.key, required this.jobId});

  @override
  ConsumerState<PATripSheetScreen> createState() => _PATripSheetScreenState();
}

class _PATripSheetScreenState extends ConsumerState<PATripSheetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _vehicleCtrl = TextEditingController();
  final _driverCtrl = TextEditingController();
  final _startOdometerCtrl = TextEditingController();
  final _advanceCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();

  DateTime? _scheduledDeparture;
  bool _isSubmitting = false;

  @override
  void dispose() {
    for (final c in [_vehicleCtrl, _driverCtrl, _startOdometerCtrl, _advanceCtrl, _remarksCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: KTColors.paAccent),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: KTColors.paAccent),
        ),
        child: child!,
      ),
    );
    if (time == null) return;

    setState(() {
      _scheduledDeparture = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_scheduledDeparture == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please set scheduled departure'), backgroundColor: KTColors.warning),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final payload = {
        'job_id': widget.jobId,
        'vehicle_reg_number': _vehicleCtrl.text.trim(),
        'driver_name': _driverCtrl.text.trim(),
        'start_odometer_km': double.tryParse(_startOdometerCtrl.text) ?? 0,
        'driver_advance': double.tryParse(_advanceCtrl.text) ?? 0,
        'scheduled_departure': _scheduledDeparture!.toIso8601String(),
        'remarks': _remarksCtrl.text.trim(),
      };

      final response = await api.post('/trips', data: payload);
      final tripId = response['data']?['id'] ?? response['id'];

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Trip sheet created'), backgroundColor: KTColors.success),
        );
        // Navigate to documents upload for this trip
        if (tripId != null) {
          context.pushReplacement('/pa/trips/$tripId/docs');
        } else {
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final depLabel = _scheduledDeparture != null
        ? '${_scheduledDeparture!.year}-${_pad(_scheduledDeparture!.month)}-${_pad(_scheduledDeparture!.day)} '
            '${_pad(_scheduledDeparture!.hour)}:${_pad(_scheduledDeparture!.minute)}'
        : 'Tap to select';

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('Trip Sheet', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        leading: const BackButton(color: KTColors.textHeading),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _field('Vehicle Reg Number', _vehicleCtrl, hint: 'TN01AB1234'),
              _field('Driver Name', _driverCtrl, hint: 'Full name'),
              _field('Start Odometer (km)', _startOdometerCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true)),
              _field('Driver Advance (₹)', _advanceCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true), required: false),

              // Departure datetime picker
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GestureDetector(
                  onTap: _pickDateTime,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: KTColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: KTColors.borderColor),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Scheduled Departure',
                              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                          const SizedBox(height: 4),
                          Text(depLabel,
                              style: KTTextStyles.body.copyWith(
                                color: _scheduledDeparture != null
                                    ? KTColors.textHeading
                                    : KTColors.textMuted,
                              )),
                        ]),
                        const Icon(Icons.calendar_today, color: KTColors.paAccent, size: 20),
                      ],
                    ),
                  ),
                ),
              ),

              _field('Remarks (optional)', _remarksCtrl, required: false, maxLines: 2),
              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.paAccent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Create Trip Sheet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController ctrl, {
    String? hint,
    TextInputType keyboardType = TextInputType.text,
    bool required = true,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboardType,
        maxLines: maxLines,
        style: const TextStyle(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 12),
          labelStyle: const TextStyle(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
        ),
        validator: required ? (v) => (v == null || v.trim().isEmpty) ? '$label is required' : null : null,
      ),
    );
  }

  String _pad(int n) => n.toString().padLeft(2, '0');
}
