import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final _driverSettlementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, status) async {
    final api = ref.read(apiServiceProvider);
    final params = <String, dynamic>{'type': 'driver_settlement'};
    if (status.isNotEmpty) params['status'] = status;
    final res = await api.get('/payables/', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    return [];
  },
);

final _marketTripsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, status) async {
    final api = ref.read(apiServiceProvider);
    final params = <String, dynamic>{};
    if (status.isNotEmpty) params['status'] = status;
    final res = await api.get('/market-trips', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    if (payload is Map) {
      final items = payload['items'] ?? payload['results'] ?? [];
      return List<Map<String, dynamic>>.from(items);
    }
    return [];
  },
);

final _expensesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, status) async {
    final api = ref.read(apiServiceProvider);
    final params = <String, dynamic>{};
    if (status.isNotEmpty) params['status'] = status;
    final res = await api.get('/accountant/expenses', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    if (payload is Map) {
      final items = payload['items'] ?? payload['results'] ?? [];
      return List<Map<String, dynamic>>.from(items);
    }
    return [];
  },
);

final _vendorPayablesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, status) async {
    final api = ref.read(apiServiceProvider);
    final params = <String, dynamic>{};
    if (status.isNotEmpty) params['status'] = status;
    final res = await api.get('/finance/supplier-payables', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    if (payload is Map) {
      final items = payload['items'] ?? payload['results'] ?? [];
      return List<Map<String, dynamic>>.from(items);
    }
    return [];
  },
);

// ─── Screen ──────────────────────────────────────────────────────────────────

class AccountantPaymentsHubScreen extends ConsumerStatefulWidget {
  const AccountantPaymentsHubScreen({super.key});

  @override
  ConsumerState<AccountantPaymentsHubScreen> createState() =>
      _AccountantPaymentsHubScreenState();
}

class _AccountantPaymentsHubScreenState
    extends ConsumerState<AccountantPaymentsHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  static const _tabs = [
    (Icons.people_outlined, 'Driver Settlements'),
    (Icons.local_shipping_outlined, 'Market Vehicles'),
    (Icons.receipt_outlined, 'Trip Expenses'),
    (Icons.business_outlined, 'Vendors'),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF059669); // green for payments
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text('Payments Hub',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: accent.withValues(alpha: 0.4)),
            ),
            child: Text('Finance',
                style: KTTextStyles.label.copyWith(color: accent)),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: accent,
          labelColor: accent,
          unselectedLabelColor: KTColors.textMuted,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: _tabs
              .map((t) => Tab(
                    child: Row(
                      children: [
                        Icon(t.$1, size: 15),
                        const SizedBox(width: 6),
                        Text(t.$2),
                      ],
                    ),
                  ))
              .toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: const [
          _DriverSettlementsTab(),
          _MarketVehiclesTab(),
          _TripExpensesTab(),
          _VendorPayablesTab(),
        ],
      ),
    );
  }
}

// ─── Driver Settlements Tab ───────────────────────────────────────────────────

class _DriverSettlementsTab extends ConsumerWidget {
  const _DriverSettlementsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_driverSettlementsProvider('pending'));
    return async.when(
      loading: () => _loadingList(),
      error: (e, _) => _errorView(e.toString(),
          () => ref.invalidate(_driverSettlementsProvider('pending'))),
      data: (items) => items.isEmpty
          ? _emptyView('No pending driver settlements')
          : RefreshIndicator(
              color: const Color(0xFF059669),
              onRefresh: () async =>
                  ref.invalidate(_driverSettlementsProvider('pending')),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (ctx, i) => _SettlementCard(item: items[i], ref: ref),
              ),
            ),
    );
  }
}

class _SettlementCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final WidgetRef ref;
  const _SettlementCard({required this.item, required this.ref});

  @override
  Widget build(BuildContext context) {
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final amount = (item['amount'] as num? ?? 0).toDouble();
    final name = item['driver_name']?.toString() ?? item['payee_name']?.toString() ?? '—';
    final ref2 = item['reference_number']?.toString() ?? '';
    final status = item['status']?.toString() ?? '';
    final statusColor = status == 'approved'
        ? const Color(0xFF059669)
        : status == 'pending'
            ? KTColors.warning
            : KTColors.textMuted;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.person_outlined, color: KTColors.acctAccent, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(name,
                  style: KTTextStyles.bodyMedium
                      .copyWith(color: KTColors.textHeading)),
            ),
            Text(inr.format(amount),
                style: const TextStyle(
                    color: KTColors.warning,
                    fontWeight: FontWeight.bold,
                    fontSize: 16)),
          ]),
          if (ref2.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(ref2,
                style: KTTextStyles.bodySmall
                    .copyWith(color: KTColors.textMuted, fontFamily: 'monospace')),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(status.toUpperCase(),
                  style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w600)),
            ),
            const Spacer(),
            if (status == 'approved')
              FilledButton.icon(
                icon: const Icon(Icons.send_outlined, size: 14),
                label: const Text('Record Payment'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 12),
                ),
                onPressed: () => _RecordPaymentSheet.show(
                  context,
                  title: 'Pay: $name',
                  onConfirm: (method, refNum, date) async {
                    final api = ref.read(apiServiceProvider);
                    await api.patch(
                      '/payables/${item['id']}/mark-paid',
                      data: {
                        'payment_method': method,
                        'reference_number': refNum,
                        'paid_date': date,
                      },
                    );
                    ref.invalidate(_driverSettlementsProvider('pending'));
                  },
                ),
              ),
            if (status == 'pending')
              OutlinedButton.icon(
                icon: const Icon(Icons.check_circle_outline, size: 14),
                label: const Text('Approve'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF059669),
                  side: const BorderSide(color: Color(0xFF059669)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 12),
                ),
                onPressed: () async {
                  final api = ref.read(apiServiceProvider);
                  await api.patch('/payables/${item['id']}/approve', data: {});
                  ref.invalidate(_driverSettlementsProvider('pending'));
                },
              ),
          ]),
        ],
      ),
    );
  }
}

// ─── Market Vehicles Tab ─────────────────────────────────────────────────────

class _MarketVehiclesTab extends ConsumerWidget {
  const _MarketVehiclesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_marketTripsProvider('delivered'));
    return async.when(
      loading: () => _loadingList(),
      error: (e, _) =>
          _errorView(e.toString(), () => ref.invalidate(_marketTripsProvider('delivered'))),
      data: (items) => items.isEmpty
          ? _emptyView('No unpaid market vehicle trips')
          : RefreshIndicator(
              color: const Color(0xFF059669),
              onRefresh: () async =>
                  ref.invalidate(_marketTripsProvider('delivered')),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (ctx, i) =>
                    _MarketTripCard(item: items[i], ref: ref),
              ),
            ),
    );
  }
}

class _MarketTripCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final WidgetRef ref;
  const _MarketTripCard({required this.item, required this.ref});

  @override
  Widget build(BuildContext context) {
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final amount = (item['agreed_amount'] as num? ?? item['amount'] as num? ?? 0).toDouble();
    final vehicle = item['vehicle_number']?.toString() ?? item['vehicle']?.toString() ?? '—';
    final owner = item['owner_name']?.toString() ?? '—';
    final tripRef = item['trip_number']?.toString() ?? item['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.local_shipping_outlined, color: KTColors.info, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(vehicle,
                  style: KTTextStyles.bodyMedium
                      .copyWith(color: KTColors.textHeading)),
              Text('Owner: $owner',
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            ]),
          ),
          Text(inr.format(amount),
              style: const TextStyle(
                  color: KTColors.warning,
                  fontWeight: FontWeight.bold,
                  fontSize: 16)),
        ]),
        if (tripRef.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('Trip #$tripRef',
              style: KTTextStyles.bodySmall
                  .copyWith(color: KTColors.textMuted, fontFamily: 'monospace')),
        ],
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            icon: const Icon(Icons.send_outlined, size: 14),
            label: const Text('Record Payment'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              textStyle: const TextStyle(fontSize: 12),
            ),
            onPressed: () => _RecordPaymentSheet.show(
              context,
              title: 'Pay: $vehicle',
              onConfirm: (method, refNum, date) async {
                final api = ref.read(apiServiceProvider);
                await api.post('/market-trips/${item['id']}/settle', data: {
                  'settlement_reference': refNum,
                  'settlement_remarks': 'Payment via $method',
                });
                ref.invalidate(_marketTripsProvider('delivered'));
              },
            ),
          ),
        ),
      ]),
    );
  }
}

// ─── Trip Expenses Tab ────────────────────────────────────────────────────────

class _TripExpensesTab extends ConsumerWidget {
  const _TripExpensesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_expensesProvider('approved'));
    return async.when(
      loading: () => _loadingList(),
      error: (e, _) =>
          _errorView(e.toString(), () => ref.invalidate(_expensesProvider('approved'))),
      data: (items) => items.isEmpty
          ? _emptyView('No approved expenses pending payment')
          : RefreshIndicator(
              color: const Color(0xFF059669),
              onRefresh: () async =>
                  ref.invalidate(_expensesProvider('approved')),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (ctx, i) =>
                    _ExpenseCard(item: items[i], ref: ref),
              ),
            ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final WidgetRef ref;
  const _ExpenseCard({required this.item, required this.ref});

  @override
  Widget build(BuildContext context) {
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final amount = (item['amount'] as num? ?? 0).toDouble();
    final category = item['category']?.toString() ?? item['expense_type']?.toString() ?? '—';
    final driver = item['driver_name']?.toString() ?? '—';
    final tripRef = item['trip_number']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.receipt_outlined, color: KTColors.acctAccent, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(category,
                  style: KTTextStyles.bodyMedium
                      .copyWith(color: KTColors.textHeading)),
              Text(driver,
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            ]),
          ),
          Text(inr.format(amount),
              style: const TextStyle(
                  color: KTColors.warning,
                  fontWeight: FontWeight.bold,
                  fontSize: 16)),
        ]),
        if (tripRef.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('Trip: $tripRef',
              style: KTTextStyles.bodySmall
                  .copyWith(color: KTColors.textMuted, fontFamily: 'monospace')),
        ],
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            icon: const Icon(Icons.send_outlined, size: 14),
            label: const Text('Record Payment'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              textStyle: const TextStyle(fontSize: 12),
            ),
            onPressed: () => _RecordPaymentSheet.show(
              context,
              title: 'Pay: $category',
              onConfirm: (method, refNum, date) async {
                final api = ref.read(apiServiceProvider);
                await api.put(
                  '/accountant/expenses/${item['id']}/mark-paid',
                  data: {
                    'payment_mode': method,
                    'reference_number': refNum,
                  },
                );
                ref.invalidate(_expensesProvider('approved'));
              },
            ),
          ),
        ),
      ]),
    );
  }
}

// ─── Vendor Payables Tab ──────────────────────────────────────────────────────

class _VendorPayablesTab extends ConsumerWidget {
  const _VendorPayablesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_vendorPayablesProvider('pending'));
    return async.when(
      loading: () => _loadingList(),
      error: (e, _) =>
          _errorView(e.toString(), () => ref.invalidate(_vendorPayablesProvider('pending'))),
      data: (items) => items.isEmpty
          ? _emptyView('No pending vendor payables')
          : RefreshIndicator(
              color: const Color(0xFF059669),
              onRefresh: () async =>
                  ref.invalidate(_vendorPayablesProvider('pending')),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (ctx, i) =>
                    _VendorPayableCard(item: items[i], ref: ref),
              ),
            ),
    );
  }
}

class _VendorPayableCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final WidgetRef ref;
  const _VendorPayableCard({required this.item, required this.ref});

  @override
  Widget build(BuildContext context) {
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final amount = (item['amount'] as num? ?? item['total_amount'] as num? ?? 0).toDouble();
    final vendor = item['vendor_name']?.toString() ?? item['supplier_name']?.toString() ?? '—';
    final desc = item['description']?.toString() ?? item['invoice_number']?.toString() ?? '';
    final dueDateStr = item['due_date']?.toString() ?? '';
    final isOverdue = _isOverdue(dueDateStr);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: isOverdue
                ? KTColors.danger.withValues(alpha: 0.4)
                : KTColors.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.business_outlined, color: KTColors.roleManager, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(vendor,
                  style: KTTextStyles.bodyMedium
                      .copyWith(color: KTColors.textHeading)),
              if (desc.isNotEmpty)
                Text(desc,
                    style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(inr.format(amount),
                style: const TextStyle(
                    color: KTColors.warning,
                    fontWeight: FontWeight.bold,
                    fontSize: 16)),
            if (isOverdue)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: KTColors.danger.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('OVERDUE',
                    style: TextStyle(
                        color: KTColors.danger,
                        fontSize: 9,
                        fontWeight: FontWeight.bold)),
              ),
          ]),
        ]),
        if (dueDateStr.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('Due: $dueDateStr',
              style: KTTextStyles.bodySmall.copyWith(
                  color: isOverdue ? KTColors.danger : KTColors.textMuted)),
        ],
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            icon: const Icon(Icons.send_outlined, size: 14),
            label: const Text('Record Payment'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              textStyle: const TextStyle(fontSize: 12),
            ),
            onPressed: () => _RecordPaymentSheet.show(
              context,
              title: 'Pay: $vendor',
              onConfirm: (method, refNum, date) async {
                final api = ref.read(apiServiceProvider);
                await api.post(
                  '/finance/supplier-payables/${item['id']}/pay',
                  data: {
                    'payment_method': method,
                    'reference_number': refNum,
                    'paid_date': date,
                  },
                );
                ref.invalidate(_vendorPayablesProvider('pending'));
              },
            ),
          ),
        ),
      ]),
    );
  }

  bool _isOverdue(String dueDateStr) {
    if (dueDateStr.isEmpty) return false;
    try {
      final due = DateTime.parse(dueDateStr);
      return due.isBefore(DateTime.now());
    } catch (_) {
      return false;
    }
  }
}

// ─── Record Payment Bottom Sheet ──────────────────────────────────────────────

class _RecordPaymentSheet extends StatefulWidget {
  final String title;
  final Future<void> Function(String method, String refNum, String date) onConfirm;

  const _RecordPaymentSheet({required this.title, required this.onConfirm});

  static void show(
    BuildContext context, {
    required String title,
    required Future<void> Function(String method, String refNum, String date)
        onConfirm,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _RecordPaymentSheet(title: title, onConfirm: onConfirm),
    );
  }

  @override
  State<_RecordPaymentSheet> createState() => _RecordPaymentSheetState();
}

class _RecordPaymentSheetState extends State<_RecordPaymentSheet> {
  static const _methods = ['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH'];
  String _method = 'NEFT';
  final _refCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    _dateCtrl.text = today;
  }

  @override
  void dispose() {
    _refCtrl.dispose();
    _dateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: KTColors.borderColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text('Record Payment',
              style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
          const SizedBox(height: 4),
          Text(widget.title,
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 16),

          // Warning banner
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: KTColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: KTColors.warning.withValues(alpha: 0.4)),
            ),
            child: Row(children: [
              const Icon(Icons.info_outline, color: KTColors.warning, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Transfer the money first via bank / UPI, then record the UTR/ref here.',
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.warning),
                ),
              ),
            ]),
          ),

          // Payment method
          Text('Payment Method',
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _methods
                .map((m) => ChoiceChip(
                      label: Text(m),
                      selected: _method == m,
                      onSelected: (_) => setState(() => _method = m),
                      selectedColor:
                          const Color(0xFF059669).withValues(alpha: 0.2),
                      labelStyle: TextStyle(
                        color: _method == m
                            ? const Color(0xFF059669)
                            : KTColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),

          // UTR / Reference
          Text('UTR / Reference Number',
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          TextField(
            controller: _refCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. NEFT2024123456789',
              hintStyle: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
              filled: true,
              fillColor: KTColors.lightBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: KTColors.borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: KTColors.borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF059669)),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
          const SizedBox(height: 16),

          // Payment date
          Text('Payment Date',
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          TextField(
            controller: _dateCtrl,
            readOnly: true,
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now().add(const Duration(days: 1)),
              );
              if (picked != null) {
                setState(() {
                  _dateCtrl.text = DateFormat('yyyy-MM-dd').format(picked);
                });
              }
            },
            decoration: InputDecoration(
              hintText: 'YYYY-MM-DD',
              suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
              filled: true,
              fillColor: KTColors.lightBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: KTColors.borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: KTColors.borderColor),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: const TextStyle(color: KTColors.danger, fontSize: 12)),
          ],
          const SizedBox(height: 20),

          // Confirm button
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _loading ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Text('Confirm Payment',
                      style:
                          TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (_refCtrl.text.trim().isEmpty && _method != 'CASH') {
      setState(() => _error = 'Please enter a UTR or reference number.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onConfirm(
          _method, _refCtrl.text.trim(), _dateCtrl.text.trim());
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

Widget _loadingList() => ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 4,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: KTLoadingShimmer(type: ShimmerType.card),
      ),
    );

Widget _emptyView(String msg) => Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle_outline,
              color: Color(0xFF059669), size: 64),
          const SizedBox(height: 16),
          Text(msg,
              style: KTTextStyles.body.copyWith(color: KTColors.textMuted),
              textAlign: TextAlign.center),
        ],
      ),
    );

Widget _errorView(String msg, VoidCallback onRetry) => Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
          const SizedBox(height: 12),
          Text('Failed to load data',
              style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
          const SizedBox(height: 8),
          Text(msg,
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
              textAlign: TextAlign.center),
          const SizedBox(height: 16),
          KTButton.secondary(onPressed: onRetry, label: 'Retry'),
        ],
      ),
    );
