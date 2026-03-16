import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/checklist_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/kt_button.dart';
import '../../config/app_theme.dart';
import '../../providers/trip_provider.dart';

class ChecklistScreen extends ConsumerWidget {
  const ChecklistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeTrip = ref.watch(activeTripProvider);

    if (activeTrip == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pre-Trip Checklist')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Text('No active trip. Start a trip first.',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 15)),
          ),
        ),
      );
    }

    final params = (tripId: activeTrip.id, type: 'pre_trip');
    final checklistState = ref.watch(checklistProvider(params));

    return Scaffold(
      appBar: AppBar(title: Text('Checklist — ${activeTrip.tripNumber}')),
      body: checklistState.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeletonWidget(itemCount: 8, variant: LoadingVariant.list),
        ),
        error: (e, _) => ErrorStateWidget(
          error: e,
          onRetry: () => ref.invalidate(checklistProvider(params)),
        ),
        data: (checklist) => Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: checklist.items.length,
                itemBuilder: (context, index) {
                  final item = checklist.items[index];
                  return Card(
                    child: CheckboxListTile(
                      title: Text(item.label),
                      value: item.checked,
                      activeColor: AppTheme.success,
                      onChanged: (val) {
                        ref
                            .read(checklistProvider(params).notifier)
                            .toggleItem(item.id, val ?? false);
                      },
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: KtButton(
                  label: checklist.isComplete
                      ? 'Submit Checklist'
                      : 'Complete all items first',
                  icon: Icons.check_circle,
                  onPressed: checklist.isComplete
                      ? () async {
                          await ref
                              .read(checklistProvider(params).notifier)
                              .submit();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Checklist submitted')),
                            );
                            Navigator.of(context).pop();
                          }
                        }
                      : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
