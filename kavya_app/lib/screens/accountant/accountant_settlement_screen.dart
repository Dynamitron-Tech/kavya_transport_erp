import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final accountantSettlementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, tabFilter) async {
    final api = ref.read(apiServiceProvider);
    final params = <String, dynamic>{'type': 'driver_settlement'};
    if (tabFilter != 'all') params['status'] = tabFilter;
    final res = await api.get('/payables/', queryParameters: params);
    final payload = res['data'] ?? res;
    if (payload is List) return payload.cast<Map<String, dynamic>>();
    return [];
  },
);

// ─── Screen ─────────────────────────────────────────────────────────────────

class AccountantSettlementScreen extends ConsumerStatefulWidget {
  const AccountantSettlementScreen({super.key});

  @override
  ConsumerState<AccountantSettlementScreen> createState() => _AccountantSettlementScreenState();
}

class _AccountantSettlementScreenState extends ConsumerState<AccountantSettlementScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  static const _tabs = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('paid', 'Paid'),
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
    final accent = KTColors.getRoleColor('accountant');

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
        title: Text('Settlements', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: accent.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: accent.withOpacity(0.4)),
            ),
            child: Text('Finance', style: KTTextStyles.label.copyWith(color: accent)),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: KTColors.acctAccent,
          labelColor: KTColors.acctAccent,
          unselectedLabelColor: KTColors.textMuted,
          tabs: _tabs.map((t) => Tab(text: t.$2)).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: _tabs.map((t) => _SettlementTab(tabKey: t.$1)).toList(),
      ),
    );
  }
}

// ─── Tab content ────────────────────────────────────────────────────────────

class _SettlementTab extends ConsumerWidget {
  final String tabKey;
  const _SettlementTab({required this.tabKey});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settlementsAsync = ref.watch(accountantSettlementsProvider(tabKey));

    return settlementsAsync.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: KTLoadingShimmer(type: ShimmerType.card),
        ),
      ),
      error: (e, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
            const SizedBox(height: 12),
            Text('Failed to load settlements',
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 16),
            KTButton.secondary(
              onPressed: () => ref.invalidate(accountantSettlementsProvider(tabKey)),
              label: 'Retry',
            ),
          ],
        ),
      ),
      data: (settlements) {
        if (settlements.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.receipt_long_outlined, color: KTColors.textMuted, size: 64),
                const SizedBox(height: 16),
                Text('No ${tabKey.toUpperCase()} Settlements',
                    style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
              ],
            ),
          );
        }

        // Show total amount pending
        int totalPaise = 0;
        for (final s in settlements) {
          totalPaise += (s['net_amount_paise'] as num? ?? 0).toInt();
        }

        return Column(
          children: [
            // Summary header
            Container(
              color: KTColors.surface,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Text('Total: ', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
                  Text(
                    '₹${(totalPaise / 100).toStringAsFixed(2)}',
                    style: KTTextStyles.kpiNumber.copyWith(color: KTColors.acctAccent, fontSize: 18),
                  ),
                  const Spacer(),
                  Text('${settlements.length} settlements',
                      style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                color: KTColors.acctAccent,
                onRefresh: () async => ref.invalidate(accountantSettlementsProvider(tabKey)),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: settlements.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) =>
                      _SettlementCard(settlement: settlements[i], tabKey: tabKey),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ─── Settlement Card ─────────────────────────────────────────────────────────

class _SettlementCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> settlement;
  final String tabKey;
  const _SettlementCard({required this.settlement, required this.tabKey});

  @override
  ConsumerState<_SettlementCard> createState() => _SettlementCardState();
}

class _SettlementCardState extends ConsumerState<_SettlementCard> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.settlement;
    final id = s['id'];
    final driverName = '${s['driver_first_name'] ?? ''} ${s['driver_last_name'] ?? ''}'.trim();
    final initials = driverName.isNotEmpty
        ? driverName.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : '?';
    final tripId = s['trip_id']?.toString() ?? '—';
    final dateFrom = s['date_from']?.toString() ?? '';
    final dateTo = s['date_to']?.toString() ?? '';
    final dateRange = dateFrom.isNotEmpty ? '$dateFrom – $dateTo' : '—';
    final grossPaise = (s['gross_amount_paise'] as num? ?? 0).toInt();
    final advancePaise = (s['advance_paise'] as num? ?? 0).toInt();
    final expensesPaise = (s['expenses_paise'] as num? ?? 0).toInt();
    final netPaise = (s['net_amount_paise'] as num? ?? 0).toInt();
    final paidDate = s['paid_date']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Driver info
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: KTColors.roleDriver.withOpacity(0.2),
                child: Text(initials, style: KTTextStyles.label.copyWith(color: KTColors.roleDriver)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driverName.isNotEmpty ? driverName : 'Driver',
                        style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                    Text('Trip #$tripId · $dateRange',
                        style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Breakdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _breakdownItem('Gross', grossPaise, KTColors.textMuted),
              _breakdownItem('Advance', -advancePaise, KTColors.danger),
              _breakdownItem('Expenses', -expensesPaise, KTColors.danger),
              _breakdownItem('Net', netPaise, KTColors.acctAccent, bold: true),
            ],
          ),
          const SizedBox(height: 12),

          // Actions
          if (widget.tabKey == 'pending')
            Row(
              children: [
                Expanded(
                  child: KTButton.primary(
                    onPressed: _loading ? null : () => _approve(id),
                    label: 'Approve',
                    isLoading: _loading,
                    height: 40,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: KTButton.ghost(
                    onPressed: _loading ? null : () => _reject(id),
                    label: 'Reject',
                  ),
                ),
              ],
            )
          else if (widget.tabKey == 'approved')
            KTButton.secondary(
              onPressed: _loading ? null : () => _markPaid(context, id),
              label: 'Mark Paid',
            )
          else if (widget.tabKey == 'paid' && paidDate.isNotEmpty)
            Row(
              children: [
                const Icon(Icons.check_circle, color: KTColors.success, size: 16),
                const SizedBox(width: 6),
                Text('Paid on $paidDate',
                    style: KTTextStyles.caption.copyWith(color: KTColors.success)),
              ],
            ),
        ],
      ),
    );
  }

  Widget _breakdownItem(String label, int paise, Color color, {bool bold = false}) {
    final prefix = paise < 0 ? '-₹' : '₹';
    final amount = '$prefix${(paise.abs() / 100).toStringAsFixed(0)}';
    return Column(
      children: [
        Text(
          amount,
          style: bold
              ? KTTextStyles.label.copyWith(color: color, fontWeight: FontWeight.w700, fontSize: 14)
              : KTTextStyles.label.copyWith(color: color),
        ),
        Text(label, style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
      ],
    );
  }

  Future<void> _approve(dynamic id) async {
    if (id == null) return;
    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.patch('/payables/$id/approve', data: {});
      ref.invalidate(accountantSettlementsProvider('pending'));
      ref.invalidate(accountantSettlementsProvider('approved'));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reject(dynamic id) async {
    if (id == null) return;
    // Confirm dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: KTColors.surface,
        title: Text('Reject Settlement?', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
        content: Text('This action cannot be undone.',
            style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Reject', style: KTTextStyles.label.copyWith(color: KTColors.danger)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _loading = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.patch('/payables/$id/reject', data: {});
      ref.invalidate(accountantSettlementsProvider('pending'));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markPaid(BuildContext context, dynamic id) async {
    if (id == null) return;
    final s = widget.settlement;
    final driverId = s['driver_id'];
    final netPaise = (s['net_amount_paise'] as num? ?? 0).toInt();

    // Show payment method modal
    String method = 'NEFT';
    await showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setModal) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Payment Method', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
              const SizedBox(height: 16),
              ...['NEFT', 'IMPS', 'UPI', 'Cash', 'Cheque'].map(
                (m) => RadioListTile<String>(
                  value: m,
                  groupValue: method,
                  onChanged: (v) => setModal(() => method = v ?? method),
                  title: Text(m, style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                  activeColor: KTColors.acctAccent,
                ),
              ),
              const SizedBox(height: 16),
              KTButton.primary(
                onPressed: () async {
                  Navigator.pop(ctx);
                  setState(() => _loading = true);
                  try {
                    final api = ref.read(apiServiceProvider);

                    if (method == 'UPI') {
                      // Fetch driver UPI VPA
                      String? vpa;
                      String? driverName;
                      try {
                        final info = await api.get('/drivers/$driverId/payment-info');
                        vpa = info['data']?['upi_id'] as String?;
                        driverName = info['data']?['name'] as String?;
                      } catch (_) {}

                      if (!context.mounted) return;

                      if (vpa == null || vpa.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Driver has no UPI ID registered. Please update driver profile first.'),
                            backgroundColor: KTColors.danger,
                          ),
                        );
                        setState(() => _loading = false);
                        return;
                      }

                      // Build UPI payment URI
                      final amountRupees = (netPaise / 100).toStringAsFixed(2);
                      final uri = Uri.parse(
                        'upi://pay'
                        '?pa=${Uri.encodeComponent(vpa)}'
                        '&pn=${Uri.encodeComponent(driverName ?? 'Driver')}'
                        '&am=$amountRupees'
                        '&cu=INR'
                        '&tn=${Uri.encodeComponent('Driver settlement')}',
                      );

                      bool launched = false;
                      try {
                        launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
                      } catch (_) {}

                      if (!context.mounted) return;

                      if (!launched) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Could not open UPI app. Please ensure a UPI app is installed.'),
                            backgroundColor: KTColors.danger,
                          ),
                        );
                        setState(() => _loading = false);
                        return;
                      }

                      // Ask accountant to confirm payment completed
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (_) => AlertDialog(
                          backgroundColor: KTColors.surface,
                          title: Text('Confirm Payment',
                              style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                          content: Text(
                            'Did you complete payment of ₹${(netPaise / 100).toStringAsFixed(0)} via UPI to $driverName?',
                            style: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: Text('No', style: KTTextStyles.label.copyWith(color: KTColors.danger)),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: Text('Yes, Paid', style: KTTextStyles.label.copyWith(color: KTColors.success)),
                            ),
                          ],
                        ),
                      );

                      if (confirmed != true) {
                        setState(() => _loading = false);
                        return;
                      }
                    }

                    // Mark settlement as paid (all methods reach here)
                    await api.patch('/payables/$id/mark-paid', data: {
                      'payment_method': method,
                      'paid_date': DateTime.now().toIso8601String().split('T').first,
                    });
                    ref.invalidate(accountantSettlementsProvider('approved'));
                    ref.invalidate(accountantSettlementsProvider('paid'));
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _loading = false);
                  }
                },
                label: 'Confirm Payment',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
