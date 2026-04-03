import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/driver_requests_provider.dart';
import '../../providers/fleet_dashboard_provider.dart';

class DriverApplyLeaveScreen extends ConsumerStatefulWidget {
  const DriverApplyLeaveScreen({super.key});

  @override
  ConsumerState<DriverApplyLeaveScreen> createState() =>
      _DriverApplyLeaveScreenState();
}

class _DriverApplyLeaveScreenState
    extends ConsumerState<DriverApplyLeaveScreen> {
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  // Count working days (Mon-Fri) between today and start date
  int _workingDaysUntil(DateTime start) {
    final today = DateTime.now();
    int count = 0;
    DateTime cursor =
        DateTime(today.year, today.month, today.day).add(const Duration(days: 1));
    final limit = DateTime(start.year, start.month, start.day);
    while (cursor.isBefore(limit) || cursor.isAtSameMomentAs(limit)) {
      if (cursor.weekday <= 5) count++;
      cursor = cursor.add(const Duration(days: 1));
    }
    return count;
  }

  /// Returns the earliest calendar date that has at least [required] working
  /// days between today and that date (exclusive of today, inclusive of date).
  DateTime _earliestAllowedStart({int required = 5}) {
    final today = DateTime(
        DateTime.now().year, DateTime.now().month, DateTime.now().day);
    int workingCount = 0;
    DateTime cursor = today.add(const Duration(days: 1));
    while (workingCount < required) {
      if (cursor.weekday <= 5) workingCount++;
      if (workingCount < required) cursor = cursor.add(const Duration(days: 1));
    }
    return cursor;
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final minStart = _earliestAllowedStart();
    final earliest = isStart
        ? minStart
        : (_startDate ?? minStart);
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart
          ? minStart
          : (_startDate != null
              ? (_startDate!.isAfter(earliest) ? _startDate! : earliest)
              : earliest),
      firstDate: earliest,
      lastDate: DateTime(now.year + 2),
      selectableDayPredicate: isStart
          ? (day) => _workingDaysUntil(day) >= 5
          : null,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: KTColors.driverAccent,
            onPrimary: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate != null && _endDate!.isBefore(picked)) _endDate = null;
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (_startDate == null || _endDate == null) {
      _showSnack('Please select start and end dates.', isError: true);
      return;
    }
    final workingDays = _workingDaysUntil(_startDate!);
    if (workingDays < 5) {
      _showSnack(
          'Leave must be applied at least 5 working days in advance ($workingDays day(s) remaining).',
          isError: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final resp = await api.post('/driver-requests/leaves', data: {
        'start_date': '${_startDate!.year}-${_startDate!.month.toString().padLeft(2, '0')}-${_startDate!.day.toString().padLeft(2, '0')}',
        'end_date': '${_endDate!.year}-${_endDate!.month.toString().padLeft(2, '0')}-${_endDate!.day.toString().padLeft(2, '0')}',
        if (_reasonCtrl.text.trim().isNotEmpty) 'reason': _reasonCtrl.text.trim(),
      });
      if (resp['success'] == true) {
        ref.invalidate(myLeavesProvider);
        if (mounted) {
          _showSnack('Leave application submitted successfully!');
          Navigator.pop(context);
        }
      } else {
        _showSnack(resp['message'] ?? 'Submission failed.', isError: true);
      }
    } catch (e) {
      final msg = e.toString().contains('working day')
          ? 'Must be at least 5 working days in advance.'
          : 'Failed to submit leave. Please try again.';
      _showSnack(msg, isError: true);
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

  String _fmt(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')} / ${d.month.toString().padLeft(2, '0')} / ${d.year}';

  @override
  Widget build(BuildContext context) {
    final workingDaysOk =
        _startDate == null || _workingDaysUntil(_startDate!) >= 5;
    final canSubmit = _startDate != null && _endDate != null && workingDaysOk;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        title: const Text('Apply Leave',
            style: TextStyle(color: KTColors.textHeading)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Info banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: KTColors.driverAccentBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: KTColors.driverAccent.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: KTColors.driverAccent, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Leave must be applied at least 5 working days before the start date.',
                      style: TextStyle(
                          fontSize: 13,
                          color: KTColors.driverAccent,
                          height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Date pickers
            _sectionLabel('Leave Period'),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _DateTile(
                    label: 'Start Date',
                    value: _startDate != null ? _fmt(_startDate!) : null,
                    onTap: () => _pickDate(isStart: true),
                    hasError:
                        _startDate != null && !workingDaysOk,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _DateTile(
                    label: 'End Date',
                    value: _endDate != null ? _fmt(_endDate!) : null,
                    onTap: _startDate != null
                        ? () => _pickDate(isStart: false)
                        : null,
                  ),
                ),
              ],
            ),
            if (_startDate != null && !workingDaysOk) ...[
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Text(
                  'Only ${_workingDaysUntil(_startDate!)} working day(s) — needs 5',
                  style: const TextStyle(
                      color: KTColors.danger, fontSize: 12),
                ),
              ),
            ],
            const SizedBox(height: 20),

            // Duration chip
            if (_startDate != null && _endDate != null) ...[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: KTColors.successBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: KTColors.success.withValues(alpha: 0.5)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.calendar_month_rounded,
                        size: 16, color: KTColors.success),
                    const SizedBox(width: 8),
                    Text(
                      '${_endDate!.difference(_startDate!).inDays + 1} day(s) leave',
                      style: const TextStyle(
                          color: KTColors.success,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Reason
            _sectionLabel('Reason (optional)'),
            const SizedBox(height: 10),
            TextField(
              controller: _reasonCtrl,
              maxLines: 3,
              maxLength: 300,
              decoration: InputDecoration(
                hintText: 'e.g. Medical appointment, personal work...',
                hintStyle: const TextStyle(
                    color: KTColors.textMuted, fontSize: 14),
                filled: true,
                fillColor: KTColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: KTColors.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: KTColors.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                      color: KTColors.driverAccent, width: 1.5),
                ),
                counterStyle: const TextStyle(
                    color: KTColors.textMuted, fontSize: 11),
              ),
            ),
            const SizedBox(height: 28),

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
                    : const Text('Submit Leave Application',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 16),

            // History section
            _MyLeaveHistory(),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(
        text,
        style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: KTColors.textHeading),
      );
}

// ── Date picker tile ──────────────────────────────────────────────────────────

class _DateTile extends StatelessWidget {
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final bool hasError;

  const _DateTile({
    required this.label,
    this.value,
    this.onTap,
    this.hasError = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: hasError
                ? KTColors.danger
                : (value != null
                    ? KTColors.driverAccent.withValues(alpha: 0.5)
                    : KTColors.borderColor),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 11,
                    color: KTColors.textMuted,
                    fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.calendar_today_rounded,
                    size: 14,
                    color: onTap != null
                        ? KTColors.driverAccent
                        : KTColors.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    value ?? 'Select',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: value != null
                            ? KTColors.textHeading
                            : KTColors.textMuted),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── My Leave History panel ────────────────────────────────────────────────────

class _MyLeaveHistory extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leavesAsync = ref.watch(myLeavesProvider);
    return leavesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (leaves) {
        if (leaves.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Divider(height: 32),
            const Text('My Leave History',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading)),
            const SizedBox(height: 12),
            ...leaves.map((l) => _LeaveHistoryCard(leave: l)),
          ],
        );
      },
    );
  }
}

class _LeaveHistoryCard extends StatelessWidget {
  final dynamic leave; // DriverLeave

  const _LeaveHistoryCard({required this.leave});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (leave.status) {
      'APPROVED' => KTColors.success,
      'REJECTED' => KTColors.danger,
      _ => KTColors.warning,
    };
    final statusBg = switch (leave.status) {
      'APPROVED' => KTColors.successBg,
      'REJECTED' => KTColors.dangerBg,
      _ => KTColors.warningBg,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${leave.startDate} → ${leave.endDate}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: KTColors.textHeading)),
                if (leave.reason != null && leave.reason!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(leave.reason!,
                      style: const TextStyle(
                          fontSize: 12, color: KTColors.textMuted)),
                ],
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusBg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(leave.status,
                style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
