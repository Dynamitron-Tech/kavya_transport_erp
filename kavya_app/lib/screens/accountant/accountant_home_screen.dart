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

                // Section 4 — Pending expense approvals count [cite: 74-75]
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.receipt_long, color: KTColors.acctAccent),
                    title: const Text("Pending expense approvals"),
                    trailing: ElevatedButton(
                      onPressed: () => context.push('/accountant/expenses'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: KTColors.acctAccent,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(80, 36)),
                      child: const Text("Review"),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Section 5 — Recent payments [cite: 75]
                Text("Recent payments", style: KTTextStyles.h3),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Column(
                    children: List.generate(3, (index) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text("Acme Corp", style: KTTextStyles.label),
                                const SizedBox(height: 2),
                                Text("15 Mar 2026", style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                              ],
                            ),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(currencyFormat.format(45000), style: KTTextStyles.h3),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: KTColors.acctAccent.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text("NEFT", style: TextStyle(fontSize: 10, color: KTColors.acctAccent, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    )),
                  ),
                ),
                const SizedBox(height: 24),

                // Quick actions (horizontal scroll) [cite: 75-76]
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.payment, label: "Record payment", onTap: () => context.push('/accountant/receivables'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.description, label: "Generate invoice", onTap: () => context.push('/accountant/invoices'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.account_balance, label: "GST view", onTap: () => context.push('/accountant/gst'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.book, label: "Full ledger", onTap: () => context.push('/accountant/ledger'), iconColor: KTColors.acctAccent, bgColor: KTColors.acctAccentBg)),
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