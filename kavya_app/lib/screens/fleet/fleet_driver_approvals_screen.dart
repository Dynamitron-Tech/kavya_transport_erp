import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ── Providers ──────────────────────────────────────────────────────────────

final pendingLeavesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final raw = await api.get('/driver-requests/leaves/pending');
  final list = (raw['data'] as List?) ?? [];
  return list.cast<Map<String, dynamic>>();
});

final _fleetAllAdvancesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final raw = await api.get('/driver-requests/advance-requests/fleet');
  final list = (raw['data'] as List?) ?? [];
  return list.cast<Map<String, dynamic>>();
});

// ── Screen ──────────────────────────────────────────────────────────────────

class FleetDriverApprovalsScreen extends ConsumerStatefulWidget {
  const FleetDriverApprovalsScreen({super.key});

  @override
  ConsumerState<FleetDriverApprovalsScreen> createState() =>
      _FleetDriverApprovalsScreenState();
}

class _FleetDriverApprovalsScreenState
    extends ConsumerState<FleetDriverApprovalsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        foregroundColor: KTColors.textHeading,
        title: Text('Driver Approvals',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        bottom: TabBar(
          controller: _tabs,
          labelColor: KTColors.fleetAccent,
          unselectedLabelColor: KTColors.textMuted,
          indicatorColor: KTColors.fleetAccent,
          tabs: const [
            Tab(icon: Icon(Icons.beach_access_rounded), text: 'Leave'),
            Tab(
                icon: Icon(Icons.account_balance_wallet_rounded),
                text: 'Advance'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _LeaveApprovalsTab(),
          _AdvanceApprovalsTab(),
        ],
      ),
    );
  }
}

// ── Leave tab ──────────────────────────────────────────────────────────────

class _LeaveApprovalsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leavesAsync = ref.watch(pendingLeavesProvider);
    return leavesAsync.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: KTLoadingShimmer(type: ShimmerType.card),
        ),
      ),
      error: (e, _) => _ErrorView(
          message: 'Failed to load leave requests',
          onRetry: () => ref.invalidate(pendingLeavesProvider)),
      data: (leaves) {
        if (leaves.isEmpty) {
          return _EmptyView(
              icon: Icons.beach_access_rounded,
              message: 'No pending leave requests');
        }
        return RefreshIndicator(
          color: KTColors.fleetAccent,
          onRefresh: () async => ref.invalidate(pendingLeavesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: leaves.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) =>
                _LeaveCard(leave: leaves[i], ref: ref),
          ),
        );
      },
    );
  }
}

class _LeaveCard extends StatefulWidget {
  final Map<String, dynamic> leave;
  final WidgetRef ref;
  const _LeaveCard({required this.leave, required this.ref});

  @override
  State<_LeaveCard> createState() => _LeaveCardState();
}

class _LeaveCardState extends State<_LeaveCard> {
  bool _loading = false;
  final _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _review(String action) async {
    setState(() => _loading = true);
    try {
      final api = widget.ref.read(apiServiceProvider);
      final resp = await api.post(
        '/driver-requests/leaves/${widget.leave['id']}/review',
        data: {'action': action, if (_noteCtrl.text.isNotEmpty) 'note': _noteCtrl.text.trim()},
      );
      if (resp['success'] == true) {
        widget.ref.invalidate(pendingLeavesProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                'Leave ${action == 'approve' ? 'approved' : 'rejected'} successfully'),
            backgroundColor: action == 'approve'
                ? KTColors.success
                : KTColors.danger,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Action failed. Please try again.'),
          backgroundColor: KTColors.danger,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showReviewDialog(String action) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
            action == 'approve' ? 'Approve Leave' : 'Reject Leave',
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: KTColors.textHeading)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              action == 'approve'
                  ? 'Confirm approval for ${widget.leave['driver_name']}\'s leave from ${widget.leave['start_date']} to ${widget.leave['end_date']}?'
                  : 'Confirm rejection for this leave request?',
              style: const TextStyle(
                  color: KTColors.textBody, fontSize: 14),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _noteCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Add a note (optional)',
                hintStyle:
                    const TextStyle(color: KTColors.textMuted, fontSize: 13),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: KTColors.textMuted)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _review(action);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: action == 'approve'
                  ? KTColors.success
                  : KTColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(action == 'approve' ? 'Approve' : 'Reject',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final leave = widget.leave;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: KTColors.fleetAccentBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.person_rounded,
                    color: KTColors.fleetAccent, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(leave['driver_name'] ?? 'Driver',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: KTColors.textHeading)),
                    Text(
                        '${leave['start_date']} → ${leave['end_date']}',
                        style: const TextStyle(
                            fontSize: 13, color: KTColors.textMuted)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: KTColors.warningBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Pending',
                    style: TextStyle(
                        color: KTColors.warning,
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          if (leave['reason'] != null &&
              (leave['reason'] as String).isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KTColors.lightBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.notes_rounded,
                      size: 14, color: KTColors.textMuted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(leave['reason'].toString(),
                        style: const TextStyle(
                            fontSize: 12, color: KTColors.textBody)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: 'Reject',
                  color: KTColors.danger,
                  icon: Icons.close_rounded,
                  onPressed:
                      _loading ? null : () => _showReviewDialog('reject'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  label: 'Approve',
                  color: KTColors.success,
                  icon: Icons.check_rounded,
                  onPressed:
                      _loading ? null : () => _showReviewDialog('approve'),
                  filled: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Advance tab ────────────────────────────────────────────────────────────

class _AdvanceApprovalsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Fetch ALL advance requests from fleet side by getting pending ones
    final advancesAsync = ref.watch(_fleetAllAdvancesProvider);
    return advancesAsync.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: KTLoadingShimmer(type: ShimmerType.card),
        ),
      ),
      error: (e, _) => _ErrorView(
          message: 'Failed to load advance requests',
          onRetry: () => ref.invalidate(_fleetAllAdvancesProvider)),
      data: (items) {
        final pending =
            items.where((r) => r['status'] == 'PENDING').toList();
        if (pending.isEmpty) {
          return _EmptyView(
              icon: Icons.account_balance_wallet_rounded,
              message: 'No pending advance requests');
        }
        return RefreshIndicator(
          color: KTColors.fleetAccent,
          onRefresh: () async => ref.invalidate(_fleetAllAdvancesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: pending.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) =>
                _AdvanceCard(advance: pending[i], ref: ref),
          ),
        );
      },
    );
  }
}

class _AdvanceCard extends StatefulWidget {
  final Map<String, dynamic> advance;
  final WidgetRef ref;
  const _AdvanceCard({required this.advance, required this.ref});

  @override
  State<_AdvanceCard> createState() => _AdvanceCardState();
}

class _AdvanceCardState extends State<_AdvanceCard> {
  bool _loading = false;

  Future<void> _acknowledge() async {
    setState(() => _loading = true);
    try {
      final api = widget.ref.read(apiServiceProvider);
      await api.post(
        '/driver-requests/advance-requests/${widget.advance['id']}/acknowledge',
        data: {},
      );
      widget.ref.invalidate(_fleetAllAdvancesProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed. Please try again.'),
          backgroundColor: KTColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final adv = widget.advance;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: KTColors.driverAccentBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.account_balance_wallet_rounded,
                    color: KTColors.driverAccent, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(adv['driver_name'] ?? 'Driver',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: KTColors.textHeading)),
                    Text(
                        'Advance request · ₹${adv['amount'] ?? 1500}',
                        style: const TextStyle(
                            fontSize: 13, color: KTColors.textMuted)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: KTColors.warningBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Pending',
                    style: TextStyle(
                        color: KTColors.warning,
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          if (adv['trip_number'] != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KTColors.lightBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_rounded,
                      size: 14, color: KTColors.textMuted),
                  const SizedBox(width: 8),
                  Text('Trip: ${adv['trip_number']}',
                      style: const TextStyle(
                          fontSize: 12,
                          color: KTColors.textBody,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : _acknowledge,
              icon: _loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_circle_outline_rounded,
                      size: 18),
              label: const Text('Mark as Processed',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled;

  const _ActionButton({
    required this.label,
    required this.color,
    required this.icon,
    this.onPressed,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    if (filled) {
      return ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 16),
        label: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 10),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16, color: color),
      label: Text(label,
          style: TextStyle(color: color, fontWeight: FontWeight.w700)),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 10),
        side: BorderSide(color: color),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyView({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 64, color: KTColors.textMuted),
          const SizedBox(height: 16),
          Text(message,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: KTColors.textMuted)),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
          const SizedBox(height: 12),
          Text(message,
              style: const TextStyle(color: KTColors.textMuted)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.fleetAccent,
              foregroundColor: Colors.white,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
