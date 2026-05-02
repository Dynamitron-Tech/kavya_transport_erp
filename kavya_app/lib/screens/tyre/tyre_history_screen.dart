import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);

// ─── Provider ─────────────────────────────────────────────────────────────────

final tyreReadingsHistoryProvider =
    FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);

  // Fetch readings, inspection flags and retread flags in parallel
  final results = await Future.wait([
    api.get('/tyre/readings', queryParameters: {'limit': 50}),
    api.get('/tyre/inspection-flags'),
    api.get('/tyre/retread-flags'),
  ]);

  // Parse readings
  final readingsRes = results[0];
  final readingsData = (readingsRes is Map) ? (readingsRes['data'] ?? readingsRes) : readingsRes;
  List readingItems = [];
  if (readingsData is Map) {
    final items = readingsData['items'];
    readingItems = (items is List) ? items : [];
  } else if (readingsData is List) {
    readingItems = readingsData;
  }

  // Parse inspection flag events
  final flagsRes = results[1];
  final flagsData = (flagsRes is Map) ? (flagsRes['data'] ?? flagsRes) : flagsRes;
  List flagItems = [];
  if (flagsData is Map) {
    final items = flagsData['items'];
    if (items is List) {
      for (final f in items) {
        flagItems.add({
          '_type': 'flag',
          'vehicle_number': f['vehicle_number'] ?? '—',
          'tyre_number': f['tyre_number'] ?? '',
          'position': f['position'] ?? '',
          'notes': f['notes'] ?? '',
          'created_at': f['created_at'],
        });
      }
    }
  }

  // Parse retread flag events
  final retreadRes = results[2];
  final retreadData = (retreadRes is Map) ? (retreadRes['data'] ?? retreadRes) : retreadRes;
  List retreadItems = [];
  if (retreadData is Map) {
    final items = retreadData['items'];
    if (items is List) {
      for (final r in items) {
        retreadItems.add({
          '_type': 'retread',
          'tyre_number': r['tyre_number'] ?? '—',
          'manufacturer_serial': r['manufacturer_serial'] ?? '',
          'brand': r['brand'] ?? '',
          'size': r['size'] ?? '',
          'life_pct': r['life_pct'] ?? 0,
          'notes': r['notes'] ?? '',
          'created_at': r['created_at'],
        });
      }
    }
  }

  // Merge and sort by created_at descending
  final all = [...readingItems, ...flagItems, ...retreadItems];
  all.sort((a, b) {
    final aDate = (a is Map ? a['created_at'] : null) as String? ?? '';
    final bDate = (b is Map ? b['created_at'] : null) as String? ?? '';
    return bDate.compareTo(aDate);
  });
  return all;
});

// ─── Screen ───────────────────────────────────────────────────────────────────

class TyreHistoryScreen extends ConsumerWidget {
  const TyreHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(tyreReadingsHistoryProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: historyAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger),
              const SizedBox(height: 8),
              Text('Failed to load history',
                  style: KTTextStyles.body
                      .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
              TextButton(
                onPressed: () => ref.invalidate(tyreReadingsHistoryProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.history_rounded, color: KTColors.textMuted, size: 40),
                  const SizedBox(height: 10),
                  Text(
                    'No readings recorded yet',
                    style: KTTextStyles.body.copyWith(
                        color: KTColors.textMuted, decoration: TextDecoration.none),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: _accent,
            onRefresh: () async => ref.invalidate(tyreReadingsHistoryProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = items[index] as Map;
                if (item['_type'] == 'flag') {
                  return _FlagCard(item: item);
                }
                if (item['_type'] == 'retread') {
                  return _RetreadFlagCard(item: item);
                }
                return _ReadingCard(item: item);
              },
            ),
          );
        },
      ),
    );
  }
}

// ─── Reading card ─────────────────────────────────────────────────────────────

class _ReadingCard extends StatelessWidget {
  final Map item;

  const _ReadingCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final condition = item['condition'] as String? ?? 'GOOD';
    final color = _colorForCondition(condition);
    final icon = _iconForCondition(condition);
    final psi = (item['psi'] as num?)?.toDouble() ?? 0;
    final tread = item['tread_depth_mm'] as num?;
    final pos = _posLabel(item['position'] as String? ?? '');
    final vehicleReg = item['vehicle_number'] as String? ?? '—';
    final date = _formatDate(item['created_at'] as String?);
    final driverName = item['driver_name'] as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      vehicleReg,
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.none,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        condition,
                        style: TextStyle(
                            color: color,
                            fontSize: 10,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '$pos · PSI: ${psi.toStringAsFixed(0)}'
                  '${tread != null ? ' · Tread: ${tread.toStringAsFixed(1)} mm' : ''}',
                  style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted, decoration: TextDecoration.none),
                ),
                if (driverName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'By $driverName',
                    style: KTTextStyles.labelSmall.copyWith(
                        color: KTColors.textMuted, decoration: TextDecoration.none),
                  ),
                ],
              ],
            ),
          ),
          Text(
            date,
            style: KTTextStyles.labelSmall
                .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }

  static String _posLabel(String pos) {
    const labels = {
      '1L0': 'Steer L',
      '1R0': 'Steer R',
      '2L0': 'Drive L-Out',
      '2L1': 'Drive L-In',
      '2R1': 'Drive R-In',
      '2R0': 'Drive R-Out',
      '3L0': 'Rear L-Out',
      '3L1': 'Rear L-In',
      '3R1': 'Rear R-In',
      '3R0': 'Rear R-Out',
    };
    return labels[pos] ?? pos;
  }

  static Color _colorForCondition(String c) {
    switch (c.toUpperCase()) {
      case 'WORN':
      case 'DAMAGED':
        return KTColors.danger;
      case 'AVERAGE':
        return KTColors.warning;
      default:
        return _accent;
    }
  }

  static IconData _iconForCondition(String c) {
    switch (c.toUpperCase()) {
      case 'WORN':
        return Icons.tire_repair_rounded;
      case 'DAMAGED':
        return Icons.warning_amber_rounded;
      case 'AVERAGE':
        return Icons.compress_rounded;
      default:
        return Icons.fact_check_outlined;
    }
  }

  static String _formatDate(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year &&
          dt.month == now.month &&
          dt.day == now.day) {
        return 'Today';
      }
      final months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[dt.month]} ${dt.day}';
    } catch (_) {
      return '—';
    }
  }
}

// ─── Retread Flag card ────────────────────────────────────────────────────────

class _RetreadFlagCard extends StatelessWidget {
  final Map item;

  const _RetreadFlagCard({required this.item});

  static const _purple = Color(0xFF7C3AED);

  @override
  Widget build(BuildContext context) {
    final tyreNumber = item['tyre_number'] as String? ?? '—';
    final serial = (item['manufacturer_serial'] as String? ?? '').trim();
    final date = _formatDate(item['created_at'] as String?);
    final title = serial.isNotEmpty
        ? 'Tyre $serial is flagged for Retreading - $tyreNumber'
        : 'Tyre $tyreNumber is flagged for Retreading';
    final notes = item['notes'] as String? ?? '';
    final brand = item['brand'] as String? ?? '';
    final size = item['size'] as String? ?? '';
    final sub = [brand, size].where((s) => s.isNotEmpty).join(' · ');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _purple.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: _purple.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.autorenew_rounded, color: _purple, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: KTTextStyles.body.copyWith(
                    color: _purple,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                if (sub.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    sub,
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ],
                if (notes.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    notes,
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Text(
            date,
            style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }

  static String _formatDate(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
        return 'Today';
      }
      const months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[dt.month]} ${dt.day}';
    } catch (_) {
      return '—';
    }
  }
}


class _FlagCard extends StatelessWidget {
  final Map item;

  const _FlagCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final vehicleReg = item['vehicle_number'] as String? ?? '—';
    final date = _formatDate(item['created_at'] as String?);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDC2626).withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: const Color(0xFFDC2626).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.flag_rounded,
                color: Color(0xFFDC2626), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Truck $vehicleReg Requires Inspection',
                  style: KTTextStyles.body.copyWith(
                    color: const Color(0xFFDC2626),
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item['notes'] as String? ?? '',
                  style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textMuted,
                    decoration: TextDecoration.none,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            date,
            style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textMuted, decoration: TextDecoration.none),
          ),
        ],
      ),
    );
  }

  static String _formatDate(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year &&
          dt.month == now.month &&
          dt.day == now.day) {
        return 'Today';
      }
      final months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[dt.month]} ${dt.day}';
    } catch (_) {
      return '—';
    }
  }
}
