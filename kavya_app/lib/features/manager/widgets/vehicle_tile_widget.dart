import 'package:flutter/material.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

class VehicleTileWidget extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  final bool isSelected;
  final bool isDisabled;
  final VoidCallback? onTap;

  const VehicleTileWidget({
    super.key,
    required this.vehicle,
    this.isSelected = false,
    this.isDisabled = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final regNumber = vehicle['registration_number'] ?? '—';
    final make = vehicle['make'] ?? '';
    final model = vehicle['model'] ?? '';
    final capacityRaw = vehicle['capacity_tons'];
    final capacity = capacityRaw == null
        ? ''
        : (double.tryParse(capacityRaw.toString()) ?? 0.0).toInt().toString();
    final status = (vehicle['status'] as String?)?.toUpperCase() ?? '';
    final isAvailable = status == 'AVAILABLE';
    final location = vehicle['current_location'] ?? '';

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
              Icon(
                Icons.circle,
                size: 10,
                color: isAvailable ? KTColors.success : KTColors.warning,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(regNumber, style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                    Text(
                      '$make $model ${capacity}T${location.isNotEmpty ? ' · $location' : ''}',
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
