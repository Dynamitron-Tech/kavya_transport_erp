import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'kt_colors.dart';
import 'kt_text_styles.dart';

/// Kavya Transports App Theme
/// Light theme for web/tablet, Dark theme (navy-based) for mobile driver app
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: KTColors.amber500,
        secondary: KTColors.navy800,
        tertiary: KTColors.navy600,
        surface: KTColors.navy50,
        error: KTColors.danger,
        scrim: KTColors.gray900,
      ),
      fontFamily: GoogleFonts.inter().fontFamily,
      scaffoldBackgroundColor: KTColors.navy50,
      
      // ============= APP BAR THEME =============
      appBarTheme: AppBarTheme(
        backgroundColor: KTColors.white,
        foregroundColor: KTColors.navy800,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: KTTextStyles.h2.copyWith(color: KTColors.navy800),
        iconTheme: const IconThemeData(color: KTColors.navy800),
        scrolledUnderElevation: 1,
        shadowColor: Colors.black.withOpacity(0.1),
      ),

      // ============= CARD THEME =============
      cardTheme: CardThemeData(
        elevation: 0,
        color: KTColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: KTColors.gray200, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),

      // ============= ELEVATED BUTTON THEME =============
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.amber500,
          foregroundColor: KTColors.navy900,
          disabledBackgroundColor: KTColors.gray200,
          disabledForegroundColor: KTColors.gray400,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: KTTextStyles.buttonLarge,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
      ),

      // ============= TEXT BUTTON THEME =============
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: KTColors.amber500,
          textStyle: KTTextStyles.buttonMedium,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      // ============= OUTLINED BUTTON THEME =============
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: KTColors.navy800,
          side: const BorderSide(color: KTColors.navy800, width: 1.5),
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: KTTextStyles.buttonMedium,
        ),
      ),

      // ============= INPUT DECORATION THEME =============
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KTColors.gray100,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.gray300, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.gray300, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.amber500, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.danger, width: 2),
        ),
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.navy700),
        hintStyle: KTTextStyles.hint,
        prefixIconColor: KTColors.gray400,
        suffixIconColor: KTColors.gray400,
      ),

      // ============= CHIP THEME =============
      chipTheme: ChipThemeData(
        backgroundColor: KTColors.gray100,
        selectedColor: KTColors.amber100,
        labelStyle: KTTextStyles.label,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        showCheckmark: true,
      ),

      // ============= SNACKBAR THEME =============
      snackBarTheme: SnackBarThemeData(
        backgroundColor: KTColors.navy800,
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),

      // ============= DIALOG THEME =============
      dialogTheme: DialogThemeData(
        backgroundColor: KTColors.white,
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titleTextStyle: KTTextStyles.h2.copyWith(color: KTColors.navy800),
        contentTextStyle: KTTextStyles.body.copyWith(color: KTColors.gray700),
      ),

      // ============= DIVIDER THEME =============
      dividerTheme: const DividerThemeData(
        color: KTColors.gray200,
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
        primary: KTColors.amber500,
        secondary: KTColors.navy700,
        tertiary: KTColors.navy600,
        surface: KTColors.navy900,
        surfaceDim: KTColors.navy800,
        error: KTColors.danger,
        scrim: KTColors.navy950,
      ),
      fontFamily: GoogleFonts.inter().fontFamily,
      scaffoldBackgroundColor: KTColors.navy950,

      // ============= APP BAR THEME (Dark) =============
      appBarTheme: AppBarTheme(
        backgroundColor: KTColors.navy900,
        foregroundColor: KTColors.white,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: KTTextStyles.h2.copyWith(
          color: KTColors.white,
          fontFamily: GoogleFonts.poppins().fontFamily,
        ),
        iconTheme: const IconThemeData(color: KTColors.white),
        scrolledUnderElevation: 1,
        shadowColor: Colors.black.withOpacity(0.3),
      ),

      // ============= CARD THEME (Dark) =============
      cardTheme: CardThemeData(
        elevation: 0,
        color: KTColors.navy800,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: KTColors.navy700, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),

      // ============= ELEVATED BUTTON THEME (Dark) =============
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KTColors.amber500,
          foregroundColor: KTColors.navy900,
          disabledBackgroundColor: KTColors.navy600,
          disabledForegroundColor: KTColors.gray400,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: KTTextStyles.buttonLarge,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
      ),

      // ============= TEXT BUTTON THEME (Dark) =============
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: KTColors.amber400,
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
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: KTTextStyles.buttonMedium,
        ),
      ),

      // ============= INPUT DECORATION THEME (Dark) =============
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KTColors.navy800,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.navy700, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.navy700, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.amber500, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: KTColors.danger, width: 2),
        ),
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.white),
        hintStyle: KTTextStyles.hint.copyWith(color: KTColors.gray400),
        prefixIconColor: KTColors.gray400,
        suffixIconColor: KTColors.gray400,
      ),

      // ============= CHIP THEME (Dark) =============
      chipTheme: ChipThemeData(
        backgroundColor: KTColors.navy700,
        selectedColor: KTColors.amber600,
        labelStyle: KTTextStyles.label.copyWith(color: KTColors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        showCheckmark: true,
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
        color: KTColors.navy700,
        thickness: 1,
        space: 16,
      ),
    );
  }
}