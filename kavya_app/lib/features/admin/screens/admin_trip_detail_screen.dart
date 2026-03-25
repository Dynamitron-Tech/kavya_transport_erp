import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';

// ─── Providers ──────────────────────────────────────────────────────────────

final _tripDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/trips/$tripId');
  if (resp is Map<String, dynamic> && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  if (resp is Map<String, dynamic>) return resp;
  return {};
});

final _tripTimelineProvider =
    FutureProvider.autoDispose.family<List<dynamic>, String>(
        (ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/trips/$tripId/timeline');
  if (resp is Map && resp['data'] is List) return resp['data'] as List;
  if (resp is List) return resp;
  return [];
});

final _tripExpensesProvider =
    FutureProvider.autoDispose.family<List<dynamic>, String>(
        (ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/trips/$tripId/expenses');
  if (resp is Map && resp['data'] is List) return resp['data'] as List;
  if (resp is List) return resp;
  return [];
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class AdminTripDetailScreen extends ConsumerWidget {
  final String tripId;
  const AdminTripDetailScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_tripDetailProvider(tripId));

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: Text('Trip #$tripId',
            style: const TextStyle(color: KTColors.darkTextPrimary)),
      ),
      body: detail.when(
        data: (d) {
          if (d.isEmpty) {
            return const Center(
                child: Text('Trip not found',
                    style: TextStyle(color: KTColors.darkTextSecondary)));
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(_tripDetailProvider(tripId));
              ref.invalidate(_tripTimelineProvider(tripId));
              ref.invalidate(_tripExpensesProvider(tripId));
            },
            child: _body(context, ref, d),
          );
        },
        loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.amber600)),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: KTColors.darkTextSecondary))),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, Map<String, dynamic> d) {
    final status = (d['status'] as String? ?? '').toUpperCase();
    final kmDriven = _safeNum(d['km_driven'] ?? d['distance_km']);
    final completionPct = _safeNum(d['completion_pct'] ?? d['progress']);
    final fuelEff = _safeNum(d['fuel_efficiency'] ?? d['kmpl']);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Stat row ──
        Row(children: [
          _statCard('$kmDriven km', 'Distance', KTColors.info),
          const SizedBox(width: 10),
          _statCard('$completionPct%', 'Progress', KTColors.success),
          const SizedBox(width: 10),
          _statCard('$fuelEff', 'Km/L', KTColors.amber600),
        ]),
        const SizedBox(height: 16),

        // ── Trip info card ──
        _card([
          _row('Status', _statusPill(status)),
          _infoLine('Origin', d['origin'] as String? ?? '—'),
          _infoLine('Destination', d['destination'] as String? ?? '—'),
          _infoLine('Vehicle', d['vehicle_registration'] as String? ?? d['vehicle_number'] as String? ?? '—'),
          _infoLine('Driver', d['driver_name'] as String? ?? '—'),
          _infoLine('Started', _fmtDate(d['start_date'] ?? d['started_at'])),
          if (d['end_date'] != null || d['completed_at'] != null)
            _infoLine('Completed', _fmtDate(d['end_date'] ?? d['completed_at'])),
        ]),
        const SizedBox(height: 16),

        // ── Timeline ──
        _sectionHead('TIMELINE'),
        _buildTimeline(ref),
        const SizedBox(height: 16),

        // ── Expenses ──
        _sectionHead('EXPENSES'),
        _buildExpenses(ref),
        const SizedBox(height: 30),
      ],
    );
  }

  // ── Timeline section ──────────────────────────────────────────────────────

  Widget _buildTimeline(WidgetRef ref) {
    final tl = ref.watch(_tripTimelineProvider(tripId));
    return tl.when(
      data: (list) {
        if (list.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('No timeline events',
                style: TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
          );
        }
        return Column(
          children: list.map<Widget>((e) {
            final m = e as Map<String, dynamic>;
            return _timelineItem(
              m['event'] as String? ?? m['title'] as String? ?? '—',
              _fmtDate(m['timestamp'] ?? m['created_at']),
              m['description'] as String?,
            );
          }).toList(),
        );
      },
      loading: () => const SizedBox(
          height: 60,
          child: Center(child: CircularProgressIndicator(color: KTColors.amber600))),
      error: (_, __) => const Text('Could not load timeline',
          style: TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
    );
  }

  Widget _timelineItem(String title, String time, String? desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                  shape: BoxShape.circle, color: KTColors.amber600),
            ),
            Container(width: 1, height: 30, color: KTColors.darkBorder),
          ]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: KTColors.darkTextPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
                if (desc != null && desc.isNotEmpty)
                  Text(desc,
                      style: const TextStyle(
                          color: KTColors.darkTextSecondary, fontSize: 12)),
                Text(time,
                    style: const TextStyle(
                        color: KTColors.darkTextSecondary, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Expenses section ──────────────────────────────────────────────────────

  Widget _buildExpenses(WidgetRef ref) {
    final exp = ref.watch(_tripExpensesProvider(tripId));
    return exp.when(
      data: (list) {
        if (list.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('No expenses recorded',
                style: TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
          );
        }
        num total = 0;
        final rows = list.map<Widget>((e) {
          final m = e as Map<String, dynamic>;
          final amt = _safeNum(m['amount']);
          total += amt;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(m['category'] as String? ?? m['type'] as String? ?? '—',
                    style: const TextStyle(color: KTColors.darkTextSecondary, fontSize: 13)),
                Text('₹$amt',
                    style: const TextStyle(color: KTColors.darkTextPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
              ],
            ),
          );
        }).toList();

        return _card([
          ...rows,
          const Divider(color: KTColors.darkBorder, height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total',
                  style: TextStyle(color: KTColors.darkTextPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
              Text('₹$total',
                  style: const TextStyle(color: KTColors.amber600, fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
        ]);
      },
      loading: () => const SizedBox(
          height: 60,
          child: Center(child: CircularProgressIndicator(color: KTColors.amber600))),
      error: (_, __) => const Text('Could not load expenses',
          style: TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _statCard(String value, String label, Color color) {
    return Expanded(
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(value,
                          style: const TextStyle(
                              color: KTColors.darkTextPrimary,
                              fontSize: 18,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(label,
                          style: const TextStyle(
                              color: KTColors.darkTextSecondary, fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _row(String label, Widget trailing) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(color: KTColors.darkTextSecondary, fontSize: 13)),
          trailing,
        ],
      ),
    );
  }

  Widget _infoLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label,
                style: const TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(color: KTColors.darkTextPrimary, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String status) {
    Color color;
    switch (status) {
      case 'IN_TRANSIT':
      case 'IN_PROGRESS':
        color = KTColors.info;
        break;
      case 'COMPLETED':
      case 'DELIVERED':
        color = KTColors.success;
        break;
      case 'CANCELLED':
        color = KTColors.danger;
        break;
      default:
        color = KTColors.amber600;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status,
          style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  Widget _sectionHead(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style: const TextStyle(
                color: KTColors.darkTextSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );

  String _fmtDate(dynamic val) {
    if (val == null) return '—';
    try {
      final dt = DateTime.parse(val.toString());
      return DateFormat('dd MMM yyyy, HH:mm').format(dt);
    } catch (_) {
      return val.toString();
    }
  }

  num _safeNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse(v?.toString() ?? '') ?? 0;
  }
}
