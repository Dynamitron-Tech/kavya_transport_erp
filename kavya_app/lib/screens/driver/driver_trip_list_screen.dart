import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../providers/search_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/status_chip.dart';

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
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch paginated trips
    final tripsAsync = ref.watch(tripsPaginatedProvider);
    
    // Watch search results if query exists
    final searchQuery = _searchCtrl.text.trim();
    final searchResults = ref.watch(tripSearchProvider);

    // Use search results if query present, otherwise use paginated trips
    final displayTrips = searchQuery.isNotEmpty 
        ? searchResults.valueOrNull ?? []
        : tripsAsync.maybeWhen(
            data: (paginatedData) => paginatedData.items,
            orElse: () => [],
          );
    
    final filtered = _filterTrips(displayTrips);

    return Scaffold(
      appBar: AppBar(title: const Text('Trips')),
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
                hintText: 'Search trips...',
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
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _filterChip('all', 'All', _filterStatus == 'all', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('pending', 'Pending', _filterStatus == 'pending', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('in_transit', 'In Transit', _filterStatus == 'in_transit', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('completed', 'Completed', _filterStatus == 'completed', (v) => setState(() => _filterStatus = v)),
              ],
            ),
          ),
          const SizedBox(height: 16),

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
                        Text('No trips found', style: KTTextStyles.h3),
                        const SizedBox(height: 8),
                        Text('Try adjusting filters', style: const TextStyle(color: KTColors.textSecondary, fontSize: 14)),
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
              loading: () => Column(
                children: List.generate(
                  5,
                  (index) => Padding(
                    padding: EdgeInsets.only(
                      left: 16,
                      right: 16,
                      bottom: index == 4 ? 0 : 12,
                      top: index == 0 ? 8 : 0,
                    ),
                    child: Container(
                      height: 110,
                      decoration: BoxDecoration(
                        color: KTColors.cardSurface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Shimmer.fromColors(
                        baseColor: Colors.grey,
                        highlightColor: Colors.white,
                        child: SizedBox.expand(),
                      ),
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
                    Text('Error loading trips', style: KTTextStyles.h3),
                    const SizedBox(height: 8),
                    Text(e.toString(), style: const TextStyle(color: KTColors.textSecondary, fontSize: 12)),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => ref.refresh(tripsPaginatedProvider),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
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

  Widget _filterChip(String value, String label, bool selected, Function(String) onSelected) {
    return GestureDetector(
      onTap: () => onSelected(value),
      child: Chip(
        label: Text(label, style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : KTColors.textPrimary,
        )),
        backgroundColor: selected ? KTColors.primary : KTColors.cardSurface,
        side: selected ? BorderSide.none : const BorderSide(color: KTColors.textMuted),
      ),
    );
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
                  Icon(Icons.location_on_outlined, size: 16, color: KTColors.primary),
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
      case 'in_transit': return KTColors.primary;
      case 'loading': return KTColors.warning;
      case 'completed': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}
