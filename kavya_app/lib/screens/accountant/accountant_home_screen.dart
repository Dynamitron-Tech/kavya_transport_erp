import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
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
                label: Text(today, style: const TextStyle(color: KTColors.primaryDark, fontWeight: FontWeight.bold)), // date chip [cite: 73]
                backgroundColor: KTColors.primaryLight,
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
          color: KTColors.primary,
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

                // Section 2 — Aging buckets visualization [cite: 73-74]
                Text("Outstanding aging", style: KTTextStyles.h3),
                const SizedBox(height: 16),
                SizedBox(
                  height: 60,
                  child: BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.center,
                      maxY: 100,
                      barTouchData: BarTouchData(enabled: false),
                      titlesData: FlTitlesData(show: false),
                      borderData: FlBorderData(show: false),
                      gridData: FlGridData(show: false),
                      barGroups: [
                        BarChartGroupData(
                          x: 0,
                          barRods: [
                            BarChartRodData(
                              toY: 100,
                              rodStackItems: [
                                BarChartRodStackItem(0, 40, KTColors.success), // Current [cite: 73-74]
                                BarChartRodStackItem(40, 70, Colors.yellow.shade700), // 0-30
                                BarChartRodStackItem(70, 85, Colors.orange), // 31-60
                                BarChartRodStackItem(85, 95, KTColors.primary), // 61-90
                                BarChartRodStackItem(95, 100, KTColors.danger), // 90+ days [cite: 74]
                              ],
                              borderRadius: BorderRadius.circular(8),
                              width: double.infinity,
                            ),
                          ],
                        ),
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
                    Text("61-90", style: KTTextStyles.bodySmall.copyWith(color: KTColors.primary)),
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
                    leading: const Icon(Icons.receipt_long, color: KTColors.roleAccountant),
                    title: const Text("Pending expense approvals"),
                    trailing: ElevatedButton(
                      onPressed: () => context.push('/accountant/expenses'),
                      style: ElevatedButton.styleFrom(minimumSize: const Size(80, 36)),
                      child: const Text("Review"),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Section 5 — Recent payments [cite: 75]
                Text("Recent payments", style: KTTextStyles.h3),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: List.generate(3, (index) => ListTile(
                      title: Text("Acme Corp", style: KTTextStyles.label),
                      subtitle: const Text("15 Mar 2026"),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(currencyFormat.format(45000), style: KTTextStyles.h3),
                          const SizedBox(height: 4),
                          Chip(
                            label: const Text("NEFT", style: TextStyle(fontSize: 10)),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                            backgroundColor: KTColors.success.withOpacity(0.1),
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
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.payment, label: "Record payment", onTap: () => context.push('/accountant/receivables'))),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.description, label: "Generate invoice", onTap: () {})),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.account_balance, label: "GST view", onTap: () {})),
                      const SizedBox(width: 12),
                      SizedBox(width: 120, child: KTActionButton(icon: Icons.book, label: "Full ledger", onTap: () {})),
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