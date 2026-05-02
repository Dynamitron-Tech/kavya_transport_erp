import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final _vehicleDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, vehicleId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/vehicles/$vehicleId');
  if (resp is Map<String, dynamic> && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  if (resp is Map<String, dynamic>) return resp;
  return {};
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class AdminVehicleDetailScreen extends ConsumerWidget {
  final String vehicleId;
  const AdminVehicleDetailScreen({super.key, required this.vehicleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_vehicleDetailProvider(vehicleId));

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Vehicle detail',
            style: TextStyle(color: KTColors.darkTextPrimary)),
      ),
      body: detail.when(
        data: (d) {
          if (d.isEmpty) {
            return const Center(
                child: Text('Vehicle not found',
                    style: TextStyle(color: KTColors.darkTextSecondary)));
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(_vehicleDetailProvider(vehicleId)),
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
    final reg = d['registration_number'] as String? ?? '—';
    final type = d['vehicle_type'] as String? ?? '—';
    final cap = _safeNum(d['capacity_tons'] ?? d['capacity']);
    final status = (d['status'] as String? ?? 'AVAILABLE').toUpperCase();
    final isAvail = status == 'AVAILABLE';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Header card ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: KTColors.darkSurface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: KTColors.info.withAlpha(30),
                child: const Icon(Icons.local_shipping,
                    color: KTColors.info, size: 28),
              ),
              const SizedBox(height: 10),
              Text(reg,
                  style: const TextStyle(
                      color: KTColors.darkTextPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('$type · ${cap}T',
                  style: const TextStyle(
                      color: KTColors.darkTextSecondary, fontSize: 13)),
              const SizedBox(height: 8),
              _statusPill(isAvail ? 'Available' : status, isAvail ? KTColors.success : KTColors.info),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Compliance table ──
        _sectionHead('COMPLIANCE STATUS'),
        _complianceTable(d),
        const SizedBox(height: 16),

        // ── Trip history ──
        _sectionHead('RECENT TRIPS'),
        _tripHistory(d),
        const SizedBox(height: 20),

        // ── Actions ──
        _actionBtn('Update compliance', Icons.verified_user, KTColors.success, () {
          // Navigate to compliance update via admin compliance screen
          context.push('/admin/compliance');
        }),
        const SizedBox(height: 10),
        _actionBtn('Edit vehicle', Icons.edit_outlined, KTColors.info, () {
          context.push('/manager/fleet/$vehicleId');
        }),
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _complianceTable(Map<String, dynamic> d) {
    final items = <_ComplianceItem>[
      _ComplianceItem('Insurance', d['insurance_expiry']),
      _ComplianceItem('Fitness', d['fitness_expiry']),
      _ComplianceItem('PUC', d['puc_expiry']),
      _ComplianceItem('Permit', d['permit_expiry']),
      _ComplianceItem('Road Tax', d['road_tax_expiry']),
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: items.map((item) {
          final expired = item.isExpired;
          final expiring = item.isExpiringSoon;
          final color = expired
              ? KTColors.danger
              : expiring
                  ? KTColors.amber600
                  : KTColors.success;
          final label = expired
              ? 'Expired'
              : expiring
                  ? 'Expiring soon'
                  : 'Valid';

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(item.name,
                      style: const TextStyle(
                          color: KTColors.darkTextSecondary, fontSize: 13)),
                ),
                Text(item.dateStr,
                    style: const TextStyle(
                        color: KTColors.darkTextPrimary, fontSize: 12)),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(label,
                      style: TextStyle(
                          color: color,
                          fontSize: 10,
                          fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _tripHistory(Map<String, dynamic> d) {
    final trips = d['recent_trips'] as List? ?? d['trips'] as List? ?? [];
    if (trips.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Text('No recent trips',
            style: TextStyle(color: KTColors.darkTextSecondary, fontSize: 12)),
      );
    }
    return Column(
      children: trips.take(5).map<Widget>((t) {
        final m = t as Map<String, dynamic>;
        final route =
            '${m['origin'] ?? '—'} → ${m['destination'] ?? '—'}';
        final date = _fmtDate(m['start_date'] ?? m['created_at']);
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: KTColors.darkSurface,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(route,
                        style: const TextStyle(
                            color: KTColors.darkTextPrimary, fontSize: 13)),
                    Text(date,
                        style: const TextStyle(
                            color: KTColors.darkTextSecondary, fontSize: 11)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right,
                  color: KTColors.darkTextSecondary, size: 18),
            ],
          ),
        );
      }).toList(),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _statusPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
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

  Widget _actionBtn(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 14)),
          ],
        ),
      ),
    );
  }

  String _fmtDate(dynamic val) {
    if (val == null) return '—';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(val.toString()));
    } catch (_) {
      return val.toString();
    }
  }

  num _safeNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse(v?.toString() ?? '') ?? 0;
  }
}

// ─── Compliance helper ──────────────────────────────────────────────────────

class _ComplianceItem {
  final String name;
  final dynamic _rawDate;

  _ComplianceItem(this.name, this._rawDate);

  DateTime? get _parsed {
    if (_rawDate == null) return null;
    return DateTime.tryParse(_rawDate.toString());
  }

  bool get isExpired {
    final d = _parsed;
    return d != null && d.isBefore(DateTime.now());
  }

  bool get isExpiringSoon {
    final d = _parsed;
    if (d == null) return false;
    final diff = d.difference(DateTime.now()).inDays;
    return diff >= 0 && diff <= 30;
  }

  String get dateStr {
    final d = _parsed;
    if (d == null) return '—';
    return DateFormat('dd MMM yyyy').format(d);
  }
}
