import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

/// Kavya Transports Button Component Library
class KTButton {
  /// Primary action button (Amber background, Navy text)
  static Widget primary({
    required VoidCallback? onPressed,
    required String label,
    bool isLoading = false,
    Widget? leading,
    Widget? trailing,
    double width = double.infinity,
    double height = 52,
    EdgeInsets padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.amber500,
          foregroundColor: KTColors.navy900,
          disabledBackgroundColor: KTColors.gray300,
          disabledForegroundColor: KTColors.gray400,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: EdgeInsets.zero,
        ),
        child: isLoading
            ? SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    KTColors.navy900.withOpacity(0.7),
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (leading != null) ...[
                    leading,
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: KTTextStyles.buttonLarge.copyWith(
                      color: KTColors.navy900,
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing,
                  ],
                ],
              ),
      ),
    );
  }

  /// Secondary button (Navy background, White text)
  static Widget secondary({
    required VoidCallback? onPressed,
    required String label,
    bool isLoading = false,
    Widget? leading,
    Widget? trailing,
    double width = double.infinity,
    double height = 48,
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.navy700,
          foregroundColor: KTColors.white,
          disabledBackgroundColor: KTColors.gray400,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    KTColors.white,
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (leading != null) ...[
                    leading,
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: KTTextStyles.buttonMedium.copyWith(
                      color: KTColors.white,
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing,
                  ],
                ],
              ),
      ),
    );
  }

  /// Danger/Destructive button (Red background, White text)
  static Widget danger({
    required VoidCallback? onPressed,
    required String label,
    bool isLoading = false,
    Widget? leading,
    double width = double.infinity,
    double height = 48,
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.danger,
          foregroundColor: KTColors.white,
          disabledBackgroundColor: KTColors.gray300,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    KTColors.white,
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (leading != null) ...[
                    leading,
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: KTTextStyles.buttonMedium.copyWith(
                      color: KTColors.white,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  /// Ghost button (Transparent background, Navy text)
  static Widget ghost({
    required VoidCallback? onPressed,
    required String label,
    Widget? leading,
    Widget? trailing,
    Color textColor = KTColors.navy700,
    double width = double.infinity,
    double height = 44,
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: textColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (leading != null) ...[
              leading,
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: KTTextStyles.buttonMedium.copyWith(color: textColor),
            ),
            if (trailing != null) ...[
              const SizedBox(width: 8),
              trailing,
            ],
          ],
        ),
      ),
    );
  }

  /// Outline button (Border, transparent background)
  static Widget outline({
    required VoidCallback? onPressed,
    required String label,
    Color borderColor = KTColors.navy700,
    Color textColor = KTColors.navy800,
    Widget? leading,
    double width = double.infinity,
    double height = 48,
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: textColor,
          side: BorderSide(color: borderColor, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (leading != null) ...[
              leading,
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: KTTextStyles.buttonMedium.copyWith(color: textColor),
            ),
          ],
        ),
      ),
    );
  }

  /// Icon-only button (compact circular button)
  static Widget icon({
    required VoidCallback? onPressed,
    required IconData icon,
    Color backgroundColor = KTColors.amber500,
    Color iconColor = KTColors.navy900,
    double size = 48,
  }) {
    return SizedBox(
      width: size,
      height: size,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: iconColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: EdgeInsets.zero,
          elevation: 0,
        ),
        child: Icon(icon, color: iconColor, size: 24),
      ),
    );
  }

  /// Floating action button (circular, amber)
  static Widget fab({
    required VoidCallback? onPressed,
    required IconData icon,
    String? label,
    Color backgroundColor = KTColors.amber500,
    Color iconColor = KTColors.navy900,
  }) {
    return FloatingActionButton.extended(
      onPressed: onPressed,
      backgroundColor: backgroundColor,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      icon: Icon(icon, color: iconColor, size: 24),
      label: label != null
          ? Text(
              label,
              style: KTTextStyles.buttonMedium.copyWith(color: iconColor),
            )
          : const SizedBox.shrink(),
    );
  }

  /// Small compact button
  static Widget small({
    required VoidCallback? onPressed,
    required String label,
    Color backgroundColor = KTColors.amber500,
    Color textColor = KTColors.navy900,
    double width = 100,
    double height = 36,
  }) {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: textColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          elevation: 0,
        ),
        child: Text(
          label,
          style: KTTextStyles.buttonSmall.copyWith(color: textColor),
        ),
      ),
    );
  }
}

// ============= LEGACY COMPATIBILITY =============
/// Legacy KtButton class for backward compatibility
class KtButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;
  final bool outlined;

  const KtButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.icon,
    this.outlined = false,
  });

  @override
  Widget build(BuildContext context) {
    if (outlined) {
      return OutlinedButton.icon(
        onPressed: isLoading ? null : onPressed,
        icon: isLoading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : (icon != null ? Icon(icon, size: 18) : const SizedBox.shrink()),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: KTColors.primary,
          side: const BorderSide(color: KTColors.primary),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }

    return ElevatedButton.icon(
      onPressed: isLoading ? null : onPressed,
      icon: isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white))
          : (icon != null ? Icon(icon, size: 18) : const SizedBox.shrink()),
      label: Text(label),
    );
  }
}
