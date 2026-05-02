import 'package:flutter/material.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

class ApprovalCardWidget extends StatelessWidget {
  final Map<String, dynamic> approval;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const ApprovalCardWidget({
    super.key,
    required this.approval,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final title = approval['title'] ?? '—';
    final submitter = approval['submitter_name'] ?? '—';
    final tripNumber = approval['trip_number'];
    final amount = (approval['amount'] as num?)?.toDouble() ?? 0;
    final description = approval['description'] ?? '';
    final date = approval['date'] ?? '';
    final receiptUrl = approval['receipt_url'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.managerAccent.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '₹${amount.toStringAsFixed(0)}',
                  style: TextStyle(color: KTColors.managerAccent, fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [submitter, if (tripNumber != null) tripNumber].join(' · '),
            style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '$description · $date',
              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
            ),
          ],
          if (receiptUrl != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: KTColors.lightBg,
                borderRadius: BorderRadius.circular(8),
                border: Border(bottom: BorderSide(color: KTColors.borderColor)),
              ),
              child: Text(
                'Receipt attached',
                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: onApprove,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.success,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text('Approve', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: onReject,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.danger,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
