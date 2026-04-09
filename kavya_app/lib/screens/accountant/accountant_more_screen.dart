import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';

class AccountantMoreScreen extends StatelessWidget {
  const AccountantMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // 6 grid items + 1 full-width Banking card
    final gridItems = [
      _MenuItem(Icons.payments_outlined, 'Payments', 'Driver & vendor payouts', '/accountant/payments', KTColors.info),
      _MenuItem(Icons.account_balance_wallet_outlined, 'Receivables', 'Track outstanding dues', '/accountant/receivables', KTColors.success),
      _MenuItem(Icons.money_off_outlined, 'Payables', 'Manage pending bills', '/accountant/payables', KTColors.danger),
      _MenuItem(Icons.receipt_long_outlined, 'GST', 'Tax reports & filing', '/accountant/gst', KTColors.warning),
      _MenuItem(Icons.task_alt_outlined, 'Expense Approvals', 'Review & approve claims', '/accountant/approvals', KTColors.acctAccent),
      _MenuItem(Icons.people_outlined, 'Settlements', 'Driver settlements', '/accountant/settlements', KTColors.roleManager),
      _MenuItem(Icons.verified_outlined, 'Auditor Report', 'Full financial audit & export', '/accountant/auditor-report', const Color(0xFF6366F1)),
      _MenuItem(Icons.account_balance_wallet_outlined, 'Payments Hub', 'All outgoing payments', '/accountant/payments-hub', const Color(0xFF059669)),
    ];
    final bankingItem = _MenuItem(
      Icons.account_balance_outlined,
      'Banking',
      'Bank accounts & transactions',
      '/accountant/banking',
      KTColors.roleFleetManager,
    );

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Modules', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
                    const SizedBox(height: 4),
                    Text('All finance tools in one place',
                        style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _MenuCard(item: gridItems[i]),
                  childCount: gridItems.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.45,
                ),
              ),
            ),
            // Full-width Banking card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                child: _FullWidthCard(item: bankingItem),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final String subtitle;
  final String route;
  final Color color;
  _MenuItem(this.icon, this.label, this.subtitle, this.route, this.color);
}

class _MenuCard extends StatelessWidget {
  final _MenuItem item;
  const _MenuCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: KTColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => context.push(item.route),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: KTColors.borderColor),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(item.icon, color: item.color, size: 22),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.label,
                      style: const TextStyle(
                          color: KTColors.textHeading,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: KTColors.textMuted,
                          fontSize: 10)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FullWidthCard extends StatelessWidget {
  final _MenuItem item;
  const _FullWidthCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: item.color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => context.push(item.route),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: item.color.withValues(alpha: 0.25)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(item.icon, color: item.color, size: 26),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.label,
                        style: TextStyle(
                            color: item.color,
                            fontSize: 15,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(item.subtitle,
                        style: const TextStyle(
                            color: KTColors.textMuted, fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded, color: item.color, size: 16),
            ],
          ),
        ),
      ),
    );
  }
}
