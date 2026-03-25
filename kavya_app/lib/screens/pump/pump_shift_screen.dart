import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ──────────────────────────────────────────────────────────────

/// Provider that fetches the currently active shift (if any).
final activeShiftProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  try {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/fuel-pump/shifts/active');
    final data = res['data'];
    if (data == null || data == '' || (data is Map && data.isEmpty)) return null;
    return data as Map<String, dynamic>;
  } catch (_) {
    return null; // No active shift
  }
});

/// Provider for tanks list when opening shift.
final shiftTanksProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/fuel-pump/tanks');
  final list = (res['data'] ?? res) as List? ?? [];
  return list.cast<Map<String, dynamic>>();
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class PumpShiftScreen extends ConsumerWidget {
  const PumpShiftScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftAsync = ref.watch(activeShiftProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        iconTheme: const IconThemeData(color: KTColors.textHeading),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: KTColors.textHeading),
          onPressed: () => context.pop(),
        ),
        title: const Text('Shift', style: TextStyle(color: KTColors.textHeading, fontWeight: FontWeight.w600, fontSize: 18)),
      ),
      body: shiftAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: KTColors.pumpAccent)),
        error: (_, __) => _OpenShiftView(onShiftStarted: () => ref.invalidate(activeShiftProvider)),
        data: (activeShift) {
          if (activeShift == null) {
            return _OpenShiftView(onShiftStarted: () => ref.invalidate(activeShiftProvider));
          }
          return _CloseShiftView(
            shift: activeShift,
            onShiftClosed: () {
              ref.invalidate(activeShiftProvider);
              context.pop();
            },
          );
        },
      ),
    );
  }
}

// ─── Open Shift View ─────────────────────────────────────────────────────────

class _OpenShiftView extends ConsumerStatefulWidget {
  final VoidCallback onShiftStarted;
  const _OpenShiftView({required this.onShiftStarted});

  @override
  ConsumerState<_OpenShiftView> createState() => _OpenShiftViewState();
}

class _OpenShiftViewState extends ConsumerState<_OpenShiftView> {
  String _shiftType = 'morning';
  final _notesCtrl = TextEditingController();
  // tank_id -> {dip, meter}
  final Map<int, TextEditingController> _dipCtrls = {};
  final Map<int, TextEditingController> _meterCtrls = {};
  bool _submitting = false;

  static const _shiftTypes = {
    'morning': 'Morning (6AM–2PM)',
    'afternoon': 'Afternoon (2PM–10PM)',
    'night': 'Night (10PM–6AM)',
  };

  @override
  void dispose() {
    _notesCtrl.dispose();
    for (final c in _dipCtrls.values) { c.dispose(); }
    for (final c in _meterCtrls.values) { c.dispose(); }
    super.dispose();
  }

  Future<void> _startShift(List<Map<String, dynamic>> tanks) async {
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final tankReadings = tanks.map((t) {
        final id = (t['id'] as num).toInt();
        return {
          'tank_id': id,
          'opening_dip': double.tryParse(_dipCtrls[id]?.text ?? '') ?? 0,
          'opening_meter': double.tryParse(_meterCtrls[id]?.text ?? '') ?? 0,
        };
      }).toList();

      await api.post('/fuel-pump/shifts', data: {
        'shift_type': _shiftType,
        'started_at': DateTime.now().toIso8601String(),
        'tank_readings': tankReadings,
        if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text,
      });

      if (mounted) {
        widget.onShiftStarted();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Shift started'), backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start shift: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tanksAsync = ref.watch(shiftTanksProvider);
    final now = DateTime.now();
    final dateStr =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title
          Text('Start Your Shift',
              style: KTTextStyles.h1.copyWith(color: KTColors.pumpAccent)),
          const SizedBox(height: 4),
          Text(dateStr, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 24),

          // Shift type selector
          Text('Shift Type', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: _shiftTypes.entries.map((e) {
                return RadioListTile<String>(
                  value: e.key,
                  groupValue: _shiftType,
                  onChanged: (v) => setState(() => _shiftType = v ?? _shiftType),
                  title: Text(e.value, style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                  activeColor: KTColors.pumpAccent,
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 24),

          // Tank readings
          tanksAsync.when(
            loading: () => Column(
              children: List.generate(
                2,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: KTLoadingShimmer(type: ShimmerType.card),
                ),
              ),
            ),
            error: (e, _) => Text('Failed to load tanks: $e',
                style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            data: (tanks) {
              // Initialize controllers
              for (final t in tanks) {
                final id = (t['id'] as num).toInt();
                _dipCtrls.putIfAbsent(id, () => TextEditingController());
                _meterCtrls.putIfAbsent(id, () => TextEditingController());
              }
              return Column(
                children: tanks.map((t) {
                  final id = (t['id'] as num).toInt();
                  final name = t['name']?.toString() ?? 'Tank #$id';
                  return _tankReadingCard(name, id);
                }).toList(),
              );
            },
          ),
          const SizedBox(height: 16),

          // Notes
          Text('Notes (optional)', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          TextFormField(
            controller: _notesCtrl,
            maxLines: 2,
            style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
            decoration: _inputDec('Any remarks for this shift…'),
          ),
          const SizedBox(height: 24),

          // Start shift button
          tanksAsync.maybeWhen(
            data: (tanks) => KTButton.primary(
              onPressed: _submitting ? null : () => _startShift(tanks),
              label: 'Start Shift',
              isLoading: _submitting,
            ),
            orElse: () => KTButton.primary(onPressed: null, label: 'Start Shift'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _tankReadingCard(String tankName, int tankId) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tankName, style: KTTextStyles.h3.copyWith(color: KTColors.pumpAccent)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Opening Dip (L)', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _dipCtrls[tankId],
                      keyboardType: TextInputType.number,
                      style: KTTextStyles.mono.copyWith(color: KTColors.textHeading),
                      decoration: _inputDec('0', suffix: 'L'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Opening Meter', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _meterCtrls[tankId],
                      keyboardType: TextInputType.number,
                      style: KTTextStyles.mono.copyWith(color: KTColors.textHeading),
                      decoration: _inputDec('0'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDec(String hint, {String? suffix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
      suffixText: suffix,
      suffixStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
      filled: true,
      fillColor: KTColors.lightBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.pumpAccent)),
    );
  }
}

// ─── Close Shift View ─────────────────────────────────────────────────────────

class _CloseShiftView extends ConsumerStatefulWidget {
  final Map<String, dynamic> shift;
  final VoidCallback onShiftClosed;
  const _CloseShiftView({required this.shift, required this.onShiftClosed});

  @override
  ConsumerState<_CloseShiftView> createState() => _CloseShiftViewState();
}

class _CloseShiftViewState extends ConsumerState<_CloseShiftView> {
  final Map<int, TextEditingController> _closeDipCtrls = {};
  final Map<int, TextEditingController> _closeMeterCtrls = {};
  bool _submitting = false;

  @override
  void dispose() {
    for (final c in _closeDipCtrls.values) { c.dispose(); }
    for (final c in _closeMeterCtrls.values) { c.dispose(); }
    super.dispose();
  }

  Future<void> _closeShift(List<Map<String, dynamic>> tanks) async {
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final shiftId = widget.shift['id'];
      final tankReadings = tanks.map((t) {
        final id = (t['id'] as num).toInt();
        return {
          'tank_id': id,
          'closing_dip': double.tryParse(_closeDipCtrls[id]?.text ?? '') ?? 0,
          'closing_meter': double.tryParse(_closeMeterCtrls[id]?.text ?? '') ?? 0,
        };
      }).toList();

      await api.post('/fuel-pump/shifts/$shiftId/close', data: {
        'tank_readings': tankReadings,
        'closed_at': DateTime.now().toIso8601String(),
      });

      if (mounted) {
        widget.onShiftClosed();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Shift closed successfully'), backgroundColor: KTColors.success),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        final statusCode = e.response?.statusCode;
        final detail = e.response?.data is Map
            ? e.response?.data['detail']?.toString()
            : null;
        // 404 means the shift no longer exists (server restarted) — treat as already closed
        if (statusCode == 404 || statusCode == 422) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Shift session expired. Returning to dashboard.'),
              backgroundColor: KTColors.warning,
            ),
          );
          widget.onShiftClosed(); // dismiss back to home
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(detail ?? 'Failed to close shift. Please try again.'),
              backgroundColor: KTColors.danger,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to close shift. Please try again.'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tanksAsync = ref.watch(shiftTanksProvider);
    final startedAt = widget.shift['started_at']?.toString() ?? '';
    final shiftType = widget.shift['shift_type']?.toString() ?? '—';
    final totalDispensed = widget.shift['total_dispensed_litres']?.toString() ?? '—';

    // Parse and display start time in local timezone
    String startDisplay = '—';
    if (startedAt.isNotEmpty) {
      try {
        final dt = DateTime.parse(startedAt).toLocal();
        startDisplay = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        startDisplay = '—';
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Shift info header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.success.withOpacity(0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.circle, color: KTColors.success, size: 10),
                    const SizedBox(width: 8),
                    Text('Shift Active', style: KTTextStyles.label.copyWith(color: KTColors.success)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _shiftInfoItem('Started At', startDisplay),
                    ),
                    Expanded(
                      child: _shiftInfoItem('Type', shiftType.toUpperCase()),
                    ),
                    Expanded(
                      child: _shiftInfoItem('Dispensed', '${totalDispensed}L'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Text('Close Shift', style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
          const SizedBox(height: 4),
          Text('Enter closing readings for each tank.',
              style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 16),

          // Tank close readings
          tanksAsync.when(
            loading: () => KTLoadingShimmer(type: ShimmerType.card),
            error: (e, _) => Text('Failed to load tanks', style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            data: (tanks) {
              for (final t in tanks) {
                final id = (t['id'] as num).toInt();
                _closeDipCtrls.putIfAbsent(id, () => TextEditingController());
                _closeMeterCtrls.putIfAbsent(id, () => TextEditingController());
              }
              return Column(children: tanks.map((t) {
                final id = (t['id'] as num).toInt();
                final name = t['name']?.toString() ?? 'Tank #$id';
                final expectedRemainingStr = t['current_stock_litres']?.toString() ?? '—';
                return _closeTankCard(name, id, expectedRemainingStr);
              }).toList());
            },
          ),
          const SizedBox(height: 24),

          // Close button
          tanksAsync.maybeWhen(
            data: (tanks) => KTButton.danger(
              onPressed: _submitting ? null : () => _closeShift(tanks),
              label: 'Close Shift',
              isLoading: _submitting,
            ),
            orElse: () => KTButton.danger(onPressed: null, label: 'Close Shift'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _shiftInfoItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
        Text(value, style: KTTextStyles.label.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _closeTankCard(String tankName, int tankId, String expectedRemainingLitres) {
    final openingDip = _closeDipCtrls[tankId]?.text ?? '';
    final closingDip = double.tryParse(openingDip) ?? 0;
    final expectedLitres = double.tryParse(expectedRemainingLitres) ?? 0;
    final variance = closingDip > 0 ? (closingDip - expectedLitres) : 0.0;
    final hasVariance = closingDip > 0 && variance.abs() > 5;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasVariance ? KTColors.warning.withOpacity(0.6) : KTColors.borderColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tankName, style: KTTextStyles.h3.copyWith(color: KTColors.pumpAccent)),
          const SizedBox(height: 4),
          Text('Expected remaining: ${expectedRemainingLitres}L',
              style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Closing Dip (L)', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _closeDipCtrls[tankId],
                      keyboardType: TextInputType.number,
                      style: KTTextStyles.mono.copyWith(color: KTColors.textHeading),
                      onChanged: (_) => setState(() {}),
                      decoration: _inputDec('0', suffix: 'L'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Closing Meter', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _closeMeterCtrls[tankId],
                      keyboardType: TextInputType.number,
                      style: KTTextStyles.mono.copyWith(color: KTColors.textHeading),
                      decoration: _inputDec('0'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (hasVariance) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: KTColors.warning.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: KTColors.warning.withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: KTColors.warning, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    'Variance detected: ${variance.toStringAsFixed(1)}L',
                    style: KTTextStyles.label.copyWith(color: KTColors.warning),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  InputDecoration _inputDec(String hint, {String? suffix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
      suffixText: suffix,
      suffixStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
      filled: true,
      fillColor: KTColors.lightBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.borderColor)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: KTColors.pumpAccent)),
    );
  }
}
