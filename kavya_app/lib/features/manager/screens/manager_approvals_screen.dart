import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../providers/fleet_dashboard_provider.dart';
import '../providers/manager_providers.dart';
import '../widgets/approval_card_widget.dart';

class ManagerApprovalsScreen extends ConsumerWidget {
  const ManagerApprovalsScreen({super.key});

  static const _types = ['all', 'expense', 'banking'];
  static const _typeLabels = ['All', 'Expenses', 'Banking'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentType = ref.watch(managerApprovalTypeProvider);
    final approvalsAsync = ref.watch(managerApprovalsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Approvals', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Column(
        children: [
          // ── Type chips ───────────────────────────
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _types.length,
              itemBuilder: (_, i) {
                final sel = currentType == _types[i];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(_typeLabels[i]),
                    selected: sel,
                    selectedColor: KTColors.managerAccent,
                    backgroundColor: KTColors.surface,
                    labelStyle: TextStyle(color: sel ? Colors.white : KTColors.textMuted, fontSize: 13),
                    onSelected: (_) => ref.read(managerApprovalTypeProvider.notifier).state = _types[i],
                    side: BorderSide.none,
                  ),
                );
              },
            ),
          ),

          // ── Approvals list ───────────────────────
          Expanded(
            child: RefreshIndicator(
              color: KTColors.managerAccent,
              backgroundColor: KTColors.surface,
              onRefresh: () async => ref.invalidate(managerApprovalsProvider),
              child: approvalsAsync.when(
                loading: () => const KTLoadingShimmer(type: ShimmerType.list),
                error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(managerApprovalsProvider)),
                data: (approvals) {
                  if (approvals.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle_outline, color: KTColors.success, size: 48),
                          const SizedBox(height: 12),
                          Text('No pending approvals', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: approvals.length,
                    itemBuilder: (_, i) {
                      final item = Map<String, dynamic>.from(approvals[i] as Map);
                      return ApprovalCardWidget(
                        approval: item,
                        onApprove: () => _approveItem(context, ref, item),
                        onReject: () => _showRejectDialog(context, ref, item),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _approveItem(BuildContext context, WidgetRef ref, Map<String, dynamic> item) async {
    try {
      final api = ref.read(apiServiceProvider);
      final type = item['type'] ?? '';
      final id = item['id'];
      if (type == 'expense') {
        await api.put('/accountant/expenses/$id/approve');
      } else {
        await api.put('/banking/entries/$id', data: {'reconciled': true});
      }
      ref.invalidate(managerApprovalsProvider);
      ref.invalidate(managerDashboardStatsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Approved'), backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Action failed. Please try again.'), backgroundColor: KTColors.danger),
        );
      }
    }
  }

  Future<void> _showRejectDialog(BuildContext context, WidgetRef ref, Map<String, dynamic> item) async {
    final reasonCtrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KTColors.surface,
        title: Text('Reject', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 3,
          style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
          decoration: InputDecoration(
            hintText: 'Reason for rejection (required)',
            hintStyle: TextStyle(color: KTColors.textMuted),
            filled: true,
            fillColor: KTColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: TextStyle(color: KTColors.textMuted))),
          TextButton(
            onPressed: () {
              if (reasonCtrl.text.trim().isNotEmpty) Navigator.pop(ctx, reasonCtrl.text.trim());
            },
            child: const Text('Reject', style: TextStyle(color: KTColors.danger)),
          ),
        ],
      ),
    );
    reasonCtrl.dispose();

    if (result != null && result.isNotEmpty) {
      try {
        final api = ref.read(apiServiceProvider);
        final type = item['type'] ?? '';
        final id = item['id'];
        if (type == 'expense') {
          await api.put('/accountant/expenses/$id/reject');
        }
        ref.invalidate(managerApprovalsProvider);
        ref.invalidate(managerDashboardStatsProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Rejected'), backgroundColor: KTColors.danger),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Action failed. Please try again.'), backgroundColor: KTColors.danger),
          );
        }
      }
    }
  }
}
