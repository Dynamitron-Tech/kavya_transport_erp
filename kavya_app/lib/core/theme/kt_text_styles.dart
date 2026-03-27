import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Kavya Transports Typography System
/// All Poppins — consistent across both admin (light) and driver (dark) screens.
class KTTextStyles {
  // ============= DISPLAY =============
  /// Display: Poppins 600, 22px — KPI values, hero text
  static TextStyle get display => GoogleFonts.poppins(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    height: 1.2,
  );

  /// Legacy aliases kept for backward compatibility
  static TextStyle get displayLarge => GoogleFonts.poppins(
    fontSize: 36,
    fontWeight: FontWeight.w700,
    height: 1.1,
    letterSpacing: -0.5,
  );

  static TextStyle get displayMedium => GoogleFonts.poppins(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    height: 1.2,
    letterSpacing: -0.5,
  );

  // ============= HEADINGS =============
  /// H1: Poppins 600, 18px
  static TextStyle get h1 => GoogleFonts.poppins(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.3,
  );

  /// H2: Poppins 600, 16px
  static TextStyle get h2 => GoogleFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.4,
  );

  /// H3: Poppins 500, 14px
  static TextStyle get h3 => GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  // ============= BODY TEXT =============
  /// Body: Poppins 400, 13px
  static TextStyle get body => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.6,
  );

  static TextStyle get bodyLarge => GoogleFonts.poppins(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.6,
  );

  static TextStyle get bodyMedium => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.6,
  );

  static TextStyle get bodySmall => GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.5,
  );

  // ============= LABELS =============
  /// Label: Poppins 500, 13px
  static TextStyle get label => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  static TextStyle get labelSmall => GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.4,
  );

  /// labelCaps: Poppins 600, 11px, uppercase, letter-spacing 0.5
  static TextStyle get labelCaps => GoogleFonts.poppins(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
    height: 1.4,
  );

  static TextStyle get hint => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.5,
  );

  // ============= SPECIALIZED =============
  /// Caption: Poppins 400, 11px
  static TextStyle get caption => GoogleFonts.poppins(
    fontSize: 11,
    fontWeight: FontWeight.w400,
    height: 1.4,
  );

  /// KPI number display (large)
  static TextStyle get kpiNumber => GoogleFonts.poppins(
    fontSize: 28,
    fontWeight: FontWeight.w600,
    height: 1.2,
  );

  /// Monospace-style small (IDs, codes) — still Poppins for consistency
  static TextStyle get monospaceSmall => GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.4,
  );

  static TextStyle get mono => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  // ============= TABLE / DATA =============
  static TextStyle get tableHeader => GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    height: 1.5,
    letterSpacing: 0.5,
  );

  static TextStyle get tableCell => GoogleFonts.poppins(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.5,
  );

  // ============= BUTTON TEXT =============
  static TextStyle get buttonLarge => GoogleFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.5,
    letterSpacing: 0.2,
  );

  static TextStyle get buttonMedium => GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.5,
    letterSpacing: 0.2,
  );

  static TextStyle get buttonSmall => GoogleFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    height: 1.4,
    letterSpacing: 0.1,
  );
}