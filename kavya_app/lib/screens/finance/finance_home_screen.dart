import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

final financeDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/finance-manager/dashboard/summary');
  if (res is Map<String, dynamic>) {
    final data = res['data'];
    if (data is Map<String, dynamic>) return data;
    return res;
  }
  return {};
});

class FinanceHomeScreen extends ConsumerWidget {
  const FinanceHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(financeDashboardProvider);
    final now = DateTime.now();
    final monthLabel =
        '${_monthName(now.month)} ${now.year}';

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: dashAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: KTColors.danger, size: 40),
              const SizedBox(height: 10),
              Text('Failed to load dashboard',
                  style: KTTextStyles.body.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none)),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.invalidate(financeDashboardProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (data) {
          final expenses = (data['expenses'] as Map<String, dynamic>?) ?? {};
          final salary = (data['salary'] as Map<String, dynamic>?) ?? {};
          final payables = (data['payables'] as Map<String, dynamic>?) ?? {};
          final razorpayPaise =
              _parseInt(data['razorpay_balance_paise']);

          final pendingCount = _parseInt(expenses['pending_count']);
          final pendingAmt =
              _parseDouble(expenses['pending_amount_paise']) / 100;

          final totalStaff = _parseInt(salary['total_staff']);
          final paidCount = _parseInt(salary['paid_count']);
          final salaryPaidAmt =
              _parseDouble(salary['paid_paise']) / 100;

          final overdueCount = _parseInt(payables['overdue_count']);
          final dueWeekCount =
              _parseInt(payables['due_this_week_count']);
          final dueWeekAmt =
              _parseDouble(payables['due_this_week_paise']) / 100;

          final razorpayAmt = razorpayPaise / 100;

          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(financeDashboardProvider),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Month header
                  Row(
                    children: [
                      Text(
                        'Finance Overview',
                        style: KTTextStyles.h3.copyWith(
                          color: KTColors.textHeading,
                          decoration: TextDecoration.none,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF7C3AED)
                              .withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          monthLabel,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF7C3AED),
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── KPI Grid ─────────────────────────────────────────
                  GridView.count(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.35,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _KpiCard(
                        label: 'Pending Expenses',
                        value: '$pendingCount submissions',
                        sub: _fmtAmt(pendingAmt),
                        icon: Icons.receipt_long_rounded,
                        color: KTColors.warning,
                      ),
                      _KpiCard(
                        label: 'Salary Paid',
                        value: '$paidCount / $totalStaff staff',
                        sub: _fmtAmt(salaryPaidAmt),
                        icon: Icons.people_rounded,
                        color: KTColors.success,
                      ),
                      _KpiCard(
                        label: 'Payables Due',
                        value: '$dueWeekCount this week',
                        sub: overdueCount > 0
                            ? '$overdueCount overdue'
                            : 'None overdue',
                        icon: Icons.calendar_today_rounded,
                        color: overdueCount > 0
                            ? KTColors.danger
                            : KTColors.info,
                      ),
                      _KpiCard(
                        label: 'Razorpay Balance',
                        value: _fmtAmt(razorpayAmt),
                        sub: 'Payout wallet',
                        icon: Icons.account_balance_rounded,
                        color: const Color(0xFF7C3AED),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── Due week amount ───────────────────────────────────
                  if (dueWeekAmt > 0) ...[
                    _SummaryRow(
                      icon: Icons.warning_amber_rounded,
                      color: KTColors.warning,
                      label: 'Due this week',
                      value: _fmtAmt(dueWeekAmt),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // ── Salary paid amount ────────────────────────────────
                  _SummaryRow(
                    icon: Icons.check_circle_outline_rounded,
                    color: KTColors.success,
                    label: 'Salary paid this month',
                    value: _fmtAmt(salaryPaidAmt),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  static int _parseInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is double) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static double _parseDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static String _fmtAmt(double amt) {
    if (amt >= 10000000) return '₹${(amt / 10000000).toStringAsFixed(1)}Cr';
    if (amt >= 100000) return '₹${(amt / 100000).toStringAsFixed(1)}L';
    if (amt >= 1000) return '₹${(amt / 1000).toStringAsFixed(1)}k';
    return '₹${amt.toStringAsFixed(0)}';
  }

  static String _monthName(int m) {
    const names = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return names[m];
  }
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            sub,
            style: const TextStyle(
              fontSize: 10,
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              color: KTColors.textMuted,
              fontWeight: FontWeight.w500,
              decoration: TextDecoration.none,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ─── Summary Row ───────────────────────────────────────────────────────────────
class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;

  const _SummaryRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: KTTextStyles.body.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              color: color,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.none,
            ),
          ),
        ],
      ),
    );
  }
}
