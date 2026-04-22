import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../providers/vehicles_provider.dart';

class FleetVehicleListScreen extends ConsumerStatefulWidget {
  const FleetVehicleListScreen({super.key});

  @override
  ConsumerState<FleetVehicleListScreen> createState() => _FleetVehicleListScreenState();
}

class _FleetVehicleListScreenState extends ConsumerState<FleetVehicleListScreen> {
  String _selectedFilter = 'All'; // Filter chips row: All | Moving | Idle | Maintenance | Alerts [cite: 62-63]
  final List<String> _filters = ['All', 'Moving', 'Idle', 'Maintenance', 'Alerts'];

  @override
  Widget build(BuildContext context) {
    final vehiclesState = ref.watch(vehiclesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Vehicles"), // AppBar: "Vehicles" + search icon [cite: 62]
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips Row
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _filters.map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Text(filter),
                    selected: isSelected,
                    onSelected: (selected) => setState(() => _selectedFilter = filter),
                    selectedColor: KTColors.primaryLight,
                    checkmarkColor: KTColors.primaryDark,
                  ),
                );
              }).toList(),
            ),
          ),
          
          Expanded(
            child: vehiclesState.when(
              loading: () => const KTLoadingShimmer(type: ShimmerType.card), // [cite: 109-110]
              error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(vehiclesProvider)), // [cite: 111-113]
              data: (vehicles) {
                // Client-side filtering logic here based on _searchQuery and _selectedFilter [cite: 62]
                final filteredVehicles = vehicles; 

                if (filteredVehicles.isEmpty) {
                  return const KTEmptyState(
                    title: "No vehicles found", 
                    subtitle: "Try adjusting your filters.", // [cite: 114-115]
                    lottieAsset: 'assets/lottie/empty_box.json', // Assuming you'll add this asset later
                  ); 
                }

                return RefreshIndicator(
                  color: KTColors.primary,
                  onRefresh: () async => ref.invalidate(vehiclesProvider), // [cite: 118]
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredVehicles.length,
                    itemBuilder: (context, index) {
                      final v = filteredVehicles[index];
                      // Dummy data mapping for scaffold
                      final regNo = v['reg_number'] ?? 'TN01AB1234'; 
                      final type = v['type'] ?? 'Tata Signa 4825.T';
                      final status = v['status'] ?? 'moving';
                      final alerts = v['alerts'] ?? true;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () => context.push('/fleet/vehicle/${v['id'] ?? '1'}'), // Tap -> FleetVehicleDetailScreen [cite: 63]
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(regNo, style: KTTextStyles.h2), // Registration number (bold, large) [cite: 63]
                                    const SizedBox(height: 4),
                                    Text(type, style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])), // Vehicle type + model [cite: 63]
                                    const SizedBox(height: 8),
                                    KTStatusBadge( // Status badge (KTStatusBadge) [cite: 63]
                                      label: status, 
                                      color: status == 'moving' ? KTColors.success : KTColors.warning
                                    ), 
                                  ],
                                ),
                                if (alerts)
                                  const Icon(Icons.warning_amber_rounded, color: KTColors.warning), // Documents warning icon if any expiring [cite: 63]
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}