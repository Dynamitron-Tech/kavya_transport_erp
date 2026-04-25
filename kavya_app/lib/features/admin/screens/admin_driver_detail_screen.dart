import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final _driverDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, driverId) async {
  final api = ref.read(apiServiceProvider);
  final resp = await api.get('/drivers/$driverId');
  if (resp is Map<String, dynamic> && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  if (resp is Map<String, dynamic>) return resp;
  return {};
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class AdminDriverDetailScreen extends ConsumerWidget {
  final String driverId;
  const AdminDriverDetailScreen({super.key, required this.driverId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_driverDetailProvider(driverId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: KTColors.textHeading),
          onPressed: () => context.pop(),
        ),
        title: const Text('Driver detail',
            style: TextStyle(color: KTColors.textHeading)),
      ),
      body: detail.when(
        data: (d) {
          if (d.isEmpty) {
            return const Center(
                child: Text('Driver not found',
                    style: TextStyle(color: KTColors.textMuted)));
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(_driverDetailProvider(driverId)),
            child: _body(context, ref, d),
          );
        },
        loading: () => const Center(
            child: CircularProgressIndicator(color: KTColors.primary)),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: KTColors.textMuted))),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, Map<String, dynamic> d) {
    final name =
        '${d['first_name'] ?? d['name'] ?? ''} ${d['last_name'] ?? ''}'.trim();
    final phone = d['phone'] as String? ?? '—';
    final licenseNo = d['license_number'] as String? ?? '—';
    final licenseExp = d['license_expiry'] as String?;
    final status = (d['status'] as String? ?? 'AVAILABLE').toUpperCase();
    final isAvail = status == 'AVAILABLE';

    // Performance stats
    final totalTrips = _safeNum(d['total_trips'] ?? d['trips_count']);
    final totalKm = _safeNum(d['total_km'] ?? d['distance_km']);
    final rating = _safeNum(d['rating'] ?? d['avg_rating']);

    // Current trip
    final currentTrip = d['current_trip'] as Map<String, dynamic>?;

    // Recent trips
    final recentTrips = d['recent_trips'] as List? ?? d['trips'] as List? ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Profile header ──
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: KTColors.amber600.withAlpha(30),
                child: Text(
                  name.isNotEmpty
                      ? name.substring(0, name.length.clamp(0, 2)).toUpperCase()
                      : '?',
                  style: const TextStyle(
                      color: KTColors.amber600,
                      fontWeight: FontWeight.bold,
                      fontSize: 22),
                ),
              ),
              const SizedBox(height: 10),
              Text(name,
                  style: const TextStyle(
                      color: KTColors.textHeading,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              _statusPill(isAvail ? 'Available' : status,
                  isAvail ? KTColors.success : KTColors.info),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Contact & License ──
        _card([
          _infoLine(Icons.phone_outlined, 'Phone', phone),
          _infoLine(Icons.badge_outlined, 'License', licenseNo),
          if (licenseExp != null)
            _infoLine(
                Icons.calendar_today,
                'License expiry',
                _fmtDate(licenseExp)),
        ]),
        const SizedBox(height: 16),

        // ── Performance ──
        _sectionHead('PERFORMANCE'),
        Row(children: [
          _statCard('$totalTrips', 'Trips', KTColors.info),
          const SizedBox(width: 10),
          _statCard('$totalKm km', 'Distance', KTColors.success),
          const SizedBox(width: 10),
          _statCard(rating > 0 ? rating.toStringAsFixed(1) : '—', 'Rating',
              KTColors.amber600),
        ]),
        const SizedBox(height: 16),

        // ── Current trip ──
        if (currentTrip != null) ...[
          _sectionHead('CURRENT TRIP'),
          GestureDetector(
            onTap: () {
              final tripId = currentTrip['id']?.toString();
              if (tripId != null) context.push('/admin/trips/$tripId');
            },
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.borderColor),
              ),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(width: 3, color: KTColors.info),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${currentTrip['origin'] ?? '—'} → ${currentTrip['destination'] ?? '—'}',
                              style: const TextStyle(
                                  color: KTColors.textHeading, fontSize: 13),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Vehicle: ${currentTrip['vehicle_registration'] ?? currentTrip['vehicle_number'] ?? '—'}',
                              style: const TextStyle(
                                  color: KTColors.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Recent trips ──
        if (recentTrips.isNotEmpty) ...[
          _sectionHead('RECENT TRIPS'),
          ...recentTrips.take(5).map<Widget>((t) {
            final m = t as Map<String, dynamic>;
            return GestureDetector(
              onTap: () {
                final tid = m['id']?.toString();
                if (tid != null) context.push('/admin/trips/$tid');
              },
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: KTColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: KTColors.borderColor),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${m['origin'] ?? '—'} → ${m['destination'] ?? '—'}',
                            style: const TextStyle(
                                color: KTColors.textHeading, fontSize: 13),
                          ),
                          Text(_fmtDate(m['start_date'] ?? m['created_at']),
                              style: const TextStyle(
                                  color: KTColors.textMuted,
                                  fontSize: 11)),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        color: KTColors.textMuted, size: 18),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // ── Quick actions ──
        Row(children: [
          Expanded(
            child: _actionBtn('Call', Icons.phone, KTColors.success,
                () => _launchPhone(phone)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _actionBtn('Message', Icons.message, KTColors.info,
                () => _launchSms(phone)),
          ),
        ]),
        const SizedBox(height: 30),
      ],
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _card(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _infoLine(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: KTColors.textMuted, size: 16),
          const SizedBox(width: 8),
          SizedBox(
            width: 100,
            child: Text(label,
                style: const TextStyle(
                    color: KTColors.textMuted, fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    color: KTColors.textBody, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String value, String label, Color color) {
    return Expanded(
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
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
                              color: KTColors.textHeading,
                              fontSize: 18,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(label,
                          style: const TextStyle(
                              color: KTColors.textMuted, fontSize: 11)),
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
                color: KTColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );

  Widget _actionBtn(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
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

  void _launchPhone(String phone) {
    if (phone == '—') return;
    launchUrl(Uri(scheme: 'tel', path: phone));
  }

  void _launchSms(String phone) {
    if (phone == '—') return;
    launchUrl(Uri(scheme: 'sms', path: phone));
  }
}
