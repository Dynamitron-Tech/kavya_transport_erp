import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

final _ewbDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.get('/eway-bills/$id');
  if (response is Map<String, dynamic> && response['data'] != null) {
    return Map<String, dynamic>.from(response['data'] as Map);
  }
  if (response is Map<String, dynamic>) return response;
  return {};
});

class PAEWBDetailScreen extends ConsumerWidget {
  final int ewbId;
  const PAEWBDetailScreen({super.key, required this.ewbId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ewbAsync = ref.watch(_ewbDetailProvider(ewbId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('EWB Detail', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        leading: const BackButton(color: KTColors.textHeading),
      ),
      body: ewbAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.card),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_ewbDetailProvider(ewbId)),
        ),
        data: (ewb) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailCard(children: [
                _Row('EWB Number', ewb['ewb_number'] ?? '—'),
                _Row('Status', ewb['status'] ?? '—'),
                _Row('LR Number', ewb['lr_number'] ?? '—'),
                _Row('Valid From', _fmt(ewb['valid_from'])),
                _Row('Valid Until', _fmt(ewb['valid_until'])),
              ]),
              const SizedBox(height: 14),
              Text('Route', style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
              const SizedBox(height: 8),
              _DetailCard(children: [
                _Row('From', ewb['from_gstin'] ?? ewb['from_address'] ?? '—'),
                _Row('To', ewb['to_gstin'] ?? ewb['to_address'] ?? '—'),
                _Row('Vehicle', ewb['vehicle_reg_number'] ?? '—'),
                _Row('Driver', ewb['driver_name'] ?? '—'),
              ]),
              const SizedBox(height: 20),

              // ── Extend action ─────────────────────────────────────────
              if (ewb['status'] == 'active' || ewb['status'] == 'expiring')
                SizedBox(
                  width: double.infinity,
                  child: _ExtendButton(ewbId: ewbId, ref: ref),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmt(dynamic v) {
    if (v == null) return '—';
    final dt = DateTime.tryParse(v.toString());
    if (dt == null) return v.toString();
    return '${dt.year}-${_p(dt.month)}-${_p(dt.day)} ${_p(dt.hour)}:${_p(dt.minute)}';
  }

  String _p(int n) => n.toString().padLeft(2, '0');
}

class _ExtendButton extends ConsumerStatefulWidget {
  final int ewbId;
  final WidgetRef ref;
  const _ExtendButton({required this.ewbId, required this.ref});

  @override
  ConsumerState<_ExtendButton> createState() => _ExtendButtonState();
}

class _ExtendButtonState extends ConsumerState<_ExtendButton> {
  bool _busy = false;

  Future<void> _extend() async {
    setState(() => _busy = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/eway-bills/${widget.ewbId}/extend');
      if (mounted) {
        ref.invalidate(_ewbDetailProvider(widget.ewbId));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('EWB extended successfully'),
            backgroundColor: KTColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      icon: const Icon(Icons.update),
      label: const Text('Extend EWB Validity'),
      style: ElevatedButton.styleFrom(
        backgroundColor: KTColors.warning,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
      ),
      onPressed: _busy ? null : _extend,
    );
  }
}

class _DetailCard extends StatelessWidget {
  final List<Widget> children;
  const _DetailCard({required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(children: children),
      );
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            Flexible(
              child: Text(
                value,
                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textHeading),
                textAlign: TextAlign.end,
              ),
            ),
          ],
        ),
      );
}
