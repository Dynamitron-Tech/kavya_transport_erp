import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

// ── Provider ──────────────────────────────────────────────────────

final _marketDriverTripsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ApiService();
  final resp = await api.get('/market-trips/my-trips');
  final raw = (resp['data'] ?? []) as List<dynamic>;
  return raw.cast<Map<String, dynamic>>();
});

// ═══════════════════════════════════════════════════════════════════
//  MARKET DRIVER TRIPS SCREEN
// ═══════════════════════════════════════════════════════════════════

class MarketDriverTripsScreen extends ConsumerWidget {
  const MarketDriverTripsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(_marketDriverTripsProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'My Trips',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (user != null)
              Text(
                user.name,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 11,
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: () => ref.invalidate(_marketDriverTripsProvider),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white54),
            tooltip: 'Logout',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: tripsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(
          message: e.toString(),
          onRetry: () => ref.invalidate(_marketDriverTripsProvider),
        ),
        data: (trips) {
          if (trips.isEmpty) {
            return _EmptyView(onRefresh: () => ref.invalidate(_marketDriverTripsProvider));
          }
          return RefreshIndicator(
            color: KTColors.primary,
            onRefresh: () async => ref.invalidate(_marketDriverTripsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: trips.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) => _TripCard(
                trip: trips[i],
                onTap: () => context.push(
                  '/market-driver/trip/${trips[i]['id']}',
                  extra: trips[i],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: KTColors.darkSurface,
        title: const Text('Logout', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to logout?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Logout', style: TextStyle(color: KTColors.danger)),
          ),
        ],
      ),
    );
  }
}

// ── Trip Card ─────────────────────────────────────────────────────

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final VoidCallback onTap;

  const _TripCard({required this.trip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = (trip['status'] as String? ?? 'PENDING').toUpperCase();
    final color  = _statusColor(status);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: color.withValues(alpha: 0.18),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row: trip id + status badge
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Trip #${trip['id']}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _StatusBadge(status: status, color: color),
              ],
            ),
            const SizedBox(height: 10),
            // Vehicle
            if (trip['vehicle_registration'] != null)
              _InfoRow(
                icon: Icons.local_shipping_outlined,
                label: trip['vehicle_registration'] as String,
              ),
            // Dates
            if (trip['created_at'] != null)
              _InfoRow(
                icon: Icons.calendar_today_outlined,
                label: _formatDate(trip['created_at'] as String),
              ),
            // Rates
            if (trip['client_rate'] != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  _AmountChip(label: 'Client rate', amount: trip['client_rate']),
                  const SizedBox(width: 8),
                  _AmountChip(label: 'Your rate', amount: trip['contractor_rate']),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) => switch (status) {
        'IN_TRANSIT'  => KTColors.warning,
        'DELIVERED'   => KTColors.success,
        'SETTLED'     => KTColors.info,
        'CANCELLED'   => KTColors.danger,
        _             => const Color(0xFF64748B),  // pending/assigned
      };

  String _formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
    } catch (_) {
      return raw;
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  final Color color;
  const _StatusBadge({required this.status, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Text(
          status.replaceAll('_', ' '),
          style: TextStyle(
            color: color,
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoRow({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            Icon(icon, size: 13, color: Colors.white38),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: Colors.white60, fontSize: 12),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );
}

class _AmountChip extends StatelessWidget {
  final String label;
  final dynamic amount;
  const _AmountChip({required this.label, required this.amount});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 9)),
            Text(
              '₹${_fmt(amount)}',
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );

  String _fmt(dynamic v) {
    if (v == null) return '0';
    final n = double.tryParse(v.toString()) ?? 0.0;
    if (n >= 1000) {
      return NumberFormat('#,##,###').format(n.toInt());
    }
    return n.toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '');
  }
}

// ── Empty & Error views ───────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  final VoidCallback onRefresh;
  const _EmptyView({required this.onRefresh});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_shipping_outlined, size: 60, color: Colors.white.withValues(alpha: 0.2)),
            const SizedBox(height: 16),
            const Text(
              'No trips assigned yet',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              'Your fleet manager will assign trips to you',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 12),
            ),
            const SizedBox(height: 24),
            TextButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Refresh'),
            ),
          ],
        ),
      );
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: KTColors.danger.withValues(alpha: 0.7)),
              const SizedBox(height: 16),
              const Text('Failed to load trips', style: TextStyle(color: Colors.white70, fontSize: 15)),
              const SizedBox(height: 8),
              Text(
                message,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 11),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: onRetry,
                style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}
