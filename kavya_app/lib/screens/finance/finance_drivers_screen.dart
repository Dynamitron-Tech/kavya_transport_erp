import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ────────────────────────────────────────────────────────────────

final _driversListProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/finance-manager/drivers');
  if (res['success'] == true) {
    return List<Map<String, dynamic>>.from(res['data']['drivers'] ?? []);
  }
  throw Exception(res['message'] ?? 'Failed to load drivers');
});

final _driverTripsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, int>((ref, driverId) async {
  final api = ref.read(apiServiceProvider);
  final res = await api
      .get('/finance-manager/driver-completed-trips?driver_id=$driverId');
  if (res['success'] == true) {
    return List<Map<String, dynamic>>.from(res['data']['trips'] ?? []);
  }
  throw Exception(res['message'] ?? 'Failed to load trips');
});

final _expandedDriverProvider = StateProvider.autoDispose<int?>((ref) => null);

// ─── Screen ───────────────────────────────────────────────────────────────────

class FinanceDriversScreen extends ConsumerWidget {
  const FinanceDriversScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncDrivers = ref.watch(_driversListProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_driversListProvider);
          ref.read(_expandedDriverProvider.notifier).state = null;
        },
        child: asyncDrivers.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 80),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 40),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text('$e',
                          textAlign: TextAlign.center,
                          style:
                              const TextStyle(color: Colors.red, fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          data: (drivers) {
            if (drivers.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 80),
                  Center(
                      child: Text('No drivers found',
                          style: TextStyle(color: KTColors.textMuted))),
                ],
              );
            }
            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: drivers.length,
              itemBuilder: (ctx, i) =>
                  _DriverPayCard(driver: drivers[i]),
            );
          },
        ),
      ),
    );
  }
}

// ─── Driver Pay Card (expandable) ────────────────────────────────────────────

class _DriverPayCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> driver;

  const _DriverPayCard({required this.driver});

  @override
  ConsumerState<_DriverPayCard> createState() => _DriverPayCardState();
}

class _DriverPayCardState extends ConsumerState<_DriverPayCard> {
  Map<String, dynamic>? _selectedTrip;
  final _amountController = TextEditingController();
  bool _paying = false;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  int get _driverId => (widget.driver['driver_id'] as int?) ?? 0;

  bool get _isExpanded =>
      ref.watch(_expandedDriverProvider) == _driverId;

  void _toggle() {
    final notifier = ref.read(_expandedDriverProvider.notifier);
    if (_isExpanded) {
      notifier.state = null;
    } else {
      notifier.state = _driverId;
      setState(() {
        _selectedTrip = null;
        _amountController.clear();
      });
    }
  }

  void _onTripSelected(Map<String, dynamic>? trip) {
    setState(() {
      _selectedTrip = trip;
      if (trip != null) {
        // Pre-fill with net_to_pay (trip pay minus advance already given)
        final netPaise = (trip['net_to_pay_paise'] as num?)?.toInt()
            ?? ((trip['driver_pay_paise'] as num?)?.toInt() ?? 0) -
               ((trip['driver_advance_paise'] as num?)?.toInt() ?? 0);
        final rupees = netPaise / 100;
        _amountController.text =
            rupees > 0 ? rupees.toStringAsFixed(0) : '';
      } else {
        _amountController.clear();
      }
    });
  }

  Future<void> _pay() async {
    if (_selectedTrip == null) {
      _snack('Please select a trip', isError: true);
      return;
    }
    final amtText = _amountController.text.trim();
    final amtRupees = double.tryParse(amtText);
    if (amtRupees == null || amtRupees <= 0) {
      _snack('Enter a valid amount', isError: true);
      return;
    }
    final amtPaise = (amtRupees * 100).round();

    final driverName = widget.driver['name']?.toString() ?? 'Driver';
    final tripNum = _selectedTrip!['trip_number']?.toString() ?? '';
    final amtStr = '₹${amtRupees.toStringAsFixed(0)}';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirm Payment'),
        content: Text(
          'Pay $amtStr to $driverName\nfor trip $tripNum?\n\nThis will be recorded immediately.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C3AED),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text('Pay $amtStr'),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    setState(() => _paying = true);
    final api = ref.read(apiServiceProvider);
    try {
      final res = await api.post('/finance-manager/payments/driver-trip-pay',
          data: {
            'driver_id': _driverId,
            'trip_id': _selectedTrip!['trip_id'],
            'amount_paise': amtPaise,
          });
      if (!mounted) return;
      if (res['success'] == true) {
        _snack('Payment recorded for $driverName — trip $tripNum');
        ref.invalidate(_driverTripsProvider(_driverId));
        setState(() {
          _selectedTrip = null;
          _amountController.clear();
        });
      } else {
        _snack(res['message'] ?? 'Payment failed', isError: true);
      }
    } catch (e) {
      if (mounted) _snack(e.toString(), isError: true);
    }
    if (mounted) setState(() => _paying = false);
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red : Colors.green,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.driver;
    final name = d['name']?.toString() ?? '';
    final designation = d['designation']?.toString() ?? 'Driver';
    final empCode = d['employee_code']?.toString() ?? '';
    final phone = d['phone']?.toString() ?? '';
    final bankLast4 = d['bank_last4']?.toString() ?? '';
    final bankName = d['bank_name']?.toString() ?? '';
    final upiId = d['upi_id']?.toString() ?? '';
    final hasPayInfo = d['has_payment_info'] == true;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: _isExpanded
            ? const BorderSide(color: Color(0xFF7C3AED), width: 1.5)
            : BorderSide.none,
      ),
      child: Column(
        children: [
          // ── Header (always visible) ─────────────────────────
          InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: _toggle,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: _isExpanded
                        ? const Color(0xFF7C3AED).withValues(alpha: 0.15)
                        : Colors.grey.shade200,
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'D',
                      style: TextStyle(
                        color: _isExpanded
                            ? const Color(0xFF7C3AED)
                            : KTColors.textMuted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: KTColors.textHeading,
                          ),
                        ),
                        Text(
                          empCode.isNotEmpty
                              ? '$designation  ·  $empCode'
                              : designation,
                          style: const TextStyle(
                              color: KTColors.textMuted, fontSize: 11),
                        ),
                        if (phone.isNotEmpty)
                          Row(
                            children: [
                              const Icon(Icons.phone_outlined,
                                  size: 10, color: KTColors.textMuted),
                              const SizedBox(width: 3),
                              Text(phone,
                                  style: const TextStyle(
                                      fontSize: 10,
                                      color: KTColors.textMuted)),
                            ],
                          ),
                        if (bankLast4.isNotEmpty)
                          Text(
                            '${bankName.isNotEmpty ? '$bankName · ' : ''}****$bankLast4',
                            style: const TextStyle(
                                fontSize: 10, color: KTColors.textMuted),
                          )
                        else if (upiId.isNotEmpty)
                          Text(upiId,
                              style: const TextStyle(
                                  fontSize: 10, color: KTColors.textMuted))
                        else
                          Row(
                            children: const [
                              Icon(Icons.warning_amber_rounded,
                                  size: 11, color: Colors.orange),
                              SizedBox(width: 3),
                              Text('No bank/UPI info',
                                  style: TextStyle(
                                      fontSize: 10, color: Colors.orange)),
                            ],
                          ),
                      ],
                    ),
                  ),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: _isExpanded
                        ? const Color(0xFF7C3AED)
                        : KTColors.textMuted,
                  ),
                ],
              ),
            ),
          ),

          // ── Expanded payment form ───────────────────────────
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            child: _isExpanded
                ? _DriverPayForm(
                    driverId: _driverId,
                    hasPayInfo: hasPayInfo,
                    selectedTrip: _selectedTrip,
                    amountController: _amountController,
                    paying: _paying,
                    onTripSelected: _onTripSelected,
                    onPay: _pay,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

// ─── Payment Form inside expanded card ───────────────────────────────────────

class _DriverPayForm extends ConsumerWidget {
  final int driverId;
  final bool hasPayInfo;
  final Map<String, dynamic>? selectedTrip;
  final TextEditingController amountController;
  final bool paying;
  final ValueChanged<Map<String, dynamic>?> onTripSelected;
  final VoidCallback onPay;

  const _DriverPayForm({
    required this.driverId,
    required this.hasPayInfo,
    required this.selectedTrip,
    required this.amountController,
    required this.paying,
    required this.onTripSelected,
    required this.onPay,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncTrips = ref.watch(_driverTripsProvider(driverId));

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF7C3AED).withValues(alpha: 0.04),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(10),
          bottomRight: Radius.circular(10),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Divider(height: 1),
          const SizedBox(height: 10),

          // ── Trip dropdown ──────────────────────────────────
          asyncTrips.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text('Failed to load trips: $e',
                  style:
                      const TextStyle(color: Colors.red, fontSize: 12)),
            ),
            data: (trips) {
              final unpaidTrips =
                  trips.where((t) => t['is_paid'] != true).toList();
              final paidTrips =
                  trips.where((t) => t['is_paid'] == true).toList();

              if (trips.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No completed trips found for this driver.',
                    style:
                        TextStyle(color: KTColors.textMuted, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Unpaid trips dropdown
                  if (unpaidTrips.isNotEmpty) ...[
                    const Text('Select Trip',
                        style: TextStyle(
                            fontSize: 11,
                            color: KTColors.textMuted,
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(8),
                        color: Colors.white,
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<Map<String, dynamic>>(
                          isExpanded: true,
                          hint: const Text('Choose a completed trip…',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: KTColors.textMuted)),
                          value: selectedTrip,
                          onChanged: onTripSelected,
                          items: unpaidTrips
                              .map((t) => DropdownMenuItem(
                                    value: t,
                                    child: _TripDropdownItem(trip: t),
                                  ))
                              .toList(),
                        ),
                      ),
                    ),
                  ] else
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.green.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_outline,
                              color: Colors.green.shade600, size: 16),
                          const SizedBox(width: 6),
                          const Text('All trips paid',
                              style: TextStyle(
                                  color: Colors.green, fontSize: 12)),
                        ],
                      ),
                    ),

                  // Already-paid trips summary
                  if (paidTrips.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(
                        '${paidTrips.length} trip${paidTrips.length > 1 ? 's' : ''} already paid',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.green),
                      ),
                      children: paidTrips
                          .map((t) => Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: 2, horizontal: 4),
                                child: Row(
                                  children: [
                                    const Icon(Icons.check_circle,
                                        size: 12, color: Colors.green),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${t['trip_number']}  ${t['origin']} → ${t['destination']}',
                                      style: const TextStyle(
                                          fontSize: 11,
                                          color: KTColors.textMuted),
                                    ),
                                  ],
                                ),
                              ))
                          .toList(),
                    ),
                  ],
                ],
              );
            },
          ),

          const SizedBox(height: 10),

          // ── Amount field ───────────────────────────────────
          if (selectedTrip != null) ...[
            // Breakdown hint
            Builder(builder: (ctx) {
              final payPaise = (selectedTrip!['driver_pay_paise'] as num?)?.toInt() ?? 0;
              final advPaise = (selectedTrip!['driver_advance_paise'] as num?)?.toInt() ?? 0;
              final expPaise = (selectedTrip!['trip_expenses_paise'] as num?)?.toInt() ?? 0;
              if (payPaise == 0 && advPaise == 0 && expPaise == 0) return const SizedBox.shrink();
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    _breakdownRow('Trip Pay', payPaise, Colors.black87),
                    if (advPaise > 0) _breakdownRow('− Advance Paid', -advPaise, Colors.orange),
                    if (expPaise > 0) _breakdownRow('Expenses (paid separately)', expPaise, Colors.grey.shade600),
                    const Divider(height: 10),
                    _breakdownRow('Net to Pay Now', payPaise - advPaise, const Color(0xFF7C3AED), bold: true),
                  ],
                ),
              );
            }),
            const Text('Amount (₹)',
                style: TextStyle(
                    fontSize: 11,
                    color: KTColors.textMuted,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            TextField(
              controller: amountController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(
                    RegExp(r'^\d+\.?\d{0,2}'))
              ],
              decoration: InputDecoration(
                prefixText: '₹ ',
                hintText: '0',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 10),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF7C3AED)),
                ),
              ),
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 10),

            // ── Pay button ─────────────────────────────────
            GestureDetector(
              onTap: (!paying && hasPayInfo) ? onPay : null,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  color: hasPayInfo
                      ? const Color(0xFF7C3AED)
                      : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: paying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.account_balance_rounded,
                            size: 16,
                            color: hasPayInfo
                                ? Colors.white
                                : Colors.grey.shade500,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            hasPayInfo ? 'Pay Driver' : 'No Bank/UPI Info',
                            style: TextStyle(
                              color: hasPayInfo
                                  ? Colors.white
                                  : Colors.grey.shade500,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static Widget _breakdownRow(String label, int paise, Color color,
      {bool bold = false}) {
    final prefix = paise < 0 ? '-₹' : '₹';
    final amount = '$prefix${(paise.abs() / 100).toStringAsFixed(0)}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 10,
                  color: color,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
          Text(amount,
              style: TextStyle(
                  fontSize: 10,
                  color: color,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
        ],
      ),
    );
  }
}

// ─── Trip dropdown item ───────────────────────────────────────────────────────

class _TripDropdownItem extends StatelessWidget {
  final Map<String, dynamic> trip;

  const _TripDropdownItem({required this.trip});

  @override
  Widget build(BuildContext context) {
    final tripNum = trip['trip_number']?.toString() ?? '';
    final origin = trip['origin']?.toString() ?? '';
    final dest = trip['destination']?.toString() ?? '';
    final date = trip['trip_date']?.toString() ?? '';
    final payPaise = (trip['driver_pay_paise'] as num?)?.toInt() ?? 0;
    final advancePaise = (trip['driver_advance_paise'] as num?)?.toInt() ?? 0;
    final expensesPaise = (trip['trip_expenses_paise'] as num?)?.toInt() ?? 0;
    final netPaise = (trip['net_to_pay_paise'] as num?)?.toInt() ?? (payPaise - advancePaise);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Text(tripNum,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 12)),
              const Spacer(),
              Text(
                'Net ₹${(netPaise / 100).toStringAsFixed(0)}',
                style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF7C3AED),
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
          Text(
            '$origin → $dest${date.isNotEmpty ? '  ·  $date' : ''}',
            style: const TextStyle(fontSize: 10, color: KTColors.textMuted),
            overflow: TextOverflow.ellipsis,
          ),
          if (advancePaise > 0 || expensesPaise > 0)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                children: [
                  if (advancePaise > 0) ...[
                    const Icon(Icons.remove_circle_outline, size: 10, color: Colors.orange),
                    const SizedBox(width: 2),
                    Text('Advance ₹${(advancePaise / 100).toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 9, color: Colors.orange)),
                    const SizedBox(width: 8),
                  ],
                  if (expensesPaise > 0) ...[
                    const Icon(Icons.receipt_outlined, size: 10, color: Colors.grey),
                    const SizedBox(width: 2),
                    Text('Expenses ₹${(expensesPaise / 100).toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 9, color: KTColors.textMuted)),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

