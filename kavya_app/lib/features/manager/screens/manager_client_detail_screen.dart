import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../core/widgets/kt_loading_shimmer.dart';
import '../../../core/widgets/kt_error_state.dart';
import '../../../providers/fleet_dashboard_provider.dart';

double _safeDouble(dynamic v) {
  if (v == null) return 0.0;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0.0;
}

class ManagerClientDetailScreen extends ConsumerWidget {
  final String clientId;
  const ManagerClientDetailScreen({super.key, required this.clientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clientAsync = ref.watch(_clientDetailProvider(clientId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: KTColors.textHeading), onPressed: () => context.pop()),
        title: Text('Client Details', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: clientAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(message: e.toString(), onRetry: () => ref.invalidate(_clientDetailProvider(clientId))),
        data: (c) {
          final creditLimit = _safeDouble(c['credit_limit']);
          final outstanding = _safeDouble(c['outstanding_amount']);
          final utilization = creditLimit > 0 ? (outstanding / creditLimit).clamp(0.0, 1.0) : 0.0;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: KTColors.managerAccent.withOpacity(0.2),
                        child: Text((c['name'] ?? '?')[0].toUpperCase(),
                            style: const TextStyle(color: KTColors.managerAccent, fontSize: 20, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(c['name'] ?? '-', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                          if ((c['gstin'] ?? '').toString().isNotEmpty)
                            Text('GSTIN: ${c['gstin']}', style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                        ]),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (c['is_active'] == true ? KTColors.success : KTColors.danger).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(c['is_active'] == true ? 'Active' : 'Inactive',
                            style: TextStyle(color: c['is_active'] == true ? KTColors.success : KTColors.danger, fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ]),
                    const SizedBox(height: 16),
                    _row('Email', c['email'] ?? '-'),
                    _row('Phone', c['phone'] ?? '-'),
                    _row('Address', c['address'] ?? '-'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Credit Info ────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: KTColors.surface, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Credit', style: KTTextStyles.body.copyWith(color: KTColors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 12),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('Limit: ₹${creditLimit.toStringAsFixed(0)}', style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                      Text('Outstanding: ₹${outstanding.toStringAsFixed(0)}', style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
                    ]),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: utilization,
                        minHeight: 8,
                        backgroundColor: KTColors.borderColor,
                        valueColor: AlwaysStoppedAnimation(
                          utilization > 0.9 ? KTColors.danger : utilization > 0.7 ? KTColors.warning : KTColors.success,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text('${(utilization * 100).toStringAsFixed(0)}% used',
                          style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 80, child: Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted))),
          Expanded(child: Text(value, style: KTTextStyles.body.copyWith(color: KTColors.textHeading))),
        ],
      ),
    );
  }
}

final _clientDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, clientId) async {
  final api = ref.watch(apiServiceProvider);
  final resp = await api.get('/clients/$clientId');
  if (resp is Map && resp['data'] != null) {
    return Map<String, dynamic>.from(resp['data'] as Map);
  }
  return Map<String, dynamic>.from(resp as Map);
});
