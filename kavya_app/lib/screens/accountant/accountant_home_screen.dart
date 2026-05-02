import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/kt_alert_card.dart';
import '../../core/widgets/kt_action_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/kt_error_state.dart';
import '../../providers/accountant_dashboard_provider.dart';

class AccountantHomeScreen extends ConsumerWidget {
  const AccountantHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(accountantDashboardProvider);
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0); // [cite: 115]
    final today = DateFormat('dd MMM yyyy').format(DateTime.now()); // [cite: 115]

    return Scaffold(
      appBar: AppBar(
        title: const Text("Finance overview"), // [cite: 73]
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: Chip(
                label: Text(today, style: const TextStyle(color: KTColors.acctAccentDark, fontWeight: FontWeight.bold)), // date chip [cite: 73]
                backgroundColor: KTColors.acctAccentBg,
                side: BorderSide.none,
              ),
            ),
          )
        ],
      ),
      body: dashboardState.when(
        loading: () => const KTLoadingShimmer(type: ShimmerType.card), // [cite: 109-110]
        error: (err, stack) => KTErrorState(message: err.toString(), onRetry: () => ref.invalidate(accountantDashboardProvider)), // [cite: 111-113]
        data: (data) => RefreshIndicator(
          color: KTColors.acctAccent,
          onRefresh: () async => ref.invalidate(accountantDashboardProvider), // [cite: 118]
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Section 1 — 4 KTStatCards (2x2 grid) [cite: 73]
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.2,
                  children: [
                    KTStatCard(title: "Total receivables", value: currencyFormat.format(data['total_receivables'] ?? 1245000), color: KTColors.info, icon: Icons.account_balance_wallet),
                    KTStatCard(title: "Overdue", value: currencyFormat.format(data['overdue_receivables'] ?? 420000), color: KTColors.danger, icon: Icons.warning_amber_rounded),
                    KTStatCard(title: "GST payable", value: currencyFormat.format(data['gst_payable'] ?? 85000), color: KTColors.warning, icon: Icons.receipt),
                    KTStatCard(title: "Bank balance", value: currencyFormat.format(data['bank_balance'] ?? 2500000), color: KTColors.success, icon: Icons.account_balance),
                  ],
                ),
                const SizedBox(height: 24),

                // Section 2 — Aging buckets visualization
                Text("Outstanding aging", style: KTTextStyles.h3),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 20,
                    child: Row(
                      children: [
                        Flexible(flex: 40, child: Container(color: KTColors.success)),
                        Flexible(flex: 30, child: Container(color: Colors.yellow.shade700)),
                        Flexible(flex: 15, child: Container(color: Colors.orange)),
                        Flexible(flex: 10, child: Container(color: KTColors.acctAccent)),
                        Flexible(flex: 5, child: Container(color: KTColors.danger)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Current", style: KTTextStyles.bodySmall.copyWith(color: KTColors.success)),
                    Text("0-30", style: KTTextStyles.bodySmall.copyWith(color: Colors.yellow.shade800)),
                    Text("31-60", style: KTTextStyles.bodySmall.copyWith(color: Colors.orange)),
                    Text("61-90", style: KTTextStyles.bodySmall.copyWith(color: KTColors.acctAccent)),
                    Text("90+", style: KTTextStyles.bodySmall.copyWith(color: KTColors.danger, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 24),

                // Section 3 — "Invoices due this week" [cite: 74]
                KTAlertCard(
                  title: "Invoices due this week",
                  count: 1,
                  items: const ["Acme Transport — ₹45,000 due in 2 days"],
                  severity: AlertSeverity.medium,
                  onTap: () => context.push('/accountant/invoices'),
                ),
                const SizedBox(height: 16),

                // Section 4 — Role clarity notice
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 16, color: Color(0xFF4F46E5)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Invoice review, bank reconciliation & GST. Payments are managed by the Finance Manager.',
                          style: KTTextStyles.bodySmall.copyWith(color: const Color(0xFF4338CA)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Quick actions (horizontal scroll)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.description_outlined, label: "View invoices", onTap: () => context.push('/accountant/invoices'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.account_balance_outlined, label: "Banking", onTap: () => context.push('/accountant/banking'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.receipt_long_outlined, label: "GST view", onTap: () => context.push('/accountant/gst'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.book_outlined, label: "Full ledger", onTap: () => context.push('/accountant/ledger'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                    ],
                  ),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}