import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../core/widgets/notification_bell_widget.dart';
import 'pa_providers.dart';

const _kPaAccent = KTColors.paAccent;

class PAEWBListScreen extends ConsumerStatefulWidget {
  const PAEWBListScreen({super.key});

  @override
  ConsumerState<PAEWBListScreen> createState() => _PAEWBListScreenState();
}

class _PAEWBListScreenState extends ConsumerState<PAEWBListScreen> {
  Timer? _timer;

  static const _filters = [
    ('All', null),
    ('Active', 'active'),
    ('Expiring', 'expiring'),
    ('Expired', 'expired'),
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _countdown(String? isoString) {
    if (isoString == null) return '';
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return '';
    final diff = dt.difference(DateTime.now());
    if (diff.isNegative) return 'EXPIRED';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    return '${diff.inHours}h';
  }

  String _countdownFull(String? isoString) {
    if (isoString == null) return '';
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return '';
    final diff = dt.difference(DateTime.now());
    if (diff.isNegative) return 'EXPIRED';
    if (diff.inHours < 1) return '${diff.inMinutes}m left';
    return '${diff.inHours}h ${diff.inMinutes % 60}m left';
  }

  double _progressFraction(String? validFrom, String? validUntil) {
    if (validFrom == null || validUntil == null) return 1.0;
    final from = DateTime.tryParse(validFrom);
    final until = DateTime.tryParse(validUntil);
    if (from == null || until == null) return 1.0;
    final total = until.difference(from).inMinutes;
    if (total <= 0) return 1.0;
    final elapsed = DateTime.now().difference(from).inMinutes;
    return (elapsed / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(paEWBFilterProvider);
    final ewbAsync = ref.watch(paEWBListProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        title: Text('E-Way Bills',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        actions: const [NotificationBellWidget()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: _filters.map((f) {
                final isActive = filter == f.$2;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () =>
                        ref.read(paEWBFilterProvider.notifier).state = f.$2,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isActive ? _kPaAccent : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: isActive
                                ? _kPaAccent
                                : KTColors.borderColor),
                      ),
                      child: Text(
                        f.$1,
                        style: TextStyle(
                          color: isActive
                              ? Colors.white
                              : KTColors.textMuted,
                          fontSize: 12,
                          fontWeight: isActive
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
      body: ewbAsync.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.list),
        error: (e, _) => KTErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(paEWBListProvider),
        ),
        data: (ewbs) {
          if (ewbs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.timer_off_outlined,
                      size: 52,
                      color: KTColors.textMuted.withValues(alpha: 0.4)),
                  const SizedBox(height: 12),
                  Text('No e-Way Bills found',
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textMuted)),
                ],
              ),
            );
          }

          final sorted = List<dynamic>.from(ewbs)
            ..sort((a, b) {
              final dtA = DateTime.tryParse(
                      (a as Map)['valid_until'] ?? '') ??
                  DateTime(9999);
              final dtB = DateTime.tryParse(
                      (b as Map)['valid_until'] ?? '') ??
                  DateTime(9999);
              return dtA.compareTo(dtB);
            });

          return RefreshIndicator(
            color: _kPaAccent,
            backgroundColor: KTColors.surface,
            onRefresh: () async => ref.invalidate(paEWBListProvider),
            child: ListView.builder(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              itemCount: sorted.length,
              itemBuilder: (context, i) {
                final ewb = Map<String, dynamic>.from(sorted[i] as Map);
                final progress = _progressFraction(
                  ewb['valid_from'] as String?,
                  ewb['valid_until'] as String?,
                );
                final countdown = _countdown(ewb['valid_until'] as String?);
                final countdownFull =
                    _countdownFull(ewb['valid_until'] as String?);
                final isUrgent = ewb['status'] == 'expiring' ||
                    ewb['status'] == 'expired';

                return _EWBRingCard(
                  ewb: ewb,
                  progress: progress,
                  countdown: countdown,
                  countdownFull: countdownFull,
                  isUrgent: isUrgent,
                  onTap: () => context.push('/pa/ewb/${ewb['id']}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ── EWB Ring Card ─────────────────────────────────────────────────────────────

class _EWBRingCard extends StatelessWidget {
  final Map<String, dynamic> ewb;
  final double progress;
  final String countdown;
  final String countdownFull;
  final bool isUrgent;
  final VoidCallback onTap;

  const _EWBRingCard({
    required this.ewb,
    required this.progress,
    required this.countdown,
    required this.countdownFull,
    required this.isUrgent,
    required this.onTap,
  });

  Color get _ringColor {
    if (countdown == 'EXPIRED') return KTColors.danger;
    if (progress >= 0.80) return KTColors.danger;
    if (progress >= 0.60) return KTColors.warning;
    return KTColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final status = ewb['status'] as String?;
    final isCancelled = status == 'cancelled';
    final ringColor = _ringColor;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUrgent
                ? KTColors.danger.withValues(alpha: 0.6)
                : KTColors.borderColor,
            width: isUrgent ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            // Circular countdown ring or status icon
            if (isCancelled)
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: KTColors.borderColor.withValues(alpha: 0.3),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cancel_outlined,
                    color: KTColors.textMuted, size: 28),
              )
            else
            SizedBox(
              width: 64,
              height: 64,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 5,
                    backgroundColor:
                        KTColors.borderColor.withValues(alpha: 0.5),
                    valueColor: AlwaysStoppedAnimation<Color>(ringColor),
                    strokeCap: StrokeCap.round,
                  ),
                  Center(
                    child: countdown == 'EXPIRED'
                        ? const Icon(Icons.close,
                            color: KTColors.danger, size: 22)
                        : Text(
                            countdown.isEmpty ? '—' : countdown,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: countdown.length > 4 ? 10 : 13,
                              fontWeight: FontWeight.w800,
                              color: ringColor,
                            ),
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          ewb['ewb_number'] ??
                              ewb['id']?.toString() ??
                              '—',
                          style: KTTextStyles.body.copyWith(
                            color: KTColors.textHeading,
                            fontWeight: FontWeight.bold,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.chevron_right,
                          color: KTColors.textMuted, size: 18),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    ewb['lr_number'] ?? ewb['lr_no'] ?? '',
                    style: KTTextStyles.bodySmall
                        .copyWith(color: KTColors.textMuted),
                  ),
                  const SizedBox(height: 6),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: ringColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        countdownFull.isEmpty
                            ? (ewb['status'] ?? '')
                            : countdownFull,
                        style: TextStyle(
                          color: ringColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


