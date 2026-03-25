import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';

class AccountantMoreScreen extends StatelessWidget {
  const AccountantMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      _MenuItem(Icons.payments_outlined, 'Payments', '/accountant/payments', KTColors.info),
      _MenuItem(Icons.account_balance_wallet_outlined, 'Receivables', '/accountant/receivables', KTColors.success),
      _MenuItem(Icons.money_off_outlined, 'Payables', '/accountant/payables', KTColors.danger),
      _MenuItem(Icons.receipt_long_outlined, 'GST', '/accountant/gst', KTColors.warning),
      _MenuItem(Icons.note_alt_outlined, 'Vouchers', '/accountant/vouchers', KTColors.roleProjectAssociate),
      _MenuItem(Icons.task_alt_outlined, 'Expense Approvals', '/accountant/approvals', KTColors.acctAccent),
      _MenuItem(Icons.people_outlined, 'Settlements', '/accountant/settlements', KTColors.roleManager),
      _MenuItem(Icons.account_balance_outlined, 'Banking', '/accountant/banking', KTColors.roleFleetManager),
    ];

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Modules', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
              const SizedBox(height: 16),
              Expanded(
                child: GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.6,
                  children: items.map((item) => _MenuCard(item: item)).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final String route;
  final Color color;
  _MenuItem(this.icon, this.label, this.route, this.color);
}

class _MenuCard extends StatelessWidget {
  final _MenuItem item;
  const _MenuCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push(item.route),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(item.icon, color: item.color, size: 28),
            const SizedBox(height: 8),
            Text(item.label,
                style: TextStyle(
                    color: KTColors.textHeading,
                    fontSize: 13,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
