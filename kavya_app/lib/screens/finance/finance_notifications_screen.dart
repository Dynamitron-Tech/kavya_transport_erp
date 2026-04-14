import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ─────────────────────────────────────────────────────────────────

final _pendingAdvanceTripsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/finance-manager/pending-advance-trips?limit=50');
  final data = (res is Map) ? res['data'] : res;
  if (data is List) {
    return data.cast<Map<String, dynamic>>();
  }
  return [];
});

final _pendingExpensesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/finance-manager/expense-queue?status=pending&limit=50');
  final data = (res is Map) ? res['data'] : res;
  if (data is List) {
    return data.cast<Map<String, dynamic>>();
  }
  return [];
});

final _pendingDriverAdvanceRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/finance-manager/driver-advance-requests?status=PENDING&limit=50');
  final data = (res is Map) ? res['data'] : res;
  if (data is List) {
    return data.cast<Map<String, dynamic>>();
  }
  return [];
});

/// Badge count exposed so the shell can show a red dot.
final financeNotificationCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final advances = await ref.watch(_pendingAdvanceTripsProvider.future);
  final requests = await ref.watch(_pendingDriverAdvanceRequestsProvider.future);
  final expenses = await ref.watch(_pendingExpensesProvider.future);
  return advances.length + requests.length + expenses.length;
});

// ─── Screen ────────────────────────────────────────────────────────────────────

class FinanceNotificationsScreen extends ConsumerWidget {
  const FinanceNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final advancesAsync = ref.watch(_pendingAdvanceTripsProvider);
    final advanceRequestsAsync = ref.watch(_pendingDriverAdvanceRequestsProvider);
    final expensesAsync = ref.watch(_pendingExpensesProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(color: KTColors.textHeading),
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 17,
            color: KTColors.textHeading,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded, color: KTColors.textHeading),
            onPressed: () {
              ref.invalidate(_pendingAdvanceTripsProvider);
              ref.invalidate(_pendingDriverAdvanceRequestsProvider);
              ref.invalidate(_pendingExpensesProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_pendingAdvanceTripsProvider);
          ref.invalidate(_pendingDriverAdvanceRequestsProvider);
          ref.invalidate(_pendingExpensesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            // ── Driver Advance Requests (from app) ───────────────────────
            _SectionHeader(
              icon: Icons.account_balance_wallet_rounded,
              label: 'Pending Driver Advances',
              color: const Color(0xFF2563EB),
              asyncValue: advanceRequestsAsync,
            ),
            const SizedBox(height: 8),
            advanceRequestsAsync.when(
              loading: () => const _LoadingShimmer(count: 2),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (requests) {
                if (requests.isEmpty) {
                  return const _EmptyTile(message: 'No pending advance requests.');
                }
                return Column(
                  children: requests
                      .map((r) => _AdvanceRequestCard(request: r))
                      .toList(),
                );
              },
            ),

            const SizedBox(height: 24),

            // ── Trips with Loading Photo Uploaded ────────────────────────
            _SectionHeader(
              icon: Icons.currency_rupee_rounded,
              label: 'Loading Photo Uploaded — Pay Advance',
              color: const Color(0xFFD97706),
              asyncValue: advancesAsync,
            ),
            const SizedBox(height: 8),
            advancesAsync.when(
              loading: () => const _LoadingShimmer(count: 3),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (trips) {
                if (trips.isEmpty) {
                  return const _EmptyTile(message: 'No trips awaiting advance payment.');
                }
                return Column(
                  children: trips
                      .map((t) => _AdvanceNotifCard(trip: t))
                      .toList(),
                );
              },
            ),

            const SizedBox(height: 24),

            // ── Pending Expense Submissions ──────────────────────────────
            _SectionHeader(
              icon: Icons.receipt_long_rounded,
              label: 'Pending Expense Approvals',
              color: KTColors.danger,
              asyncValue: expensesAsync,
            ),
            const SizedBox(height: 8),
            expensesAsync.when(
              loading: () => const _LoadingShimmer(count: 3),
              error: (e, _) => _ErrorTile(message: e.toString()),
              data: (expenses) {
                if (expenses.isEmpty) {
                  return const _EmptyTile(message: 'No pending expense submissions.');
                }
                return Column(
                  children: expenses
                      .map((e) => _ExpenseNotifCard(expense: e))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader<T> extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final AsyncValue<List<T>> asyncValue;

  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.color,
    required this.asyncValue,
  });

  @override
  Widget build(BuildContext context) {
    final count = asyncValue.valueOrNull?.length ?? 0;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: KTColors.textHeading,
            ),
          ),
        ),
        if (asyncValue.hasValue && count > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Driver Advance Request Card ──────────────────────────────────────────────

class _AdvanceRequestCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> request;
  const _AdvanceRequestCard({required this.request});

  @override
  ConsumerState<_AdvanceRequestCard> createState() => _AdvanceRequestCardState();
}

class _AdvanceRequestCardState extends ConsumerState<_AdvanceRequestCard> {
  bool _loading = false;

  Future<void> _approve() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final id = widget.request['id'];
      final res = await api.post(
        '/finance-manager/driver-advance-requests/$id/approve',
        data: {},
      );
      if (res is Map && res['success'] == true) {
        ref.invalidate(_pendingDriverAdvanceRequestsProvider);
        ref.invalidate(financeNotificationCountProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Advance request approved'),
              backgroundColor: KTColors.success,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      } else {
        _showError(res is Map ? (res['message'] ?? 'Failed') : 'Failed');
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: KTColors.danger,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final driverName = widget.request['driver_name'] ?? 'Driver';
    final phone = widget.request['driver_phone'] ?? '';
    final tripNumber = widget.request['trip_number'];
    final origin = widget.request['origin'] ?? '';
    final destination = widget.request['destination'] ?? '';
    final amount = (widget.request['amount'] is num)
        ? (widget.request['amount'] as num).toDouble()
        : 1500.0;
    final createdAt = widget.request['created_at'] ?? '';

    String dateLabel = '';
    if (createdAt.isNotEmpty) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateLabel = '${dt.day} ${months[dt.month]}, ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        dateLabel = createdAt.toString().substring(0, 10);
      }
    }

    const blue = Color(0xFF2563EB);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: blue.withValues(alpha: 0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: blue.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.account_balance_wallet_rounded, color: blue, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Advance Request — $driverName',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: KTColors.textHeading,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: blue.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '₹${amount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: blue,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (tripNumber != null)
                    Text(
                      '$tripNumber  •  $origin → $destination',
                      style: const TextStyle(fontSize: 12, color: KTColors.textSecondary),
                    )
                  else
                    const Text(
                      'No trip assigned',
                      style: TextStyle(fontSize: 12, color: KTColors.textMuted),
                    ),
                  if (phone.isNotEmpty) ...[const SizedBox(height: 2),
                    Text(phone, style: const TextStyle(fontSize: 11, color: KTColors.textMuted))],
                  if (dateLabel.isNotEmpty) ...[const SizedBox(height: 2),
                    Text(dateLabel, style: const TextStyle(fontSize: 11, color: KTColors.textMuted))],
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 32,
                    child: _loading
                        ? const Center(child: SizedBox(width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: blue)))
                        : GestureDetector(
                            onTap: _approve,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(
                                color: blue,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Center(
                                child: Text('Approve & Pay',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                    )),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Advance Notification Card ─────────────────────────────────────────────────

class _AdvanceNotifCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _AdvanceNotifCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final tripNumber = trip['trip_number'] ?? '--';
    final driverName = trip['driver_name'] ?? 'Driver';
    final origin = trip['origin'] ?? '';
    final destination = trip['destination'] ?? '';
    final vehicle = trip['vehicle_registration'] ?? '';
    final advAmt = (trip['advance_amount'] is num)
        ? (trip['advance_amount'] as num).toDouble()
        : 1500.0;
    final tripDate = trip['trip_date'] ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD97706).withValues(alpha: 0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.currency_rupee_rounded,
                  color: Color(0xFFD97706), size: 20),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Advance Pending — $driverName',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: KTColors.textHeading,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD97706).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '₹${advAmt.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFD97706),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$tripNumber  •  $origin → $destination',
                    style: const TextStyle(
                        fontSize: 12, color: KTColors.textSecondary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    vehicle.isNotEmpty ? '$vehicle  •  $tripDate' : tripDate,
                    style: const TextStyle(
                        fontSize: 11, color: KTColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Driver has uploaded loading photo — please process the advance payment.',
                    style: TextStyle(
                      fontSize: 11,
                      color: const Color(0xFFD97706).withValues(alpha: 0.85),
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Expense Notification Card ─────────────────────────────────────────────────

class _ExpenseNotifCard extends StatelessWidget {
  final Map<String, dynamic> expense;
  const _ExpenseNotifCard({required this.expense});

  static String _formatCategory(String? cat) {
    if (cat == null) return 'Expense';
    return cat
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  static String _fmtAmt(dynamic paise) {
    final p = paise is num ? paise.toDouble() : 0.0;
    final amt = p / 100;
    if (amt >= 1000) return '₹${(amt / 1000).toStringAsFixed(1)}k';
    return '₹${amt.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final submitter = expense['submitter_name'] ?? 'Staff';
    final category = _formatCategory(expense['category']?.toString());
    final desc = expense['description'] ?? '';
    final submitted = expense['submitted_at'] ?? '';
    final amtStr = _fmtAmt(expense['amount_paise']);
    final method = expense['payment_method'] ?? '';

    // Format date
    String dateLabel = '';
    if (submitted.isNotEmpty) {
      try {
        final dt = DateTime.parse(submitted);
        dateLabel =
            '${dt.day} ${_mon(dt.month)} ${dt.year}, ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        dateLabel = submitted.toString().substring(0, 10);
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.danger.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: KTColors.danger.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.receipt_long_rounded,
                  color: KTColors.danger, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '$category — $submitter',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: KTColors.textHeading,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: KTColors.danger.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          amtStr,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: KTColors.danger,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (desc.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      style: const TextStyle(
                          fontSize: 12, color: KTColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    method.isNotEmpty ? '$method  •  $dateLabel' : dateLabel,
                    style: const TextStyle(
                        fontSize: 11, color: KTColors.textMuted),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: KTColors.warning.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Awaiting your approval',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: KTColors.warning,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _mon(int m) {
    const names = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return names[m];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

class _LoadingShimmer extends StatelessWidget {
  final int count;
  const _LoadingShimmer({required this.count});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (_) => Container(
          height: 80,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      ),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  final String message;
  const _EmptyTile({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline_rounded,
              color: KTColors.success, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                  fontSize: 12, color: KTColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorTile extends StatelessWidget {
  final String message;
  const _ErrorTile({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        'Error: $message',
        style: const TextStyle(fontSize: 12, color: KTColors.danger),
      ),
    );
  }
}
