import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../providers/search_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/localization/locale_provider.dart';

class DriverTripListScreen extends ConsumerStatefulWidget {
  const DriverTripListScreen({super.key});

  @override
  ConsumerState<DriverTripListScreen> createState() => _DriverTripListScreenState();
}

class _DriverTripListScreenState extends ConsumerState<DriverTripListScreen> {
  String _filterStatus = 'all';
  late TextEditingController _searchCtrl;

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Watch paginated trips
    final tripsAsync = ref.watch(tripsPaginatedProvider);
    
    // Watch search results if query exists
    final searchQuery = _searchCtrl.text.trim();
    final searchResults = ref.watch(tripSearchProvider);
    final s = ref.watch(sProvider);

    // Use search results if query present, otherwise use paginated trips
    final displayTrips = searchQuery.isNotEmpty 
        ? (searchResults.valueOrNull ?? <Trip>[])
        : tripsAsync.maybeWhen(
            data: (paginatedData) => paginatedData.items,
            orElse: () => <Trip>[],
          );
    
    final filtered = _filterTrips(displayTrips);

    return Scaffold(
      appBar: AppBar(title: Text(s.trips)),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (value) {
                // Update search provider
                ref.read(tripSearchQueryProvider.notifier).state = value;
                setState(() {});
              },
              decoration: InputDecoration(
                hintText: s.searchTrips,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          ref.read(tripSearchQueryProvider.notifier).state = '';
                          setState(() {});
                        },
                      )
                    : null,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),

          // Status Filter Chips
          _TripFilterRow(
            filters: [
              ('all', s.all),
              ('pending', s.pending),
              ('in_transit', s.inTransit),
              ('completed', s.completed),
            ],
            selected: _filterStatus,
            onSelect: (v) => setState(() => _filterStatus = v),
          ),
          const SizedBox(height: 8),

          // Trips List with Pull-to-Refresh
          Expanded(
            child: tripsAsync.when(
              data: (paginatedData) {
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.local_shipping_outlined, size: 56, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(s.noTripsFound, style: KTTextStyles.h3),
                        const SizedBox(height: 8),
                        Text(s.tryAdjustingFilters, style: const TextStyle(color: KTColors.textSecondary, fontSize: 14)),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    // Refresh paginated trips
                    return ref.read(tripsPaginatedProvider.notifier).refresh();
                  },
                  child: Column(
                    children: [
                      Expanded(
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: filtered.length + (paginatedData.hasMore ? 1 : 0),
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            // Load more trigger
                            if (index == filtered.length && paginatedData.hasMore) {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                ref.read(tripsPaginatedProvider.notifier).loadMore();
                              });
                              return const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(16),
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            }
                            if (index >= filtered.length) return const SizedBox.shrink();

                            return _tripCard(context, filtered[index]);
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
              loading: () => ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: 5,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, index) => Shimmer.fromColors(
                  baseColor: Colors.grey.shade800,
                  highlightColor: Colors.grey.shade600,
                  child: Container(
                    height: 110,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade800,
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              error: (e, st) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.error_outline, size: 56, color: KTColors.danger),
                    const SizedBox(height: 16),
                    Text(s.errorLoadingTrips, style: KTTextStyles.h3),
                    const SizedBox(height: 8),
                    Text(e.toString(), style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => ref.refresh(tripsPaginatedProvider),
                      icon: const Icon(Icons.refresh),
                      label: Text(s.retry),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Trip> _filterTrips(List<Trip> trips) {
    var result = trips;

    // Filter by status
    if (_filterStatus != 'all') {
      result = result.where((t) => t.status == _filterStatus).toList();
    }

    return result;
  }


  Widget _tripCard(BuildContext context, Trip trip) {
    return Card(
      child: InkWell(
        onTap: () => context.push('/driver/trip/${trip.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(trip.tripNumber, style: KTTextStyles.h3),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(trip.status).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      trip.status.replaceAll('_', ' ').toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _getStatusColor(trip.status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 16, color: KTColors.driverAccent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${trip.origin ?? 'Unknown'} → ${trip.destination ?? 'Unknown'}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (trip.vehicleNumber != null) ...[
                    Icon(Icons.directions_car_outlined, size: 14, color: KTColors.textSecondary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(trip.vehicleNumber!, style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                    ),
                  ],
                  if (trip.distanceKm != null) ...[
                    const SizedBox(width: 16),
                    Icon(Icons.straighten, size: 14, color: KTColors.textSecondary),
                    const SizedBox(width: 4),
                    Text('${trip.distanceKm!.toStringAsFixed(1)} km', style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                  ],
                ],
              ),
              if (trip.clientName != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.business_outlined, size: 14, color: KTColors.textSecondary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(trip.clientName!, style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return KTColors.warning;
      case 'started': return KTColors.info;
      case 'in_transit': return KTColors.driverAccent;
      case 'loading': return KTColors.warning;
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}

class _TripFilterRow extends StatelessWidget {
  final List<(String, String)> filters;
  final String selected;
  final ValueChanged<String> onSelect;

  const _TripFilterRow({
    required this.filters,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: filters.asMap().entries.map((entry) {
          final (value, label) = entry.value;
          final isSelected = selected == value;
          return Padding(
            padding: EdgeInsets.only(right: entry.key < filters.length - 1 ? 8 : 0),
            child: GestureDetector(
              onTap: () => onSelect(value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? KTColors.driverAccent : KTColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? KTColors.driverAccent : KTColors.borderColor,
                    width: 1.5,
                  ),
                  boxShadow: isSelected
                      ? [BoxShadow(color: KTColors.driverAccent.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 2))]
                      : [],
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : KTColors.textMuted,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
