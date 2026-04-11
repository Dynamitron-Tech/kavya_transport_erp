import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_status_badge.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/vehicles_provider.dart';

class FleetVehicleDetailScreen extends ConsumerWidget {
  final String id;
  const FleetVehicleDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleState = ref.watch(vehicleDetailProvider(id));

    return vehicleState.when(
      loading: () => Scaffold(appBar: AppBar(), body: const KTLoadingShimmer()), // [cite: 109-110]
      error: (err, stack) => Scaffold(
        appBar: AppBar(), 
        body: KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(vehicleDetailProvider(id))) // [cite: 111-113]
      ),
      data: (data) {
        return DefaultTabController(
          length: 4, // Tabs: Overview | Documents | Services | Tyres [cite: 64-65]
          child: Scaffold(
            appBar: AppBar(
              title: Text(data['reg_number'] ?? 'Vehicle Details'),
              bottom: const TabBar(
                isScrollable: true,
                indicatorColor: Colors.white,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white70,
                tabs: [
                  Tab(text: "Overview"),
                  Tab(text: "Documents"),
                  Tab(text: "Services"),
                  Tab(text: "Tyres"),
                ],
              ),
            ),
            body: TabBarView(
              children: [
                _buildOverviewTab(data),
                _buildDocumentsTab(data),
                _buildServicesTab(context, data),
                _buildTyresTab(context, data),
              ],
            ),
            floatingActionButton: Builder( // Adaptive FAB based on active tab [cite: 65-66]
              builder: (context) {
                final tabController = DefaultTabController.of(context);
                return AnimatedBuilder(
                  animation: tabController,
                  builder: (context, child) {
                    if (tabController.index == 2) {
                      return FloatingActionButton.extended(
                        onPressed: () => context.push('/fleet/service/new'),
                        label: const Text("Log Service"), // "Log new service" FAB [cite: 65]
                        icon: const Icon(Icons.add),
                        backgroundColor: KTColors.primary,
                      );
                    } else if (tabController.index == 3) {
                      return FloatingActionButton.extended(
                        onPressed: () => context.push('/fleet/tyre/new'),
                        label: const Text("Record Tyre"), // "Record tyre event" FAB [cite: 66]
                        icon: const Icon(Icons.add),
                        backgroundColor: KTColors.primary,
                      );
                    }
                    return const SizedBox.shrink();
                  },
                );
              }
            ),
          ),
        );
      },
    );
  }

  // --- Tab 1: Overview [cite: 65] ---
  Widget _buildOverviewTab(Map<String, dynamic> data) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card( // Vehicle header card
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(data['reg_number'] ?? 'TN01AB1234', style: KTTextStyles.h2),
                const SizedBox(height: 8),
                Row(
                  children: [
                    KTStatusBadge(label: data['status'] ?? 'moving', color: KTColors.success),
                    const SizedBox(width: 12),
                    Text("Driver: ${data['driver'] ?? 'Kumar'}", style: KTTextStyles.label), // current driver
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        ListTile(
          tileColor: KTColors.cardSurface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.route, color: KTColors.primary),
          title: const Text("Current Trip: KT-T-0089"), // Current trip (if any): trip number
          subtitle: const Text("Chennai → Coimbatore • Started 2h ago"), // route, start time
        ),
        const SizedBox(height: 16),
        ListTile(
          tileColor: KTColors.cardSurface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.speed, color: KTColors.info),
          title: const Text("Odometer"), // Odometer: current reading
          trailing: Text("1,45,200 km", style: KTTextStyles.h3),
        ),
      ],
    );
  }

  // --- Tab 2: Documents [cite: 65] ---
  Widget _buildDocumentsTab(Map<String, dynamic> data) {
    final docs = [
      {'name': 'Registration Certificate (RC)', 'status': 'valid', 'expiry': '12 Oct 2028'},
      {'name': 'Insurance', 'status': 'expiring_soon', 'expiry': '18 Mar 2026'},
      {'name': 'Fitness Certificate', 'status': 'expired', 'expiry': '01 Jan 2026'},
    ]; // Dummy mapping

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: docs.length,
      itemBuilder: (context, index) {
        final doc = docs[index];
        Color borderColor = KTColors.success;
        Widget trailing = const Icon(Icons.check_circle, color: KTColors.success); // Valid: green check

        if (doc['status'] == 'expired') { // Expired: red border + "Renew" chip
          borderColor = KTColors.danger;
          trailing = Chip(label: const Text("Renew"), backgroundColor: KTColors.danger.withOpacity(0.1), labelStyle: const TextStyle(color: KTColors.danger));
        } else if (doc['status'] == 'expiring_soon') { // Expiring soon (≤30 days): amber border
          borderColor = KTColors.warning;
          trailing = const Icon(Icons.warning_amber_rounded, color: KTColors.warning);
        }

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: borderColor, width: 2), // colored borders based on status
          ),
          child: ListTile(
            title: Text(doc['name']!, style: KTTextStyles.label),
            subtitle: Text("Expires: ${doc['expiry']}"),
            trailing: trailing,
          ),
        );
      },
    );
  }

  // --- Tab 3: Services [cite: 65] ---
  Widget _buildServicesTab(BuildContext context, Map<String, dynamic> data) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            title: const Text("Engine Oil Replacement"), // service type
            subtitle: const Text("15 Feb 2026 • 1,42,000 km\nNotes: Castrol 15W40"), // date, km at service, notes
            isThreeLine: true,
          ),
        );
      },
    );
  }

  // --- Tab 4: Tyres [cite: 65-66] ---
  Widget _buildTyresTab(BuildContext context, Map<String, dynamic> data) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          Text("Tyre Status (PSI)", style: KTTextStyles.h3),
          const SizedBox(height: 32),
          // Visual tyre layout diagram (simple: front-left, front-right, rear-left, rear-right using Container boxes) [cite: 65-66]
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildTyreBox("FL", "110", true), // Front-Left
              _buildTyreBox("FR", "112", true), // Front-Right
            ],
          ),
          const SizedBox(height: 48), // Axle gap
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildTyreBox("RL", "95", false), // Rear-Left (Alert if below threshold PSI) [cite: 66]
              _buildTyreBox("RR", "108", true), // Rear-Right
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTyreBox(String position, String psi, bool isOk) {
    return Container(
      width: 80,
      height: 120,
      decoration: BoxDecoration(
        color: isOk ? KTColors.success.withOpacity(0.1) : KTColors.danger.withOpacity(0.1), // Alert if below threshold PSI [cite: 66]
        border: Border.all(color: isOk ? KTColors.success : KTColors.danger, width: 3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(position, style: KTTextStyles.label), // Each tyre: PSI reading + status [cite: 66]
          const SizedBox(height: 8),
          Text(psi, style: KTTextStyles.h2.copyWith(color: isOk ? KTColors.success : KTColors.danger)),
          const Text("PSI"),
        ],
      ),
    );
  }
}