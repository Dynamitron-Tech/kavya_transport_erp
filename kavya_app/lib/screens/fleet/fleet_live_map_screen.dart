import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/live_tracking_provider.dart';
import '../../services/api_service.dart';

class FleetLiveMapScreen extends ConsumerStatefulWidget {
  const FleetLiveMapScreen({super.key});

  @override
  ConsumerState<FleetLiveMapScreen> createState() => _FleetLiveMapScreenState();
}

class _FleetLiveMapScreenState extends ConsumerState<FleetLiveMapScreen> {
  static const _tn = LatLng(11.1271, 78.6569);
  static final _tileUrl =
      '${ApiService.baseUrl.replaceFirst('/api/v1', '')}/api/v1/tracking/tiles/{z}/{x}/{y}';

  final _mapController = MapController();
  final _searchController = TextEditingController();
  bool _hasFitted = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _fitAllTrucks(List<TruckLocation> trucks) {
    if (trucks.isEmpty) {
      _mapController.move(_tn, 7.5);
      return;
    }
    final lats = trucks.map((t) => t.lat);
    final lngs = trucks.map((t) => t.lng);
    final centerLat = lats.reduce((a, b) => a + b) / lats.length;
    final centerLng = lngs.reduce((a, b) => a + b) / lngs.length;
    final zoom = trucks.length > 15 ? 7.0 : trucks.length > 5 ? 9.0 : 11.0;
    _mapController.move(LatLng(centerLat, centerLng), zoom);
  }

  Widget _buildMarker(TruckLocation truck, TrackingState state) {
    final isSelected = state.selectedId == truck.vehicleId.toString();
    return GestureDetector(
      onTap: () {
        ref.read(trackingProvider.notifier).selectTruck(truck.vehicleId.toString());
        _mapController.move(LatLng(truck.lat, truck.lng), 14.0);
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (truck.status == 'running') _PulsingRing(color: const Color(0xFF10B981)),
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: isSelected ? 46 : 36,
            height: isSelected ? 46 : 36,
            decoration: BoxDecoration(
              color: truck.statusColor,
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.6),
                width: isSelected ? 2.5 : 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: truck.statusColor.withValues(alpha: isSelected ? 0.7 : 0.4),
                  blurRadius: isSelected ? 16 : 8,
                  spreadRadius: isSelected ? 3 : 1,
                ),
              ],
            ),
            child: Center(
              child: Icon(
                truck.status == 'offline'
                    ? Icons.signal_wifi_statusbar_null
                    : Icons.local_shipping,
                color: Colors.white,
                size: isSelected ? 22 : 17,
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: KTColors.textHeading.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                truck.registrationNo.length > 8
                    ? truck.registrationNo.substring(truck.registrationNo.length - 8)
                    : truck.registrationNo,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 7,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showTruckDetail(BuildContext context, TruckLocation truck) {
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _TruckDetailSheet(truck: truck),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(trackingProvider);
    final notifier = ref.read(trackingProvider.notifier);
    final topPad = MediaQuery.of(context).padding.top;
    final botPad = MediaQuery.of(context).padding.bottom;

    if (!_hasFitted && state.trucks.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _fitAllTrucks(state.trucks);
          _hasFitted = true;
        }
      });
    }

    final selected = state.selectedTruck;
    if (selected != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _mapController.move(LatLng(selected.lat, selected.lng), 14.0);
        }
      });
    }

    final filtered = state.filteredTrucks;

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: Stack(
        children: [
          // ── Full-screen Map ────────────────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _tn,
              initialZoom: 7.5,
              minZoom: 5.0,
              maxZoom: 18.0,
            ),
            children: [
              TileLayer(
                urlTemplate: _tileUrl,
                userAgentPackageName: 'com.kavya.transport',
                maxZoom: 18,
                errorTileCallback: (tile, error, stackTrace) {},
              ),
              MarkerLayer(
                markers: filtered
                    .map(
                      (truck) => Marker(
                        point: LatLng(truck.lat, truck.lng),
                        width: 80,
                        height: 60,
                        child: _buildMarker(truck, state),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),

          // ── Floating glass header ──────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(
                  padding: EdgeInsets.only(
                    top: topPad + 8,
                    left: 4,
                    right: 12,
                    bottom: 14,
                  ),
                  decoration: BoxDecoration(
                    color: KTColors.textHeading.withValues(alpha: 0.82),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(24),
                      bottomRight: Radius.circular(24),
                    ),
                    border: Border(
                      bottom: BorderSide(color: Color(0x40F59E0B), width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new,
                            color: Colors.white, size: 18),
                        onPressed: () => Navigator.of(context).maybePop(),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Live Tracking',
                              style: KTTextStyles.h2.copyWith(
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Row(
                              children: [
                                const _PulsingDot(),
                                const SizedBox(width: 6),
                                Text(
                                  'Live · updates every 30s',
                                  style: KTTextStyles.caption.copyWith(
                                      color: const Color(0xFF10B981)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      _AnimatedStatusChip(
                        count: state.runningCount,
                        label: 'Running',
                        color: const Color(0xFF10B981),
                        icon: Icons.play_circle_filled,
                      ),
                      const SizedBox(width: 6),
                      _AnimatedStatusChip(
                        count: state.onBreakCount,
                        label: 'Break',
                        color: KTColors.fleetAccent,
                        icon: Icons.pause_circle_filled,
                      ),
                      const SizedBox(width: 6),
                      _AnimatedStatusChip(
                        count: state.offlineCount,
                        label: 'Off',
                        color: const Color(0xFF6B7280),
                        icon: Icons.wifi_off,
                      ),
                      const SizedBox(width: 6),
                      _SpinRefreshButton(onTap: notifier.refresh),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Glass map buttons (right edge) ────────────────────────────
          Positioned(
            right: 16,
            bottom: MediaQuery.of(context).size.height * 0.25 + 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _GlassMapButton(
                  icon: Icons.add,
                  onTap: () {
                    final cam = _mapController.camera;
                    _mapController.move(cam.center, cam.zoom + 1);
                  },
                ),
                const SizedBox(height: 8),
                _GlassMapButton(
                  icon: Icons.remove,
                  onTap: () {
                    final cam = _mapController.camera;
                    _mapController.move(cam.center, cam.zoom - 1);
                  },
                ),
                const SizedBox(height: 8),
                _GlassMapButton(
                  icon: Icons.fit_screen,
                  onTap: () => _fitAllTrucks(state.trucks),
                  isPrimary: true,
                ),
              ],
            ),
          ),

          // ── Glass bottom sheet ──────────────────────────────────────
          DraggableScrollableSheet(
            initialChildSize: 0.25,
            minChildSize: 0.25,
            maxChildSize: 0.80,
            builder: (context, scrollController) {
              return ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(28)),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: Container(
                    decoration: BoxDecoration(
                      color: KTColors.textHeading.withValues(alpha: 0.92),
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(28)),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                          width: 1),
                    ),
                    child: Column(
                      children: [
                        Center(
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 10),
                            width: 44,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),

                        // Search
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                          child: Container(
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.1)),
                            ),
                            child: TextField(
                              controller: _searchController,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 13),
                              decoration: InputDecoration(
                                hintText: 'Search reg. no. or driver…',
                                hintStyle: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.4),
                                    fontSize: 13),
                                prefixIcon: Icon(Icons.search,
                                    color: Colors.white.withValues(alpha: 0.4),
                                    size: 16),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 10),
                              ),
                              onChanged: (v) => notifier.setSearch(v),
                            ),
                          ),
                        ),

                        // Filter chips — SingleChildScrollView fixes overflow
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 2),
                          child: Row(
                            children: [
                              _FilterChip(
                                label: 'All (${state.trucks.length})',
                                selected: state.filter == 'all',
                                color: Colors.white70,
                                onTap: () => notifier.setFilter('all'),
                              ),
                              const SizedBox(width: 8),
                              _FilterChip(
                                label: '${state.runningCount} Running',
                                selected: state.filter == 'running',
                                color: const Color(0xFF10B981),
                                onTap: () => notifier.setFilter('running'),
                              ),
                              const SizedBox(width: 8),
                              _FilterChip(
                                label: '${state.onBreakCount} Break',
                                selected: state.filter == 'on_break',
                                color: KTColors.fleetAccent,
                                onTap: () => notifier.setFilter('on_break'),
                              ),
                              const SizedBox(width: 8),
                              _FilterChip(
                                label: '${state.offlineCount} Offline',
                                selected: state.filter == 'offline',
                                color: const Color(0xFF6B7280),
                                onTap: () => notifier.setFilter('offline'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Vehicle list — scrollController ALWAYS connected
                        Expanded(
                          child: state.isLoading && state.trucks.isEmpty
                              ? SingleChildScrollView(
                                  controller: scrollController,
                                  child: const SizedBox(
                                    height: 120,
                                    child: Center(
                                      child: CircularProgressIndicator(
                                          color: KTColors.fleetAccent),
                                    ),
                                  ),
                                )
                              : filtered.isEmpty
                                  ? SingleChildScrollView(
                                      controller: scrollController,
                                      child: SizedBox(
                                        height: 120,
                                        child: Center(
                                          child: Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Icon(
                                                  Icons.local_shipping_outlined,
                                                  color: Colors.white
                                                      .withValues(alpha: 0.3),
                                                  size: 36),
                                              const SizedBox(height: 8),
                                              Text(
                                                'No vehicles found',
                                                style: TextStyle(
                                                    color: Colors.white
                                                        .withValues(alpha: 0.4),
                                                    fontSize: 14),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    )
                                  : AnimationLimiter(
                                      child: ListView.builder(
                                        controller: scrollController,
                                        padding: EdgeInsets.fromLTRB(
                                            12, 4, 12, botPad + 8),
                                        itemCount: filtered.length,
                                        itemBuilder: (context, index) {
                                          final truck = filtered[index];
                                          final isSelected =
                                              state.selectedId ==
                                                  truck.vehicleId.toString();
                                          return AnimationConfiguration
                                              .staggeredList(
                                            position: index,
                                            duration: const Duration(
                                                milliseconds: 375),
                                            child: SlideAnimation(
                                              verticalOffset: 30,
                                              child: FadeInAnimation(
                                                child: _TruckListTile(
                                                  truck: truck,
                                                  isSelected: isSelected,
                                                  onTap: () {
                                                    notifier.selectTruck(
                                                        truck.vehicleId
                                                            .toString());
                                                    _mapController.move(
                                                        LatLng(truck.lat,
                                                            truck.lng),
                                                        14.0);
                                                  },
                                                  onDetailTap: () =>
                                                      _showTruckDetail(
                                                          context, truck),
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          // ── Error banner ──────────────────────────────────────────────
          if (state.error != null)
            Positioned(
              top: topPad + 80,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(state.error!, style: const TextStyle(color: Colors.white, fontSize: 13)),
                    ),
                    GestureDetector(
                      onTap: notifier.refresh,
                      child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _anim = Tween(begin: 0.3, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Color.fromRGBO(16, 185, 129, _anim.value),
          boxShadow: [
            BoxShadow(
              color: Color.fromRGBO(16, 185, 129, _anim.value * 0.6),
              blurRadius: 6,
              spreadRadius: 1,
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimatedStatusChip extends StatefulWidget {
  final int count;
  final String label;
  final Color color;
  final IconData icon;

  const _AnimatedStatusChip({
    required this.count,
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  State<_AnimatedStatusChip> createState() => _AnimatedStatusChipState();
}

class _AnimatedStatusChipState extends State<_AnimatedStatusChip>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _scale = Tween(begin: 1.0, end: 1.3)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut));
  }

  @override
  void didUpdateWidget(covariant _AnimatedStatusChip old) {
    super.didUpdateWidget(old);
    if (old.count != widget.count) _ctrl.forward(from: 0);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: widget.color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: widget.color.withValues(alpha: 0.4), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(widget.icon, color: widget.color, size: 12),
            const SizedBox(width: 4),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (child, anim) => SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, -0.5),
                  end: Offset.zero,
                ).animate(anim),
                child: FadeTransition(opacity: anim, child: child),
              ),
              child: Text(
                '${widget.count}',
                key: ValueKey(widget.count),
                style: TextStyle(
                  color: widget.color,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpinRefreshButton extends StatefulWidget {
  final VoidCallback onTap;

  const _SpinRefreshButton({required this.onTap});

  @override
  State<_SpinRefreshButton> createState() => _SpinRefreshButtonState();
}

class _SpinRefreshButtonState extends State<_SpinRefreshButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _tap() {
    _ctrl.forward(from: 0);
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _tap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: KTColors.fleetAccent.withValues(alpha: 0.15),
          shape: BoxShape.circle,
          border: Border.all(
              color: KTColors.fleetAccent.withValues(alpha: 0.4)),
        ),
        child: RotationTransition(
          turns: _ctrl,
          child: const Icon(Icons.refresh, color: KTColors.fleetAccent, size: 18),
        ),
      ),
    );
  }
}

class _PulsingRing extends StatefulWidget {
  final Color color;

  const _PulsingRing({required this.color});

  @override
  State<_PulsingRing> createState() => _PulsingRingState();
}

class _PulsingRingState extends State<_PulsingRing>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _size;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1800))
      ..repeat();
    _size = Tween(begin: 36.0, end: 64.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _opacity = Tween(begin: 0.6, end: 0.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Container(
        width: _size.value,
        height: _size.value,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: widget.color.withValues(alpha: _opacity.value),
            width: 2,
          ),
        ),
      ),
    );
  }
}

class _GlassMapButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool isPrimary;

  const _GlassMapButton({
    required this.icon,
    required this.onTap,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isPrimary
                  ? KTColors.fleetAccent.withValues(alpha: 0.85)
                  : KTColors.textHeading.withValues(alpha: 0.75),
              border: Border.all(
                color: isPrimary
                    ? KTColors.fleetAccent
                    : Colors.white.withValues(alpha: 0.15),
                width: 1,
              ),
            ),
            child: Icon(
              icon,
              color: isPrimary ? KTColors.textHeading : Colors.white,
              size: 20,
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// FILTER CHIP
// ============================================================================

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? color.withValues(alpha: 0.22)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? color.withValues(alpha: 0.6)
                : Colors.white.withValues(alpha: 0.1),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? color : Colors.white.withValues(alpha: 0.5),
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _TruckListTile extends StatelessWidget {
  final TruckLocation truck;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onDetailTap;

  const _TruckListTile({
    required this.truck,
    required this.isSelected,
    required this.onTap,
    required this.onDetailTap,
  });

  String _timeAgo(DateTime? dt) {
    if (dt == null) return '—';
    final mins = DateTime.now().difference(dt).inMinutes;
    if (mins < 1) return 'Just now';
    if (mins < 60) return '${mins}m ago';
    return '${(mins / 60).floor()}h ago';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            truck.statusColor.withValues(alpha: 0.08),
            Colors.transparent,
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected
              ? truck.statusColor.withValues(alpha: 0.6)
              : Colors.white.withValues(alpha: 0.06),
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          splashColor: truck.statusColor.withValues(alpha: 0.1),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 3,
                  height: 44,
                  margin: const EdgeInsets.only(right: 12),
                  decoration: BoxDecoration(
                    color: truck.statusColor,
                    borderRadius: BorderRadius.circular(2),
                    boxShadow: [
                      BoxShadow(
                        color: truck.statusColor.withValues(alpha: 0.5),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: truck.statusColor.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.local_shipping,
                      color: truck.statusColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        truck.registrationNo,
                        style: KTTextStyles.label.copyWith(
                            color: Colors.white, letterSpacing: 0.5),
                      ),
                      if (truck.driverName != null)
                        Text(
                          truck.driverName!,
                          style: KTTextStyles.caption.copyWith(
                              color: Colors.white.withValues(alpha: 0.5)),
                        ),
                      if (truck.tripOrigin != null)
                        Row(
                          children: [
                            Icon(Icons.route,
                                size: 10,
                                color: Colors.white.withValues(alpha: 0.4)),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                '${truck.tripOrigin} → ${truck.tripDestination}',
                                style: KTTextStyles.caption.copyWith(
                                    fontSize: 10,
                                    color:
                                        Colors.white.withValues(alpha: 0.45)),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (truck.status == 'running')
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: const Color(0xFF10B981)
                                  .withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          '${truck.speed.toStringAsFixed(0)} km/h',
                          style: const TextStyle(
                              color: Color(0xFF10B981),
                              fontSize: 11,
                              fontWeight: FontWeight.w700),
                        ),
                      )
                    else
                      Text(
                        truck.statusLabel,
                        style: TextStyle(
                            color: truck.statusColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w600),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      _timeAgo(truck.lastPing),
                      style: KTTextStyles.caption.copyWith(
                          fontSize: 10,
                          color: Colors.white.withValues(alpha: 0.35)),
                    ),
                  ],
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onDetailTap,
                  child: Icon(Icons.info_outline,
                      color: Colors.white.withValues(alpha: 0.3), size: 18),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// TRUCK DETAIL SHEET
// ============================================================================

class _TruckDetailSheet extends StatelessWidget {
  final TruckLocation truck;

  const _TruckDetailSheet({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: KTColors.borderColor, borderRadius: BorderRadius.circular(2)),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: truck.statusColor, shape: BoxShape.circle),
                child: const Icon(Icons.local_shipping, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(truck.registrationNo,
                        style: TextStyle(color: KTColors.textHeading, fontSize: 18, fontWeight: FontWeight.w800)),
                    if (truck.driverName != null)
                      Text(truck.driverName!, style: TextStyle(color: KTColors.textMuted, fontSize: 13)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: truck.statusColor.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(truck.statusLabel.toUpperCase(),
                    style: TextStyle(color: truck.statusColor, fontWeight: FontWeight.w700, fontSize: 11)),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Stats grid
          Row(
            children: [
              _StatCard(label: 'Speed', value: '${truck.speed.toStringAsFixed(0)} km/h'),
              const SizedBox(width: 10),
              _StatCard(
                label: 'Last Ping',
                value: truck.minutesSinceLastPing <= 0
                    ? 'Just now'
                    : '${truck.minutesSinceLastPing}m ago',
              ),
              const SizedBox(width: 10),
              _StatCard(label: 'Ignition', value: truck.ignitionOn ? 'ON' : 'OFF',
                  valueColor: truck.ignitionOn ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
            ],
          ),
          if (truck.odometerKm > 0) ...[
            const SizedBox(height: 10),
            _StatCard(label: 'Odometer', value: '${truck.odometerKm.toStringAsFixed(0)} km'),
          ],

          // Trip
          if (truck.tripOrigin != null && truck.tripDestination != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.fleetAccent.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.route, color: KTColors.fleetAccent, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${truck.tripOrigin} → ${truck.tripDestination}',
                      style: TextStyle(color: KTColors.textHeading, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                  if (truck.tripId != null)
                    Text('#${truck.tripId}', style: TextStyle(color: KTColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],

          // GPS coordinates
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(8)),
            child: Row(
              children: [
                const Icon(Icons.location_on_outlined, color: Color(0xFF3B82F6), size: 16),
                const SizedBox(width: 6),
                Text(
                  '${truck.lat.toStringAsFixed(5)}°N, ${truck.lng.toStringAsFixed(5)}°E',
                  style: TextStyle(color: KTColors.textMuted, fontFamily: 'monospace', fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _StatCard({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: KTColors.textMuted, fontSize: 10)),
            const SizedBox(height: 3),
            Text(value,
                style: TextStyle(
                  color: valueColor ?? KTColors.textHeading,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                )),
          ],
        ),
      ),
    );
  }
}
