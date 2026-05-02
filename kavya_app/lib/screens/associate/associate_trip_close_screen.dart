import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/jobs_provider.dart';
import '../../providers/fleet_dashboard_provider.dart'; // For apiServiceProvider

class AssociateTripCloseScreen extends ConsumerStatefulWidget {
  const AssociateTripCloseScreen({super.key});

  @override
  ConsumerState<AssociateTripCloseScreen> createState() => _AssociateTripCloseScreenState();
}

class _AssociateTripCloseScreenState extends ConsumerState<AssociateTripCloseScreen> {
  bool _isClosing = false; //

  Future<void> _closeTrip(String id) async {
    setState(() => _isClosing = true); //
    try {
      await ref.read(apiServiceProvider).closeTrip(id); // On close: PATCH /api/v1/trips/:id/status { "status": "completed" } 
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Trip closed successfully'), backgroundColor: KTColors.success)); // [cite: 117]
        ref.invalidate(tripsReadyToCloseProvider);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
    } finally {
      if (mounted) setState(() => _isClosing = false); //
    }
  }

  @override
  Widget build(BuildContext context) {
    final tripsState = ref.watch(tripsReadyToCloseProvider);

    return Scaffold(
      appBar: AppBar(title: const Text("Close trips")), //
      body: tripsState.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list), // [cite: 109, 110]
        error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(tripsReadyToCloseProvider)), // [cite: 112, 113]
        data: (trips) {
          if (trips.isEmpty) {
            return const KTEmptyState(
              title: "No trips to close", 
              subtitle: "All eligible trips have been closed.",
              lottieAsset: 'assets/lottie/done.json', // [cite: 114, 115]
            );
          }

          return RefreshIndicator(
            color: KTColors.primary, // [cite: 118]
            onRefresh: () async => ref.invalidate(tripsReadyToCloseProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: trips.length,
              itemBuilder: (context, index) {
                final trip = trips[index];
                
                // Dummy mapping based on spec
                final tripNo = trip['trip_number'] ?? 'KT-T-0089';
                final vehicle = trip['vehicle_number'] ?? 'TN02CD5678';
                final driver = trip['driver_name'] ?? 'Kumar';
                final route = trip['route'] ?? 'Chennai → Bangalore';
                
                final podUploaded = trip['pod_uploaded'] ?? true;
                final expensesSubmitted = trip['expenses_submitted'] ?? true;
                final lrAttached = trip['lr_attached'] ?? false; // Mocking one incomplete item

                final isReadyToClose = podUploaded && expensesSubmitted && lrAttached; // enabled only if all items complete 

                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("$tripNo • $vehicle • $driver", style: KTTextStyles.h3), // Trip number + vehicle + driver 
                        const SizedBox(height: 4),
                        Text(route, style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[700])), // Route 
                        const SizedBox(height: 16),
                        
                        // Checklist items with status 
                        _buildChecklistItem("POD uploaded", podUploaded),
                        _buildChecklistItem("All expenses submitted", expensesSubmitted),
                        _buildChecklistItem("LR attached", lrAttached),
                        
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: isReadyToClose && !_isClosing ? () => _closeTrip(trip['id'] ?? '1') : null, //
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isReadyToClose ? KTColors.primary : Colors.grey.shade300,
                            foregroundColor: isReadyToClose ? Colors.white : Colors.grey.shade600,
                          ),
                          child: _isClosing 
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) // [cite: 110]
                            : const Text("Close trip"), // "Close trip" button 
                        )
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildChecklistItem(String title, bool isComplete) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(
            isComplete ? Icons.check_circle : Icons.warning_amber_rounded,
            color: isComplete ? KTColors.success : KTColors.danger, // ✓ POD uploaded / ⚠ Missing items shown in red 
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(title, style: KTTextStyles.body.copyWith(color: isComplete ? Colors.black87 : KTColors.danger)),
        ],
      ),
    );
  }
}