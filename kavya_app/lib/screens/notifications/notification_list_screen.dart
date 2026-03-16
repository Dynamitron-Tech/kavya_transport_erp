import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_empty_state.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/notification_provider.dart';

class NotificationListScreen extends ConsumerWidget {
  const NotificationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifState = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Notifications"), //
        actions: [
          TextButton(
            onPressed: () {
              // API Call: PATCH /api/v1/notifications/read-all
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('All marked as read'))); // mark all read button [cite: 105]
              ref.invalidate(notificationsProvider);
            },
            child: const Text("Mark all read", style: TextStyle(color: Colors.white)),
          )
        ],
      ),
      body: notifState.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list), // [cite: 109-110]
        error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(notificationsProvider)), // [cite: 111-113]
        data: (notifications) {
          if (notifications.isEmpty) {
            return const KTEmptyState(
              title: "No new notifications",
              subtitle: "You're all caught up!",
              lottieAsset: 'assets/lottie/done.json', // [cite: 114-115]
            );
          }

          return RefreshIndicator(
            color: KTColors.primary,
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              itemCount: notifications.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final n = notifications[index];
                
                // Determine icon based on type [cite: 102-103]
                IconData icon;
                Color iconBg;
                switch (n['type']) {
                  case 'expense_submitted': icon = Icons.receipt; iconBg = KTColors.warning; break;
                  case 'ewb_expiring': icon = Icons.timer; iconBg = KTColors.danger; break;
                  case 'payment_received': icon = Icons.account_balance_wallet; iconBg = KTColors.success; break;
                  default: icon = Icons.notifications; iconBg = KTColors.info;
                }

                return ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  tileColor: KTColors.cardSurface,
                  leading: CircleAvatar(
                    backgroundColor: iconBg.withOpacity(0.1),
                    child: Icon(icon, color: iconBg),
                  ),
                  title: Text(n['title'], style: KTTextStyles.label), //
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(n['message'], style: KTTextStyles.body), //
                        const SizedBox(height: 8),
                        Text(n['created_at'], style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])),
                      ],
                    ),
                  ),
                  onTap: () {
                    // In a real implementation, you'd use NotificationService to route [cite: 104-105]
                    if (n['type'] == 'expense_submitted') context.push('/fleet/expenses');
                    if (n['type'] == 'ewb_expiring') context.push('/associate/home');
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}