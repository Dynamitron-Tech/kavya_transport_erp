import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);

// ─── Health helpers ────────────────────────────────────────────────────────────

const double _newTyreDepth = 18.0;

enum _Health { good, warning, risk, critical, unknown }

_Health _classifyTread(double? mm) {
  if (mm == null) return _Health.unknown;
  if (mm >= 10) return _Health.good;
  if (mm >= 6) return _Health.warning;
  if (mm >= 3) return _Health.risk;
  return _Health.critical;
}

/// 6-tier color based on life %
Color _lifeColor(int lifePercent) {
  if (lifePercent >= 90) return const Color(0xFF16A34A); // Green
  if (lifePercent >= 70) return const Color(0xFF4ADE80); // Light Green
  if (lifePercent >= 50) return const Color(0xFF84CC16); // Lime Green
  if (lifePercent >= 30) return const Color(0xFFEAB308); // Dark Yellow
  if (lifePercent >= 10) return const Color(0xFFF97316); // Orange
  return const Color(0xFFDC2626); // Red
}

String _lifeLabel(int lifePercent) {
  if (lifePercent >= 90) return 'Excellent';
  if (lifePercent >= 70) return 'Good';
  if (lifePercent >= 50) return 'Fair';
  if (lifePercent >= 30) return 'Worn';
  if (lifePercent >= 10) return 'Poor';
  return 'Critical';
}

Color _healthColor(_Health h) {
  switch (h) {
    case _Health.good:
      return const Color(0xFF16A34A);
    case _Health.warning:
      return const Color(0xFFEAB308);
    case _Health.risk:
      return const Color(0xFFF97316);
    case _Health.critical:
      return const Color(0xFFDC2626);
    case _Health.unknown:
      return KTColors.textMuted;
  }
}

int _lifePercent(double? mm) {
  if (mm == null) return 0;
  return ((mm / _newTyreDepth) * 100).round().clamp(0, 100);
}

/// Smart Alert: combines tread depth + pressure
String _smartAlertFull(double? tread, double? pressure) {
  final h = _classifyTread(tread);
  final lowPressure = pressure != null && pressure < 80;
  final highPressure = pressure != null && pressure > 130;
  final normalPressure = pressure != null && !lowPressure && !highPressure;

  if ((h == _Health.critical || h == _Health.risk) && lowPressure) {
    return 'Critical danger – low tread & low pressure';
  }
  if ((h == _Health.critical || h == _Health.risk) && highPressure) {
    return 'Uneven wear risk – low tread & high pressure';
  }
  if (h == _Health.critical) return 'Replace immediately';
  if (h == _Health.risk) return 'Schedule replacement';
  if ((h == _Health.good || h == _Health.warning) && lowPressure) {
    return 'Maintenance needed – low pressure';
  }
  if (h == _Health.warning) return 'Monitor closely';
  if (h == _Health.good && normalPressure) return 'Healthy';
  if (h == _Health.good) return 'Healthy';
  return 'No data';
}

/// Overall vehicle health from all tyres
String _vehicleHealthLabel(List<Map<String, dynamic>> tyres) {
  if (tyres.isEmpty) return 'No tyres';
  _Health worst = _Health.good;
  for (final t in tyres) {
    final tread = (t['tread_depth_mm'] as num?)?.toDouble();
    final h = _classifyTread(tread);
    if (h.index > worst.index) worst = h;
  }
  switch (worst) {
    case _Health.good:
      return 'Healthy';
    case _Health.warning:
      return 'Attention';
    case _Health.risk:
      return 'Risk';
    case _Health.critical:
      return 'Unsafe';
    case _Health.unknown:
      return 'Unknown';
  }
}

Color _vehicleHealthColor(List<Map<String, dynamic>> tyres) {
  if (tyres.isEmpty) return KTColors.textMuted;
  _Health worst = _Health.good;
  for (final t in tyres) {
    final tread = (t['tread_depth_mm'] as num?)?.toDouble();
    final h = _classifyTread(tread);
    if (h.index > worst.index) worst = h;
  }
  return _healthColor(worst);
}

// ─── Axle layout definitions ──────────────────────────────────────────────────

/// Each axle is a list of (leftPositions, rightPositions).
/// Single = ["1L0"], Dual = ["2L0","2L1"]
typedef _AxleSpec = List<_AxleDef>;

class _AxleDef {
  final String label; // e.g. "Axle 1 – Steering"
  final List<String> left;
  final List<String> right;
  const _AxleDef(this.label, this.left, this.right);
}

_AxleSpec _axleLayout(String type) {
  switch (type.toLowerCase().replaceAll('-', '_')) {
    case '4w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Drive', ['2L0'], ['2R0']),
      ];
    case '6w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Drive', ['2L0', '2L1'], ['2R0', '2R1']),
      ];
    case '10w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Drive', ['2L0', '2L1'], ['2R0', '2R1']),
        _AxleDef('Axle 3 – Drive', ['3L0', '3L1'], ['3R0', '3R1']),
      ];
    case '12w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0', '1L1'], ['1R0', '1R1']),
        _AxleDef('Axle 2 – Drive', ['2L0', '2L1'], ['2R0', '2R1']),
        _AxleDef('Axle 3 – Drive', ['3L0', '3L1'], ['3R0', '3R1']),
      ];
    case '14w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Steering', ['2L0'], ['2R0']),
        _AxleDef('Axle 3 – Lift', ['3L0'], ['3R0']),
        _AxleDef('Axle 4 – Drive', ['4L0', '4L1'], ['4R0', '4R1']),
        _AxleDef('Axle 5 – Drive', ['5L0', '5L1'], ['5R0', '5R1']),
      ];
    case 'tr_6w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Drive', ['2L0', '2L1'], ['2R0', '2R1']),
      ];
    case 'tr_10w':
      return const [
        _AxleDef('Axle 1 – Steering', ['1L0'], ['1R0']),
        _AxleDef('Axle 2 – Drive', ['2L0', '2L1'], ['2R0', '2R1']),
        _AxleDef('Axle 3 – Drive', ['3L0', '3L1'], ['3R0', '3R1']),
      ];
    default:
      return const [
        _AxleDef('Axle 1', ['1L0'], ['1R0']),
        _AxleDef('Axle 2', ['2L0'], ['2R0']),
      ];
  }
}

bool _isTractor(String type) {
  final t = type.toLowerCase().replaceAll('-', '_');
  return t.startsWith('tr');
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final vehicleTyresProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
        (ref, vehicleId) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/tyre', queryParameters: {
    'vehicle_id': vehicleId,
    'limit': 50,
  });
  final data = (res is Map) ? (res['data'] ?? res) : res;
  if (data is Map) {
    final items = data['items'];
    return (items is List)
        ? items.cast<Map<String, dynamic>>()
        : <Map<String, dynamic>>[];
  }
  if (data is List) return data.cast<Map<String, dynamic>>();
  return <Map<String, dynamic>>[];
});

// ─── Screen ───────────────────────────────────────────────────────────────────

class TyreVehicleDetailScreen extends ConsumerWidget {
  final int vehicleId;
  final String registrationNumber;
  final String axleWheelType;
  final String source;

  const TyreVehicleDetailScreen({
    super.key,
    required this.vehicleId,
    required this.registrationNumber,
    required this.axleWheelType,
    this.source = 'vehicles',
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tyresAsync = ref.watch(vehicleTyresProvider(vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(color: KTColors.textHeading),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              registrationNumber,
              style: const TextStyle(
                color: KTColors.textHeading,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            Text(
              axleWheelType.toUpperCase(),
              style: const TextStyle(
                color: KTColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: _accent),
            onPressed: () => ref.invalidate(vehicleTyresProvider(vehicleId)),
          ),
        ],
      ),
      body: tyresAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 36),
              const SizedBox(height: 8),
              Text(
                'Failed to load tyres',
                style: KTTextStyles.body.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none,
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () =>
                    ref.invalidate(vehicleTyresProvider(vehicleId)),
                child: const Text('Retry', style: TextStyle(color: _accent)),
              ),
            ],
          ),
        ),
        data: (tyres) => _VehicleTyreBody(
          vehicleId: vehicleId,
          axleWheelType: axleWheelType,
          tyres: tyres,
          source: source,
        ),
      ),
    );
  }
}

// ─── Body with diagram + status ───────────────────────────────────────────────

class _VehicleTyreBody extends ConsumerStatefulWidget {
  final int vehicleId;
  final String axleWheelType;
  final List<Map<String, dynamic>> tyres;
  final String source;

  const _VehicleTyreBody({
    required this.vehicleId,
    required this.axleWheelType,
    required this.tyres,
    this.source = 'vehicles',
  });

  @override
  ConsumerState<_VehicleTyreBody> createState() => _VehicleTyreBodyState();
}

class _VehicleTyreBodyState extends ConsumerState<_VehicleTyreBody> {
  String? _selectedPosition;

  Map<String, Map<String, dynamic>> _tyreMap() {
    final m = <String, Map<String, dynamic>>{};
    for (final t in widget.tyres) {
      final pos =
          (t['position'] ?? t['axle_position'] ?? '').toString().toUpperCase();
      if (pos.isNotEmpty) m[pos] = t;
    }
    return m;
  }

  @override
  Widget build(BuildContext context) {
    final map = _tyreMap();
    final layout = _axleLayout(widget.axleWheelType);
    final isTractor = _isTractor(widget.axleWheelType);
    final selectedData = _selectedPosition != null
        ? map[_selectedPosition!.toUpperCase()]
        : null;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      child: Column(
        children: [
          // ── Tyre Diagram ───────────────────────────────────────
          _TyreDiagram(
            layout: layout,
            tyreMap: map,
            isTractor: isTractor,
            selectedPosition: _selectedPosition,
            onTyreTap: (pos, data) {
              setState(() {
                _selectedPosition =
                    _selectedPosition == pos ? null : pos;
              });
            },
          ),
          const SizedBox(height: 16),

          // ── Legend ─────────────────────────────────────────────
          const _Legend(),
          const SizedBox(height: 20),

          // ── Tyre Detail Panel (shown when a tyre is tapped) ───
          if (_selectedPosition != null)
            _TyreDetailPanel(
              position: _selectedPosition!,
              data: selectedData,
              allTyres: widget.tyres,
              vehicleId: widget.vehicleId,
              source: widget.source,
              onTyreAllocated: () {
                ref.invalidate(vehicleTyresProvider(widget.vehicleId));
                setState(() => _selectedPosition = null);
              },
            ),
        ],
      ),
    );
  }
}

// ─── Tyre Diagram Widget ──────────────────────────────────────────────────────

class _TyreDiagram extends StatelessWidget {
  final _AxleSpec layout;
  final Map<String, Map<String, dynamic>> tyreMap;
  final bool isTractor;
  final String? selectedPosition;
  final void Function(String position, Map<String, dynamic>? data) onTyreTap;

  const _TyreDiagram({
    required this.layout,
    required this.tyreMap,
    required this.isTractor,
    required this.onTyreTap,
    this.selectedPosition,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isTractor
                    ? Icons.agriculture_rounded
                    : Icons.local_shipping_rounded,
                color: _accent,
                size: 20,
              ),
              const SizedBox(width: 6),
              Text(
                'Tyre Layout',
                style: KTTextStyles.body.copyWith(
                  fontWeight: FontWeight.w700,
                  color: KTColors.textHeading,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isTractor ? 'Tractor Head' : 'Vehicle',
            style: KTTextStyles.labelSmall.copyWith(
              color: KTColors.textMuted,
              decoration: TextDecoration.none,
            ),
          ),
          const SizedBox(height: 16),

          // Vehicle body outline
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
            decoration: BoxDecoration(
              color: KTColors.lightBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: [
                // ── FRONT arrow ──
                const Icon(Icons.keyboard_arrow_up_rounded,
                    color: KTColors.textMuted, size: 20),
                Text(
                  'FRONT',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textMuted,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),

                // ── Axles ──
                for (int i = 0; i < layout.length; i++) ...[
                  if (i > 0) _AxleSeparator(),
                  _AxleRow(
                    axle: layout[i],
                    tyreMap: tyreMap,
                    onTyreTap: onTyreTap,
                    selectedPosition: selectedPosition,
                  ),
                ],

                const SizedBox(height: 12),
                Text(
                  'REAR',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textMuted,
                    letterSpacing: 1.2,
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded,
                    color: KTColors.textMuted, size: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Axle separator (dashed line) ─────────────────────────────────────────────

class _AxleSeparator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Container(height: 1, color: KTColors.borderColor),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: KTColors.borderColor,
              ),
            ),
          ),
          Expanded(
            child: Container(height: 1, color: KTColors.borderColor),
          ),
        ],
      ),
    );
  }
}

// ─── Axle row ─────────────────────────────────────────────────────────────────

class _AxleRow extends StatelessWidget {
  final _AxleDef axle;
  final Map<String, Map<String, dynamic>> tyreMap;
  final void Function(String position, Map<String, dynamic>? data) onTyreTap;
  final String? selectedPosition;

  const _AxleRow({
    required this.axle,
    required this.tyreMap,
    required this.onTyreTap,
    this.selectedPosition,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Axle label
        Text(
          axle.label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: KTColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        // Left side | axle bar | Right side
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Left tyres
            _TyreSideGroup(
              positions: axle.left,
              tyreMap: tyreMap,
              onTyreTap: onTyreTap,
              isLeft: true,
              selectedPosition: selectedPosition,
            ),

            // Axle bar
            Container(
              width: 60,
              height: 3,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: KTColors.textMuted.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Right tyres
            _TyreSideGroup(
              positions: axle.right,
              tyreMap: tyreMap,
              onTyreTap: onTyreTap,
              isLeft: false,
              selectedPosition: selectedPosition,
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Tyre side group (single or dual) ─────────────────────────────────────────

class _TyreSideGroup extends StatelessWidget {
  final List<String> positions;
  final Map<String, Map<String, dynamic>> tyreMap;
  final void Function(String position, Map<String, dynamic>? data) onTyreTap;
  final bool isLeft;
  final String? selectedPosition;

  const _TyreSideGroup({
    required this.positions,
    required this.tyreMap,
    required this.onTyreTap,
    required this.isLeft,
    this.selectedPosition,
  });

  @override
  Widget build(BuildContext context) {
    final ordered = isLeft ? positions.reversed.toList() : positions;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 0; i < ordered.length; i++) ...[
          if (i > 0) const SizedBox(width: 3),
          _TyreBox(
            position: ordered[i],
            data: tyreMap[ordered[i].toUpperCase()],
            isSelected: selectedPosition?.toUpperCase() ==
                ordered[i].toUpperCase(),
            onTap: () =>
                onTyreTap(ordered[i], tyreMap[ordered[i].toUpperCase()]),
          ),
        ],
      ],
    );
  }
}

// ─── Single tyre box ──────────────────────────────────────────────────────────

class _TyreBox extends StatelessWidget {
  final String position;
  final Map<String, dynamic>? data;
  final bool isSelected;
  final VoidCallback onTap;

  const _TyreBox({
    required this.position,
    required this.data,
    required this.onTap,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final tread = (data?['tread_depth_mm'] as num?)?.toDouble();
    final life = _lifePercent(tread);
    final hasData = data != null;
    final color = hasData ? _lifeColor(life) : const Color(0xFF4A4A4A);
    final tyreNumber = data?['serial_number']?.toString() ?? '';

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 56,
        height: 78,
        decoration: BoxDecoration(
          color: hasData ? color : const Color(0xFF4A4A4A),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? Colors.white
                : hasData
                    ? color.withValues(alpha: 0.8)
                    : const Color(0xFF4A4A4A),
            width: isSelected ? 2.5 : 1.5,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.5),
                    blurRadius: 8,
                    spreadRadius: 1,
                  )
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Position label
            Text(
              position.toUpperCase(),
              style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 0.5,
              ),
            ),
            if (hasData) ...[
              const SizedBox(height: 1),
              // Tyre number (KTT###)
              if (tyreNumber.isNotEmpty)
                Text(
                  tyreNumber,
                  style: const TextStyle(
                    fontSize: 7,
                    fontWeight: FontWeight.w600,
                    color: Colors.white70,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: 1),
              // Life %
              Text(
                '$life%',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ] else ...[
              const SizedBox(height: 6),
              const Icon(Icons.remove_rounded, size: 14, color: Colors.white),
              const SizedBox(height: 2),
              const Text(
                'Empty',
                style: TextStyle(
                  fontSize: 8,
                  color: Colors.white,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Legend ────────────────────────────────────────────────────────────────────

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        _LegendItem(color: _lifeColor(95), label: '90-100%'),
        _LegendItem(color: _lifeColor(80), label: '70-90%'),
        _LegendItem(color: _lifeColor(60), label: '50-70%'),
        _LegendItem(color: _lifeColor(40), label: '30-50%'),
        _LegendItem(color: _lifeColor(20), label: '10-30%'),
        _LegendItem(color: _lifeColor(5), label: '0-10%'),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: KTColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ─── Tyre detail panel (shown inline below diagram) ───────────────────────────

class _TyreDetailPanel extends StatelessWidget {
  final String position;
  final Map<String, dynamic>? data;
  final List<Map<String, dynamic>> allTyres;
  final int vehicleId;
  final String source;
  final VoidCallback onTyreAllocated;

  const _TyreDetailPanel({
    required this.position,
    required this.data,
    required this.allTyres,
    required this.vehicleId,
    this.source = 'vehicles',
    required this.onTyreAllocated,
  });

  @override
  Widget build(BuildContext context) {
    if (data == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF4A4A4A),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                position.toUpperCase(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Icon(Icons.tire_repair_rounded,
                size: 36, color: KTColors.textMuted),
            const SizedBox(height: 8),
            Text(
              'No tyre fitted at this position',
              style: KTTextStyles.body.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showAllocateSheet(context),
                icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
                label: const Text('Allocate Tyre'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final tread = (data!['tread_depth_mm'] as num?)?.toDouble();
    final pressure = (data!['pressure_psi'] as num?)?.toDouble();
    final health = _classifyTread(tread);
    final life = _lifePercent(tread);
    final color = _lifeColor(life);
    final healthLabel = _lifeLabel(life);
    final alert = _smartAlertFull(tread, pressure);
    final vHealthLabel = _vehicleHealthLabel(allTyres);
    final vHealthColor = _vehicleHealthColor(allTyres);
    final serial = data!['serial_number'] ?? data!['tyre_number'] ?? '—';
    final manufacturerSerial = (data!['manufacturer_serial'] ?? '').toString();
    final brand = data!['brand'] ?? '—';
    final size = data!['size'] ?? data!['model'] ?? '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: position badge + serial + brand
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  position.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      serial.toString(),
                      style: KTTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none,
                      ),
                    ),
                    Text(
                      '$brand${size.toString().isNotEmpty ? ' · $size' : ''}',
                      style: KTTextStyles.labelSmall.copyWith(
                        color: KTColors.textSecondary,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 4 detail fields
          _DetailField(
            icon: Icons.favorite_rounded,
            label: 'Tyre Health',
            value: tread != null
                ? '${tread.toStringAsFixed(1)} mm — ${_classifyTreadLabel(health)}'
                : 'No data',
            valueColor: _healthColor(health),
          ),
          const SizedBox(height: 10),

          _DetailField(
            icon: Icons.speed_rounded,
            label: 'Tyre Life',
            value: '$life% — $healthLabel',
            valueColor: color,
            trailing: _LifeBar(percent: life, color: color),
          ),
          const SizedBox(height: 10),

          _DetailField(
            icon: Icons.notifications_active_rounded,
            label: 'Tyre Status (Smart Alert)',
            value: alert,
            valueColor: _healthColor(health),
          ),
          const SizedBox(height: 10),

          if (manufacturerSerial.isNotEmpty) ...[
            _DetailField(
              icon: Icons.numbers_rounded,
              label: 'Serial Number',
              value: manufacturerSerial,
              valueColor: KTColors.textHeading,
            ),
            const SizedBox(height: 10),
          ],

          _DetailField(
            icon: Icons.local_shipping_rounded,
            label: 'Overall Vehicle Tyre Health',
            value: vHealthLabel,
            valueColor: vHealthColor,
          ),

          const SizedBox(height: 16),

          // ── Action buttons (only in Vehicles tab) ──
          if (source == 'vehicles') ...[
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    icon: Icons.straighten_rounded,
                    label: 'Update\nTread Depth',
                    onTap: () => _showUpdateTreadDialog(context),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.speed_rounded,
                    label: 'Update\nTyre Pressure',
                    onTap: () => _showUpdatePressureDialog(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: _ActionButton(
                icon: Icons.flag_rounded,
                label: 'Flag for Inspection',
                onTap: () => _showFlagInspectionConfirm(context),
                color: const Color(0xFFDC2626),
              ),
            ),
          ],
          // ── Remove Tyre button (only in Inspections tab) ──
          if (source == 'inspections') ...[
            SizedBox(
              width: double.infinity,
              child: _ActionButton(
                icon: Icons.remove_circle_outline_rounded,
                label: 'Remove Tyre',
                onTap: () => _showRemoveTyreConfirm(context),
                color: const Color(0xFFDC2626),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showUpdateTreadDialog(BuildContext context) {
    final tread = (data!['tread_depth_mm'] as num?)?.toDouble();
    final ctrl = TextEditingController(
        text: tread != null ? tread.toStringAsFixed(1) : '');
    final tyreId = data!['id'] as int;

    showDialog(
      context: context,
      builder: (ctx) => _UpdateValueDialog(
        title: 'Update Tread Depth',
        subtitle: '${data!['serial_number'] ?? ''} — ${position.toUpperCase()}',
        fieldLabel: 'Tread Depth (mm)',
        hint: 'e.g. 14.5',
        controller: ctrl,
        icon: Icons.straighten_rounded,
        onSave: (value) async {
          final nav = Navigator.of(ctx);
          final api = ProviderScope.containerOf(context).read(apiServiceProvider);
          await api.put('/tyre/$tyreId', data: {
            'tread_depth_mm': double.parse(value),
          });
          nav.pop();
          onTyreAllocated();
        },
      ),
    );
  }

  void _showUpdatePressureDialog(BuildContext context) {
    final psi = (data!['pressure_psi'] as num?)?.toDouble() ??
        (data!['last_psi'] as num?)?.toDouble();
    final ctrl =
        TextEditingController(text: psi != null ? psi.toStringAsFixed(0) : '');
    final tyreId = data!['id'] as int;

    showDialog(
      context: context,
      builder: (ctx) => _UpdateValueDialog(
        title: 'Update Tyre Pressure',
        subtitle: '${data!['serial_number'] ?? ''} — ${position.toUpperCase()}',
        fieldLabel: 'Pressure (PSI)',
        hint: 'e.g. 110',
        controller: ctrl,
        icon: Icons.speed_rounded,
        onSave: (value) async {
          final nav = Navigator.of(ctx);
          final api = ProviderScope.containerOf(context).read(apiServiceProvider);
          await api.put('/tyre/$tyreId', data: {
            'pressure_psi': double.parse(value),
          });
          nav.pop();
          onTyreAllocated();
        },
      ),
    );
  }

  void _showFlagInspectionConfirm(BuildContext context) {
    final tyreId = data!['id'] as int;
    final serial = data!['serial_number'] ?? '';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: Row(
          children: [
            Icon(Icons.flag_rounded, color: const Color(0xFFDC2626), size: 22),
            const SizedBox(width: 8),
            const Text('Flag for Inspection',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ],
        ),
        content: Text(
          'Flag tyre $serial at position ${position.toUpperCase()} for inspection?',
          style: const TextStyle(fontSize: 14, color: KTColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: KTColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final nav = Navigator.of(ctx);
              final scaffold = ScaffoldMessenger.of(context);
              try {
                final api =
                    ProviderScope.containerOf(context).read(apiServiceProvider);
                await api.post('/tyre/flag-inspection', data: {
                  'vehicle_id': vehicleId,
                  'tyre_id': tyreId,
                  'position': position,
                });
                nav.pop();
                scaffold.showSnackBar(
                  SnackBar(
                    content: Text('Flagged $serial for inspection'),
                    backgroundColor: const Color(0xFFDC2626),
                  ),
                );
              } catch (e) {
                nav.pop();
                scaffold.showSnackBar(
                  SnackBar(
                    content: Text('Failed to flag: $e'),
                    backgroundColor: KTColors.danger,
                  ),
                );
              }
            },
            child: const Text('Flag'),
          ),
        ],
      ),
    );
  }

  void _showRemoveTyreConfirm(BuildContext context) {
    final tyreId = data!['id'] as int;
    final serial = data!['serial_number'] ?? '';
    final tread = (data!['tread_depth_mm'] as num?)?.toDouble() ?? 0.0;
    final lifePct = (tread / 18.0) * 100.0;
    final goesToStock = lifePct >= 40.0;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: Row(
          children: [
            Icon(Icons.remove_circle_outline_rounded,
                color: const Color(0xFFDC2626), size: 22),
            const SizedBox(width: 8),
            const Text('Remove Tyre',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ],
        ),
        content: Text(
          goesToStock
              ? 'Remove tyre $serial from position ${position.toUpperCase()}?\n\nLife is ${lifePct.toStringAsFixed(0)}% — the tyre will be returned to New inventory.'
              : 'Remove tyre $serial from position ${position.toUpperCase()}?\n\nLife is ${lifePct.toStringAsFixed(0)}% — the tyre will be marked as removed.',
          style: const TextStyle(fontSize: 14, color: KTColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: KTColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              minimumSize: Size.zero,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final nav = Navigator.of(ctx);
              final scaffold = ScaffoldMessenger.of(context);
              try {
                final api = ProviderScope.containerOf(context)
                    .read(apiServiceProvider);
                await api.patch('/tyre/$tyreId/remove');
                nav.pop();
                scaffold.showSnackBar(
                  SnackBar(
                    content: Text(goesToStock
                        ? 'Tyre removed and returned to New inventory'
                        : 'Tyre removed from vehicle'),
                    backgroundColor: goesToStock
                        ? const Color(0xFF0F766E)
                        : const Color(0xFFDC2626),
                  ),
                );
                onTyreAllocated(); // refreshes the diagram
              } catch (e) {
                nav.pop();
                scaffold.showSnackBar(
                  SnackBar(
                    content: Text('Failed to remove tyre: $e'),
                    backgroundColor: KTColors.danger,
                  ),
                );
              }
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }

  void _showAllocateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _AllocateTyreSheet(
        vehicleId: vehicleId,
        position: position,
        onAllocated: () {
          Navigator.of(context).pop();
          onTyreAllocated();
        },
      ),
    );
  }

  String _classifyTreadLabel(_Health h) {
    switch (h) {
      case _Health.good:
        return 'Good';
      case _Health.warning:
        return 'Warning';
      case _Health.risk:
        return 'Risk';
      case _Health.critical:
        return 'Critical';
      case _Health.unknown:
        return 'Unknown';
    }
  }
}

// ─── Detail field row ─────────────────────────────────────────────────────────

class _DetailField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;
  final Widget? trailing;

  const _DetailField({
    required this.icon,
    required this.label,
    required this.value,
    required this.valueColor,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: valueColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: valueColor.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: valueColor),
              const SizedBox(width: 6),
              Text(
                label,
                style: KTTextStyles.labelSmall.copyWith(
                  color: KTColors.textMuted,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: valueColor,
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(height: 6),
            trailing!,
          ],
        ],
      ),
    );
  }
}

// ─── Life bar ─────────────────────────────────────────────────────────────────

class _LifeBar extends StatelessWidget {
  final int percent;
  final Color color;
  const _LifeBar({required this.percent, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 6,
      decoration: BoxDecoration(
        color: KTColors.borderColor,
        borderRadius: BorderRadius.circular(3),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: (percent / 100).clamp(0.0, 1.0),
        child: Container(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
      ),
    );
  }
}

// ─── Action button ────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  const _ActionButton(
      {required this.icon, required this.label, required this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? _accent;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: c.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Icon(icon, color: c, size: 24),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: c,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Update value dialog ──────────────────────────────────────────────────────

class _UpdateValueDialog extends StatefulWidget {
  final String title;
  final String subtitle;
  final String fieldLabel;
  final String hint;
  final TextEditingController controller;
  final IconData icon;
  final Future<void> Function(String value) onSave;

  const _UpdateValueDialog({
    required this.title,
    required this.subtitle,
    required this.fieldLabel,
    required this.hint,
    required this.controller,
    required this.icon,
    required this.onSave,
  });

  @override
  State<_UpdateValueDialog> createState() => _UpdateValueDialogState();
}

class _UpdateValueDialogState extends State<_UpdateValueDialog> {
  bool _saving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(widget.icon, color: _accent, size: 28),
            ),
            const SizedBox(height: 12),
            Text(
              widget.title,
              style: KTTextStyles.body.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: KTColors.textHeading,
                decoration: TextDecoration.none,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.subtitle,
              style: KTTextStyles.labelSmall.copyWith(
                color: KTColors.textMuted,
                decoration: TextDecoration.none,
              ),
            ),
            const SizedBox(height: 16),
            // Input
            TextField(
              controller: widget.controller,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              autofocus: true,
              decoration: InputDecoration(
                labelText: widget.fieldLabel,
                hintText: widget.hint,
                filled: true,
                fillColor: KTColors.lightBg,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _accent, width: 1.5),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: const TextStyle(color: KTColors.danger, fontSize: 12)),
            ],
            const SizedBox(height: 20),
            // Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      side: BorderSide(
                          color: KTColors.textMuted.withValues(alpha: 0.3)),
                    ),
                    child: const Text('Cancel',
                        style: TextStyle(color: KTColors.textSecondary)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saving ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accent,
                      foregroundColor: Colors.white,
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSave() async {
    final val = widget.controller.text.trim();
    final parsed = double.tryParse(val);
    if (parsed == null || parsed < 0) {
      setState(() => _error = 'Enter a valid number');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(val);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to save';
          _saving = false;
        });
      }
    }
  }
}

// ─── Allocate Tyre Sheet ──────────────────────────────────────────────────────

class _AllocateTyreSheet extends ConsumerStatefulWidget {
  final int vehicleId;
  final String position;
  final VoidCallback onAllocated;

  const _AllocateTyreSheet({
    required this.vehicleId,
    required this.position,
    required this.onAllocated,
  });

  @override
  ConsumerState<_AllocateTyreSheet> createState() => _AllocateTyreSheetState();
}

class _AllocateTyreSheetState extends ConsumerState<_AllocateTyreSheet> {
  List<Map<String, dynamic>> _tyres = [];
  bool _loading = true;
  String? _error;
  String _search = '';
  bool _fitting = false;

  @override
  void initState() {
    super.initState();
    _loadStock();
  }

  Future<void> _loadStock() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res =
          await api.get('/tyre/stock', queryParameters: {'type': 'new'});
      final data = (res is Map) ? (res['data'] ?? res) : res;
      final items = (data is Map) ? (data['items'] ?? []) : data;
      setState(() {
        _tyres = (items is List)
            ? items.cast<Map<String, dynamic>>()
            : <Map<String, dynamic>>[];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load stock';
        _loading = false;
      });
    }
  }

  Future<void> _fitTyre(int tyreId) async {
    setState(() => _fitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.patch(
        '/tyre/$tyreId/fit?vehicle_id=${widget.vehicleId}&position=${Uri.encodeComponent(widget.position.toUpperCase())}',
      );
      if (mounted) widget.onAllocated();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to allocate tyre: $e'),
            backgroundColor: KTColors.danger,
          ),
        );
        setState(() => _fitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _search.isEmpty
        ? _tyres
        : _tyres.where((t) {
            final serial =
                (t['serial_number'] ?? '').toString().toLowerCase();
            final brand = (t['brand'] ?? '').toString().toLowerCase();
            final q = _search.toLowerCase();
            return serial.contains(q) || brand.contains(q);
          }).toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.65,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      builder: (context, scrollCtrl) {
        return Column(
          children: [
            // Handle
            const SizedBox(height: 8),
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: KTColors.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.inventory_2_rounded,
                      color: _accent, size: 22),
                  const SizedBox(width: 8),
                  Text(
                    'Allocate Tyre to ${widget.position.toUpperCase()}',
                    style: KTTextStyles.body.copyWith(
                      fontWeight: FontWeight.w700,
                      color: KTColors.textHeading,
                      decoration: TextDecoration.none,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Search
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                onChanged: (v) => setState(() => _search = v),
                decoration: InputDecoration(
                  hintText: 'Search by serial or brand...',
                  prefixIcon:
                      const Icon(Icons.search, color: KTColors.textMuted),
                  filled: true,
                  fillColor: KTColors.lightBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Content
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: _accent))
                  : _error != null
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!,
                                  style: KTTextStyles.body
                                      .copyWith(color: KTColors.textMuted)),
                              TextButton(
                                onPressed: _loadStock,
                                child: const Text('Retry',
                                    style: TextStyle(color: _accent)),
                              ),
                            ],
                          ),
                        )
                      : filtered.isEmpty
                          ? Center(
                              child: Text(
                                _search.isEmpty
                                    ? 'No tyres available in stock'
                                    : 'No matching tyres found',
                                style: KTTextStyles.body.copyWith(
                                  color: KTColors.textMuted,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            )
                          : ListView.separated(
                              controller: scrollCtrl,
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (ctx, i) {
                                final t = filtered[i];
                                return _StockTyreCard(
                                  data: t,
                                  fitting: _fitting,
                                  onFit: () => _fitTyre(t['id'] as int),
                                );
                              },
                            ),
            ),
          ],
        );
      },
    );
  }
}

// ─── Stock tyre card (in allocate sheet) ──────────────────────────────────────

class _StockTyreCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final bool fitting;
  final VoidCallback onFit;

  const _StockTyreCard({
    required this.data,
    required this.fitting,
    required this.onFit,
  });

  @override
  Widget build(BuildContext context) {
    final serial = data['serial_number'] ?? data['tyre_number'] ?? '—';
    final brand = data['brand'] ?? '—';
    final size = data['size'] ?? '';
    final condition = (data['condition'] ?? '').toString();
    final tread = (data['tread_depth_mm'] as num?)?.toDouble();
    final life = _lifePercent(tread);
    final color = tread != null ? _lifeColor(life) : KTColors.textMuted;
    final vehicleNo = data['vehicle_number'] ?? '';
    final currentPos = data['position'] ?? '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          // Tyre color indicator
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Icon(Icons.circle, size: 20, color: color),
            ),
          ),
          const SizedBox(width: 12),
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  serial.toString(),
                  style: KTTextStyles.body.copyWith(
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$brand${size.toString().isNotEmpty ? ' · $size' : ''}',
                  style: KTTextStyles.labelSmall.copyWith(
                    color: KTColors.textSecondary,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (tread != null)
                      Text(
                        '${tread.toStringAsFixed(1)}mm · $life%',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                    if (condition.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: KTColors.lightBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          condition,
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: KTColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (vehicleNo.toString().isNotEmpty)
                  Text(
                    'On $vehicleNo ($currentPos)',
                    style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textMuted,
                      decoration: TextDecoration.none,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
          ),
          // Fit button
          SizedBox(
            height: 36,
            child: ElevatedButton(
              onPressed: fitting ? null : onFit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _accent,
                foregroundColor: Colors.white,
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 12),
              ),
              child: fitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Fit'),
            ),
          ),
        ],
      ),
    );
  }
}
