import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';

/// Advanced quick action tile — fixed grid layout (light theme).
class QuickActionTile extends StatelessWidget {
  final Color color;
  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final String? badge;

  const QuickActionTile({
    super.key,
    required this.color,
    required this.label,
    required this.onTap,
    this.icon,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(16),
        splashColor: color.withValues(alpha: 0.10),
        highlightColor: color.withValues(alpha: 0.06),
        child: Ink(
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: KTColors.borderColor, width: 1),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0F000000),
                  blurRadius: 10,
                  offset: Offset(0, 3)),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            color.withValues(alpha: 0.18),
                            color.withValues(alpha: 0.08),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: color.withValues(alpha: 0.20),
                          width: 1,
                        ),
                      ),
                      child: Icon(
                        icon ?? Icons.flash_on_rounded,
                        color: color,
                        size: 22,
                      ),
                    ),
                    if (badge != null)
                      Positioned(
                        top: -4,
                        right: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 1),
                          constraints:
                              const BoxConstraints(minWidth: 16, minHeight: 16),
                          decoration: BoxDecoration(
                            color: KTColors.danger,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: KTColors.surface, width: 1.5),
                          ),
                          child: Text(
                            badge!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              height: 1.0,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: KTTextStyles.caption.copyWith(
                    color: KTColors.textBody,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
