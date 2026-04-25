import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'kt_colors.dart';
import 'kt_text_styles.dart';

/// Kavya Transports App Theme
/// Light theme for admin/manager/accountant screens (green accent).
/// Dark theme for driver screens (navy + green accent).
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: KTColors.primary,
        onPrimary: KTColors.white,
        secondary: KTColors.primaryDark,
        surface: KTColors.surface,
        onSurface: KTColors.textBody,
        error: KTColors.danger,
      ),
      fontFamily: GoogleFonts.poppins().fontFamily,
      scaffoldBackgroundColor: KTColors.lightBg,

      // ============= APP BAR THEME =============
      appBarTheme: AppBarTheme(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: KTTextStyles.h1.copyWith(color: KTColors.textHeading),
        iconTheme: const IconThemeData(color: KTColors.textHeading, size: 24),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        shape: const Border(
          bottom: BorderSide(color: KTColors.borderColor, width: 1),
        ),
      ),

      // ============= CARD THEME =============
      cardTheme: CardThemeData(
        elevation: 0,
        color: KTColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: KTColors.borderColor, width: 1),
        ),
        margin: EdgeInsets.zero,
        shadowColor: Colors.transparent,
      ),

      // ============= ELEVATED BUTTON THEME =============
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.primary,
          foregroundColor: KTColors.white,
          disabledBackgroundColor: KTColors.gray200,
          disabledForegroundColor: KTColors.gray400,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: KTTextStyles.buttonLarge,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
      ),

      // ============= TEXT BUTTON THEME =============
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: KTColors.primary,
          textStyle: KTTextStyles.buttonMedium,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      // ============= OUTLINED BUTTON THEME =============
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: KTColors.primary,
          side: const BorderSide(color: KTColors.primary, width: 1.5),
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: KTTextStyles.buttonMedium,
        ),
      ),

      // ============= INPUT DECORATION THEME =============
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KTColors.lightBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.borderColor, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.danger, width: 2),
        ),
        hintStyle: KTTextStyles.hint.copyWith(color: KTColors.textMuted),
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.textBody),
        prefixIconColor: KTColors.textMuted,
        suffixIconColor: KTColors.textMuted,
      ),

      // ============= NAVIGATION BAR THEME =============
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: KTColors.surface,
        indicatorColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return KTTextStyles.caption.copyWith(
              color: KTColors.primary,
              fontWeight: FontWeight.w500,
              fontSize: 10,
            );
          }
          return KTTextStyles.caption.copyWith(
            color: KTColors.textMuted,
            fontWeight: FontWeight.w400,
            fontSize: 10,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: KTColors.primary, size: 20);
          }
          return const IconThemeData(color: KTColors.textMuted, size: 20);
        }),
      ),

      // ============= CHIP THEME =============
      chipTheme: ChipThemeData(
        backgroundColor: KTColors.lightBg,
        selectedColor: KTColors.successBg,
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.textBody),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        showCheckmark: false,
        side: const BorderSide(color: KTColors.borderColor),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),

      // ============= SNACKBAR THEME =============
      snackBarTheme: SnackBarThemeData(
        backgroundColor: KTColors.textHeading,
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),

      // ============= DIALOG THEME =============
      dialogTheme: DialogThemeData(
        backgroundColor: KTColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titleTextStyle: KTTextStyles.h2.copyWith(color: KTColors.textHeading),
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.textBody),
      ),

      // ============= DIVIDER THEME =============
      dividerTheme: const DividerThemeData(
        color: KTColors.borderColor,
        thickness: 1,
        space: 16,
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: KTColors.primary,
        onPrimary: KTColors.white,
        secondary: KTColors.primaryDark,
        surface: KTColors.navy900,
        surfaceDim: KTColors.navy800,
        error: KTColors.danger,
        scrim: KTColors.navy950,
      ),
      fontFamily: GoogleFonts.poppins().fontFamily,
      scaffoldBackgroundColor: KTColors.navy950,

      // ============= APP BAR THEME (Dark) =============
      appBarTheme: AppBarTheme(
        backgroundColor: KTColors.navy900,
        foregroundColor: KTColors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: KTTextStyles.h2.copyWith(color: KTColors.white),
        iconTheme: const IconThemeData(color: KTColors.white),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarBrightness: Brightness.dark,
          statusBarIconBrightness: Brightness.light,
        ),
      ),

      // ============= CARD THEME (Dark) =============
      cardTheme: CardThemeData(
        elevation: 0,
        color: KTColors.navy800,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: KTColors.darkBorder, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),

      // ============= ELEVATED BUTTON THEME (Dark) =============
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.primary,
          foregroundColor: KTColors.white,
          disabledBackgroundColor: KTColors.navy600,
          disabledForegroundColor: KTColors.gray400,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: KTTextStyles.buttonLarge,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
      ),

      // ============= TEXT BUTTON THEME (Dark) =============
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: KTColors.primary,
          textStyle: KTTextStyles.buttonMedium,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      // ============= OUTLINED BUTTON THEME (Dark) =============
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: KTColors.white,
          side: const BorderSide(color: KTColors.navy600, width: 1.5),
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: KTTextStyles.buttonMedium,
        ),
      ),

      // ============= INPUT DECORATION THEME (Dark) =============
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KTColors.navy800,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.navy700, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.navy700, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: KTColors.danger, width: 2),
        ),
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.white),
        hintStyle: KTTextStyles.hint.copyWith(color: KTColors.darkTextSecondary),
        prefixIconColor: KTColors.gray400,
        suffixIconColor: KTColors.gray400,
      ),

      // ============= CHIP THEME (Dark) =============
      chipTheme: ChipThemeData(
        backgroundColor: KTColors.navy700,
        selectedColor: KTColors.primary,
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        showCheckmark: false,
      ),

      // ============= SNACKBAR THEME (Dark) =============
      snackBarTheme: SnackBarThemeData(
        backgroundColor: KTColors.navy700,
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),

      // ============= DIALOG THEME (Dark) =============
      dialogTheme: DialogThemeData(
        backgroundColor: KTColors.navy800,
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titleTextStyle: KTTextStyles.h2.copyWith(color: KTColors.white),
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.darkTextSecondary),
      ),

      // ============= DIVIDER THEME (Dark) =============
      dividerTheme: const DividerThemeData(
        color: KTColors.darkBorder,
        thickness: 1,
        space: 16,
      ),
    );
  }
}
