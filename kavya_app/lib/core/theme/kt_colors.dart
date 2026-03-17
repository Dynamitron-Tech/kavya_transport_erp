import 'package:flutter/material.dart';

/// Kavya Transports Design System Colors
/// Based on brand identity: Navy (authority) + Amber (action)
class KTColors {
  // ============= NAVY PALETTE (Brand Core) =============
  static const navy950 = Color(0xFF0A0F1E);  // Darkest, sidebar background
  static const navy900 = Color(0xFF0F172A);  // App shell, topbar
  static const navy800 = Color(0xFF1B2A4A);  // Primary brand color, headings
  static const navy700 = Color(0xFF1E3A5F);  // Hover states
  static const navy600 = Color(0xFF2A4A7F);  // Active nav items
  static const navy100 = Color(0xFFE8EDF5);  // Light backgrounds, stripes
  static const navy50 = Color(0xFFF0F4FA);   // Page background

  // ============= AMBER PALETTE (Accent & Action) =============
  static const amber600 = Color(0xFFD97706);  // Primary CTA buttons
  static const amber500 = Color(0xFFF59E0B);  // Highlights, badges
  static const amber400 = Color(0xFFFBBF24);  // Hover state
  static const amber100 = Color(0xFFFEF3C7);  // Badge backgrounds
  static const amber50 = Color(0xFFFFFBEB);   // Amber tinted surfaces

  // ============= SEMANTIC COLORS =============
  static const success = Color(0xFF10B981);      // Green - completed, active
  static const successBg = Color(0xFFECFDF5);
  
  static const warning = Color(0xFFF59E0B);      // Amber - pending, expiring
  static const warningBg = Color(0xFFFFFBEB);
  
  static const danger = Color(0xFFEF4444);       // Red - overdue, cancelled
  static const dangerBg = Color(0xFFFEF2F2);
  
  static const info = Color(0xFF3B82F6);         // Blue - in progress
  static const infoBg = Color(0xFFEFF6FF);

  // ============= NEUTRAL GRAYS =============
  static const gray900 = Color(0xFF111827);
  static const gray700 = Color(0xFF374151);
  static const gray500 = Color(0xFF6B7280);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray300 = Color(0xFFD1D5DB);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray100 = Color(0xFFF3F4F6);
  
  static const white = Color(0xFFFFFFFF);

  // ============= DARK MODE (Flutter Driver App Default) =============
  // Background:     navy950 (#0A0F1E)
  // Surface/Card:   navy900 (#0F172A)
  // Elevated:       navy800 (#1B2A4A)
  // Text primary:   #F8FAFC
  // Text secondary: #94A3B8
  // Border:         navy700 (#1E3A5F)

  static const darkBg = navy950;
  static const darkSurface = navy900;
  static const darkElevated = navy800;
  static const darkTextPrimary = Color(0xFFF8FAFC);
  static const darkTextSecondary = Color(0xFF94A3B8);
  static const darkBorder = navy700;

  // ============= ROLE-SPECIFIC ACCENT COLORS =============
  static const roleAdmin = Color(0xFF7C3AED);        // Purple
  static const roleAdminBg = Color(0xFFEDE9FE);
  
  static const roleManager = Color(0xFF2563EB);      // Blue
  static const roleManagerBg = Color(0xFFEFF6FF);
  
  static const roleFleetManager = Color(0xFF059669); // Green
  static const roleFleetManagerBg = Color(0xFFECFDF5);
  
  static const roleAccountant = Color(0xFFD97706);   // Amber
  static const roleAccountantBg = Color(0xFFFEF3C7);
  
  static const roleProjectAssociate = Color(0xFFDC4B2A); // Coral
  static const roleProjectAssociateBg = Color(0xFFFEF0EC);
  
  static const roleDriver = Color(0xFF0D9488);       // Teal
  static const roleDriverBg = Color(0xFFF0FDFA);
  
  static const roleAuditor = Color(0xFF6366F1);      // Indigo
  static const roleAuditorBg = Color(0xFFEEF2FF);

  // ============= LEGACY (kept for compatibility) =============
  static const primary = amber500;        // Use amber500 as primary action color
  static const primaryDark = amber600;
  static const primaryLight = amber100;
  
  static const cardSurface = navy100;
  static const cardSurfaceDark = navy900;
  
  // ============= ADDITIONAL COLORS (commonly used) =============
  static const textPrimary = Color(0xFFF8FAFC);    // Primary text color
  static const textSecondary = Color(0xFF94A3B8);  // Secondary text color
  static const textMuted = Color(0xFF64748B);      // Muted text color
  static const error = Color(0xFFEF4444);          // Error color (same as danger)
  static const border = navy700;                   // Border color
  static const borderColor = navy700;              // Alternative border color
  static const surface = navy900;                  // Surface color
  static const roleFleet = roleFleetManager;       // Alias for fleet manager color
  static const roleAssociate = roleProjectAssociate; // Alias for project associate color

  /// Get role accent color based on user role string
  static Color getRoleColor(String role) {
    return switch (role.toLowerCase()) {
      'admin' => roleAdmin,
      'manager' => roleManager,
      'fleet_manager' => roleFleetManager,
      'accountant' => roleAccountant,
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