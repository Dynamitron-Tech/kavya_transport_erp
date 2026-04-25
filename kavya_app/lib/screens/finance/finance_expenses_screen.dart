import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

// ─── Provider ────────────────────────────────────────────────────────────────

final completedTripExpensesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get(
    '/finance-manager/trip-expense-queue?status=PENDING&limit=200',
  );
  if (res['success'] == true) {
    return List<Map<String, dynamic>>.from(res['data'] ?? []);
  }
  throw Exception(res['message'] ?? 'Failed to load expenses');
});

// ─── Screen ───────────────────────────────────────────────────────────────────

class FinanceExpensesScreen extends ConsumerStatefulWidget {
  const FinanceExpensesScreen({super.key});
  @override
  ConsumerState<FinanceExpensesScreen> createState() =>
      _FinanceExpensesScreenState();
}

class _FinanceExpensesScreenState extends ConsumerState<FinanceExpensesScreen> {
  final _purple = const Color(0xFF7C3AED);

  String _fmt(dynamic amount) {
    if (amount == null) return '₹0';
    final d = (amount is num ? amount : double.tryParse(amount.toString()) ?? 0);
    if (d >= 100000) return '₹${(d / 100000).toStringAsFixed(1)}L';
    if (d >= 1000) return '₹${(d / 1000).toStringAsFixed(1)}K';
    return '₹${d.toStringAsFixed(0)}';
  }

  /// Build a grouped map: trip_id → {tripInfo, expenses}
  Map<int, Map<String, dynamic>> _groupByTrip(
      List<Map<String, dynamic>> items) {
    final Map<int, Map<String, dynamic>> grouped = {};
    for (final item in items) {
      final tid = item['trip_id'] as int;
      if (!grouped.containsKey(tid)) {
        grouped[tid] = {
          'trip_id': tid,
          'trip_number': item['trip_number'] ?? '',
          'driver_name': item['driver_name'] ?? '',
          'origin': item['origin'] ?? '',
          'destination': item['destination'] ?? '',
          'vehicle_registration': item['vehicle_registration'] ?? '',
          'expenses': <Map<String, dynamic>>[],
        };
      }
      (grouped[tid]!['expenses'] as List<Map<String, dynamic>>).add(item);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(completedTripExpensesProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(completedTripExpensesProvider),
      child: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 56, color: Colors.green),
                  SizedBox(height: 12),
                  Text(
                    'No pending expenses',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: KTColors.textMuted,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'All trip expenses are settled.',
                    style:
                        TextStyle(fontSize: 13, color: KTColors.textMuted),
                  ),
                ],
              ),
            );
          }
          final grouped = _groupByTrip(items);
          final tripIds = grouped.keys.toList();
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: tripIds.length,
            itemBuilder: (_, i) {
              final tripId = tripIds[i];
              final tripData = grouped[tripId]!;
              return _TripExpenseCard(
                tripData: tripData,
                fmtAmount: _fmt,
                accentColor: _purple,
              );
            },
          );
        },
      ),
    );
  }
}

// ─── Trip Expense Card (grouped) ──────────────────────────────────────────────

class _TripExpenseCard extends StatefulWidget {
  final Map<String, dynamic> tripData;
  final String Function(dynamic) fmtAmount;
  final Color accentColor;

  const _TripExpenseCard({
    required this.tripData,
    required this.fmtAmount,
    required this.accentColor,
  });

  @override
  State<_TripExpenseCard> createState() => _TripExpenseCardState();
}

class _TripExpenseCardState extends State<_TripExpenseCard> {
  bool _expanded = true;

  Color _catColor(String? cat) {
    switch (cat) {
      case 'fuel': return Colors.orange;
      case 'toll': return Colors.blue;
      case 'food': return Colors.green;
      case 'repair': return Colors.red;
      case 'tyre': return Colors.brown;
      case 'loading': return Colors.teal;
      case 'unloading': return Colors.teal;
      case 'parking': return Colors.indigo;
      case 'police': return Colors.deepOrange;
      case 'rto': return Colors.deepPurple;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final expenses =
        widget.tripData['expenses'] as List<Map<String, dynamic>>;
    final tripNumber = widget.tripData['trip_number'] as String;
    final driverName = widget.tripData['driver_name'] as String;
    final origin = widget.tripData['origin'] as String;
    final destination = widget.tripData['destination'] as String;
    final vehicle = widget.tripData['vehicle_registration'] as String;
    final total = expenses.fold<double>(
      0,
      (sum, e) => sum + ((e['amount'] as num?)?.toDouble() ?? 0),
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1.5,
      child: Column(
        children: [
          // ── Trip Header ──
          InkWell(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: widget.accentColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          tripNumber,
                          style: TextStyle(
                            color: widget.accentColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$origin → $destination',
                          style: const TextStyle(
                            fontSize: 13,
                            color: KTColors.textMuted,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: KTColors.textMuted,
                        size: 20,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.person_outline,
                          size: 14, color: KTColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        driverName,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: KTColors.textHeading),
                      ),
                      if (vehicle.isNotEmpty) ...[
                        const SizedBox(width: 12),
                        const Icon(Icons.local_shipping_outlined,
                            size: 14, color: KTColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          vehicle,
                          style: const TextStyle(
                              fontSize: 12, color: KTColors.textMuted),
                        ),
                      ],
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            widget.fmtAmount(total),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: KTColors.textHeading,
                            ),
                          ),
                          Text(
                            '${expenses.length} expense${expenses.length == 1 ? '' : 's'}',
                            style: const TextStyle(
                                fontSize: 10, color: KTColors.textMuted),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // ── Expense Items ──
          if (_expanded) ...[
            const Divider(height: 1),
            ...expenses.map((exp) => _ExpenseRow(
                  expense: exp,
                  fmtAmount: widget.fmtAmount,
                  catColor: _catColor,
                )),
          ],
        ],
      ),
    );
  }
}

// ─── Individual Expense Row ───────────────────────────────────────────────────

class _ExpenseRow extends StatelessWidget {
  final Map<String, dynamic> expense;
  final String Function(dynamic) fmtAmount;
  final Color Function(String?) catColor;

  const _ExpenseRow({
    required this.expense,
    required this.fmtAmount,
    required this.catColor,
  });

  @override
  Widget build(BuildContext context) {
    final cat = expense['category']?.toString() ?? 'misc';
    final amount = expense['amount'];
    final amtStr = fmtAmount(amount);
    final desc = expense['description']?.toString() ?? '';
    final payMode = expense['payment_mode']?.toString() ?? '';
    final expDate =
        expense['expense_date']?.toString().substring(0, 10) ?? '';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFF0F0F0)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: catColor(cat).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              cat.toUpperCase(),
              style: TextStyle(
                color: catColor(cat),
                fontSize: 9,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (desc.isNotEmpty)
                  Text(
                    desc,
                    style: const TextStyle(
                        fontSize: 12, color: KTColors.textHeading),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (payMode.isNotEmpty) ...[
                      const Icon(Icons.payment,
                          size: 11, color: KTColors.textMuted),
                      const SizedBox(width: 3),
                      Text(
                        payMode,
                        style: const TextStyle(
                            fontSize: 10, color: KTColors.textMuted),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (expDate.isNotEmpty)
                      Text(
                        expDate,
                        style: const TextStyle(
                            fontSize: 10, color: KTColors.textMuted),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            amtStr,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: KTColors.textHeading,
            ),
          ),
        ],
      ),
    );
  }
}
