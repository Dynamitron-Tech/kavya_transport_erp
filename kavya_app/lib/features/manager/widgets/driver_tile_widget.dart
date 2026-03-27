import 'package:flutter/material.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

class DriverTileWidget extends StatelessWidget {
  final Map<String, dynamic> driver;
  final bool isSelected;
  final bool isDisabled;
  final VoidCallback? onTap;

  const DriverTileWidget({
    super.key,
    required this.driver,
    this.isSelected = false,
    this.isDisabled = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = driver['name'] ?? '${driver['first_name'] ?? ''} ${driver['last_name'] ?? ''}'.trim();
    final license = driver['license_number'] ?? '';
    final phone = driver['phone'] ?? '';
    final status = (driver['status'] as String?)?.toUpperCase() ?? '';
    final isAvailable = status == 'AVAILABLE' || status == 'ACTIVE';
    final initials = name.split(' ').take(2).map((w) => w.isNotEmpty ? w[0] : '').join().toUpperCase();

    return Opacity(
      opacity: isDisabled ? 0.5 : 1.0,
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? KTColors.managerAccent : KTColors.borderColor,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: isAvailable ? KTColors.success.withOpacity(0.2) : KTColors.warning.withOpacity(0.2),
                child: Text(initials, style: TextStyle(color: isAvailable ? KTColors.success : KTColors.warning, fontWeight: FontWeight.bold, fontSize: 13)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                    Text(
                      [if (license.isNotEmpty) 'Lic: $license', if (phone.isNotEmpty) phone].join(' · '),
                      style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: (isAvailable ? KTColors.success : KTColors.warning).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  isAvailable ? 'Available' : 'On trip',
                  style: TextStyle(
                    color: isAvailable ? KTColors.success : KTColors.warning,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
