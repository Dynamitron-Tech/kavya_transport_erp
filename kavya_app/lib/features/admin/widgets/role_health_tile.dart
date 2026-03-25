import 'package:flutter/material.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

/// Role health card used on admin dashboard (light theme).
class RoleHealthTile extends StatelessWidget {
  final String role;
  final String label;
  final String detailText;
  final String statusLabel;
  final Color statusColor;

  const RoleHealthTile({
    super.key,
    required this.role,
    required this.label,
    required this.detailText,
    required this.statusLabel,
    required this.statusColor,
  });

  String get _initials {
    final words = label.split(' ');
    if (words.length >= 2) return '${words[0][0]}${words[1][0]}';
    return label.substring(0, label.length.clamp(0, 2)).toUpperCase();
  }

  Color get _avatarColor {
    switch (role) {
      case 'MANAGER':
        return KTColors.info;
      case 'PROJECT_ASSOCIATE':
        return KTColors.amber500;
      case 'FLEET_MANAGER':
        return KTColors.primary;
      case 'ACCOUNTANT':
        return const Color(0xFF7C3AED);
      case 'DRIVER':
        return KTColors.gray500;
      default:
        return KTColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
        boxShadow: const [
          BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _avatarColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                _initials,
                style: TextStyle(
                  color: _avatarColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  fontFamily: 'Poppins',
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                const SizedBox(height: 2),
                Text(detailText,
                    style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              statusLabel,
              style: KTTextStyles.labelCaps.copyWith(
                color: statusColor,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
