import 'package:flutter/material.dart';

/// Kavya Transports Design System Colors
/// Light UI with green accent (admin/manager), dark navy for driver screens.
class KTColors {
  // ============= LIGHT THEME CORE =============
  /// Page background — off-white
  static const lightBg = Color(0xFFF7F9FC);
  /// Card / surface — pure white
  static const surface = Color(0xFFFFFFFF);
  /// Primary green accent
  static const primary = Color(0xFF3ECF6C);
  /// Pressed / hover green
  static const primaryDark = Color(0xFF22A350);
  /// Near-black navy headings
  static const textHeading = Color(0xFF0D1B2A);
  /// Dark slate body copy
  static const textBody = Color(0xFF3A4A5C);
  /// Muted gray secondary text
  static const textMuted = Color(0xFF8494A4);
  /// Divider / border — very light blue-gray
  static const borderColor = Color(0xFFE8EEF4);
  /// White alias (use this, never Colors.white)
  static const white = Color(0xFFFFFFFF);

  // ============= SEMANTIC COLORS (updated hues) =============
  static const success = Color(0xFF3ECF6C);      // Green - active/completed
  static const successBg = Color(0xFFEAFAF1);

  static const warning = Color(0xFFB7791F);      // Amber text
  static const warningBg = Color(0xFFFFF3CD);

  static const danger = Color(0xFFE53E3E);       // Red - alert/overdue
  static const dangerBg = Color(0xFFFFE4E4);

  static const info = Color(0xFF3B82F6);         // Blue - in progress
  static const infoBg = Color(0xFFEFF6FF);

  // ============= NEUTRAL GRAYS (kept for shared widgets) =============
  static const gray900 = Color(0xFF111827);
  static const gray700 = Color(0xFF374151);
  static const gray600 = Color(0xFF4B5563);
  static const gray500 = Color(0xFF6B7280);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray300 = Color(0xFFD1D5DB);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray100 = Color(0xFFF3F4F6);

  // ============= DARK MODE (Driver screens only) =============
  static const navy950 = Color(0xFF0A0F1E);
  static const navy900 = Color(0xFF0F172A);
  static const navy800 = Color(0xFF1B2A4A);
  static const navy700 = Color(0xFF1E3A5F);
  static const navy600 = Color(0xFF2A4A7F);

  static const darkBg = navy950;
  static const darkSurface = navy900;
  static const darkElevated = navy800;
  static const darkBorder = navy700;
  static const darkTextPrimary = Color(0xFFF8FAFC);
  static const darkTextSecondary = Color(0xFF94A3B8);

  // ============= DRIVER LIGHT+BLUE THEME ALIASES =============
  /// Driver screens use light background + blue accent instead of dark+green.
  static const driverAccent     = Color(0xFF2563EB);  // Blue-600
  static const driverAccentDark = Color(0xFF1D4ED8);  // Blue-700
  static const driverAccentBg   = Color(0xFFEFF6FF);  // Blue-50

  // ============= PROJECT ASSOCIATE LIGHT+OLIVE THEME ALIASES =============
  /// PA screens use light background + dark olive/green accent.
  static const paAccent     = Color(0xFF4D7C0F);  // Olive/Lime-700
  static const paAccentDark = Color(0xFF3F6212);  // Olive/Lime-800
  static const paAccentBg   = Color(0xFFF7FEE7);  // Lime-50 tint

  // ============= PUMP OPERATOR LIGHT+ORANGE THEME ALIASES =============
  /// Pump screens use light background + vibrant orange accent.
  static const pumpAccent     = Color(0xFFEA580C);  // Orange-600
  static const pumpAccentDark = Color(0xFFC2410C);  // Orange-700
  static const pumpAccentBg   = Color(0xFFFFF7ED);  // Orange-50 tint

  // ============= MANAGER LIGHT+ESPRESSO THEME ALIASES =============
  /// Manager screens use light background + rich espresso accent.
  static const managerAccent     = Color(0xFF4D2E1A);  // Espresso
  static const managerAccentDark = Color(0xFF3A2213);  // Darker espresso
  static const managerAccentBg   = Color(0xFFFDF8F5);  // Warm cream tint

  // ============= FLEET MANAGER LIGHT+WARATAH THEME ALIASES =============
  /// Fleet screens use light background + waratah red accent.
  static const fleetAccent     = Color(0xFFB21C2B);  // Waratah
  static const fleetAccentDark = Color(0xFF8C1520);  // Darker waratah
  static const fleetAccentBg   = Color(0xFFFDF2F2);  // Warm red tint

  // ============= ACCOUNTANT LIGHT+CRIMSON THEME ALIASES =============
  /// Accountant screens use light background + crimson red accent.
  static const acctAccent     = Color(0xFFDC143C);  // Crimson
  static const acctAccentDark = Color(0xFFA50E2D);  // Dark crimson
  static const acctAccentBg   = Color(0xFFFFF0F2);  // Soft pink tint

  // ============= LEGACY AMBER (driver accent only) =============
  /// Use `primary` in admin screens. Amber only in legacy/driver contexts.
  static const amber600 = Color(0xFFD97706);
  static const amber500 = Color(0xFFF59E0B);
  static const amber400 = Color(0xFFFBBF24);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber50 = Color(0xFFFFFBEB);

  // ============= ROLE-SPECIFIC ACCENT COLORS =============
  static const roleAdmin = Color(0xFF7C3AED);
  static const roleAdminBg = Color(0xFFEDE9FE);

  static const roleManager = Color(0xFF2563EB);
  static const roleManagerBg = Color(0xFFEFF6FF);

  static const roleFleetManager = Color(0xFF059669);
  static const roleFleetManagerBg = Color(0xFFECFDF5);

  static const roleAccountant = Color(0xFFD97706);
  static const roleAccountantBg = Color(0xFFFEF3C7);

  static const roleProjectAssociate = Color(0xFFDC4B2A);
  static const roleProjectAssociateBg = Color(0xFFFEF0EC);

  static const roleDriver = Color(0xFF0D9488);
  static const roleDriverBg = Color(0xFFF0FDFA);

  static const roleAuditor = Color(0xFF6366F1);      // Indigo
  static const roleAuditorBg = Color(0xFFEEF2FF);

  // ============= ALIASES (commonly used) =============
  static const textPrimary = darkTextPrimary;
  static const textSecondary = darkTextSecondary;
  static const error = danger;
  static const border = borderColor;
  static const card = surface;
  static const roleFleet = roleFleetManager;
  static const roleAssociate = roleProjectAssociate;

  // ============= LEGACY ALIASES (do not use in new code) =============
  static const accent = primary;
  static const primaryLight = successBg;
  static const cardSurface = darkElevated;       // dark card background
  static const cardSurfaceDark = darkElevated;   // dark card background alt
  static const backgroundSecondary = gray100;
  static const primaryLightBg = successBg;

  /// Get role accent color based on user role string
  static Color getRoleColor(String role) {
    return switch (role.toLowerCase()) {
      'admin' => roleAdmin,
      'manager' => roleManager,
      'fleet_manager' => roleFleetManager,
      'accountant' => acctAccent,
      'project_associate' => roleProjectAssociate,
      'driver' => roleDriver,
      'auditor' => roleAuditor,
      _ => gray500,
    };
  }

  /// Get role background color based on user role string
  static Color getRoleBackgroundColor(String role) {
    return switch (role.toLowerCase()) {
      'admin' => roleAdminBg,
      'manager' => roleManagerBg,
      'fleet_manager' => roleFleetManagerBg,
      'accountant' => roleAccountantBg,
      'project_associate' => roleProjectAssociateBg,
      'driver' => roleDriverBg,
      'auditor' => roleAuditorBg,
      _ => gray100,
    };
  }
}