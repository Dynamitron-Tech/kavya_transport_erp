# Kavya Transports Design System
## Mobile (Flutter) Implementation Guide

---

## 1. COLOR SYSTEM

### Navy Palette (Brand Core)
```dart
KTColors.navy950  = Color(0xFF0A0F1E)   // Darkest, backgrounds
KTColors.navy900  = Color(0xFF0F172A)   // App shell, surfaces
KTColors.navy800  = Color(0xFF1B2A4A)   // Primary, headings
KTColors.navy700  = Color(0xFF1E3A5F)   // Hover states
KTColors.navy600  = Color(0xFF2A4A7F)   // Active items
KTColors.navy100  = Color(0xFFE8EDF5)   // Light surfaces
KTColors.navy50   = Color(0xFFF0F4FA)   // Page backgrounds
```

### Amber Palette (Accent & Action)
```dart
KTColors.amber600 = Color(0xFFD97706)   // CTA buttons
KTColors.amber500 = Color(0xFFF59E0B)   // Primary highlights
KTColors.amber400 = Color(0xFFFBBF24)   // Hover states
KTColors.amber100 = Color(0xFFFEF3C7)   // Badge backgrounds
KTColors.amber50  = Color(0xFFFFFBEB)   // Tinted surfaces
```

### Semantic Colors
```dart
// Success (green)
KTColors.success    = Color(0xFF10B981)
KTColors.successBg  = Color(0xFFECFDF5)

// Warning (amber)
KTColors.warning    = Color(0xFFF59E0B)
KTColors.warningBg  = Color(0xFFFFFBEB)

// Danger (red)
KTColors.danger     = Color(0xFFEF4444)
KTColors.dangerBg   = Color(0xFFFEF2F2)

// Info (blue)
KTColors.info       = Color(0xFF3B82F6)
KTColors.infoBg     = Color(0xFFEFF6FF)
```

### Dark Mode Defaults
- Background: `navy950` (#0A0F1E)
- Surface/Card: `navy900` (#0F172A)
- Elevated: `navy800` (#1B2A4A)
- Text Primary: Color(0xFFF8FAFC)
- Text Secondary: Color(0xFF94A3B8)
- Border: `navy700` (#1E3A5F)

---

## 2. TYPOGRAPHY

### Font Families
- **Headings**: Poppins (weight 600-700)
- **Body**: Inter (weight 400-500)
- **Numbers/Data**: JetBrains Mono (weight 500-600)

### Text Styles (via `KTTextStyles`)
```dart
// Large displays
KTTextStyles.displayLarge      // 36px, Poppins 700
KTTextStyles.displayMedium     // 28px, Poppins 700

// Headings
KTTextStyles.h1                // 22px, Poppins 600
KTTextStyles.h2                // 18px, Poppins 600
KTTextStyles.h3                // 16px, Poppins 600

// Body text
KTTextStyles.bodyLarge         // 16px, Inter 400
KTTextStyles.body              // 15px, Inter 400
KTTextStyles.bodySmall         // 13px, Inter 400

// Labels & forms
KTTextStyles.label             // 13px, Inter 500
KTTextStyles.labelSmall        // 12px, Inter 500

// Specialized
KTTextStyles.caption           // 11px, Inter 400 (timestamps)
KTTextStyles.kpiNumber         // 28px, JetBrains Mono 600
KTTextStyles.mono              // 13px, JetBrains Mono 500
KTTextStyles.tableHeader       // 12px, Inter 600
KTTextStyles.buttonLarge       // 16px, Inter 600
```

---

## 3. COMPONENTS

### Buttons (via `KTButton`)

**Primary (Amber, call-to-action)**
```dart
KTButton.primary(
  onPressed: () {},
  label: 'Sign In',
  isLoading: false,
)
```

**Secondary (Navy, alternative action)**
```dart
KTButton.secondary(
  onPressed: () {},
  label: 'Cancel',
)
```

**Danger (Red, destructive action)**
```dart
KTButton.danger(
  onPressed: () {},
  label: 'Delete',
)
```

**Ghost (Transparent, tertiary)**
```dart
KTButton.ghost(
  onPressed: () {},
  label: 'Learn More',
  textColor: KTColors.navy700,
)
```

**Outline (Bordered, secondary)**
```dart
KTButton.outline(
  onPressed: () {},
  label: 'Save',
  borderColor: KTColors.navy700,
)
```

**Icon (Compact circular)**
```dart
KTButton.icon(
  onPressed: () {},
  icon: Icons.add,
  backgroundColor: KTColors.amber500,
  iconColor: KTColors.navy900,
)
```

### Cards & Data Display

**Stat Card (KPI metrics)**
```dart
KTStatCard(
  label: 'Total Revenue',
  value: '₹24,50,000',
  icon: Icons.trending_up,
  accentColor: KTColors.amber500,
  trend: '+12.5%',
  trendUp: true,
  onTap: () {},
)
```

**Status Badge (inline status)**
```dart
KTStatusBadge(
  label: 'In Progress',
  status: KTStatusType.inProgress,
)
```

Status types: `draft`, `pendingApproval`, `approved`, `inProgress`, `completed`, `cancelled`, `pending`, `failed`

**Alert/Error Card**
```dart
KTAlertCard(
  message: 'Connection lost. Retry in 5s.',
  type: KTAlertType.warning,
  onDismiss: () {},
)
```

**Role Badge**
```dart
KTRoleBadge(
  role: 'fleet_manager',  // Uses role-specific colors
  compact: false,
)
```

**Empty State**
```dart
KTEmptyState(
  icon: Icons.inbox_outlined,
  title: 'No Trips Found',
  message: 'Create your first trip or sync from server.',
  action: KTButton.primary(
    onPressed: () {},
    label: 'Create Trip',
  ),
)
```

**Shimmer Loading**
```dart
KTShimmerPlaceholder(
  width: double.infinity,
  height: 60,
  borderRadius: BorderRadius.circular(8),
)
```

---

## 4. ROLE-SPECIFIC ACCENT COLORS

Each user role has a unique badge color (used in sidebars, role badges, dashboard headers):

```dart
KTColors.getRoleColor(role)           // Returns color
KTColors.getRoleBackgroundColor(role) // Returns bg color

// Role colors:
'admin'              → Purple   (#7C3AED) / bg (#EDE9FE)
'manager'            → Blue     (#2563EB) / bg (#EFF6FF)
'fleet_manager'      → Green    (#059669) / bg (#ECFDF5)
'accountant'         → Amber    (#D97706) / bg (#FEF3C7)
'project_associate'  → Coral    (#DC4B2A) / bg (#FEF0EC)
'driver'             → Teal     (#0D9488) / bg (#F0FDFA)
'auditor'            → Indigo   (#6366F1) / bg (#EEF2FF)
```

---

## 5. SPLASH SCREEN

### Animation Sequence (2.8 seconds total)

1. **Truck Enters (0-800ms)**
   - Truck enters from left, moves right across screen
   - Sits on amber "road" line in middle of screen
   - Easing: `Curves.easeInOut`

2. **Truck Turns (800-1400ms)**
   - Truck rotates 3D perspective (rotateY: 0° → 25°)
   - Scales up as it "drives toward camera"
   - Headlights glow (amber)

3. **Truck Fills Screen (1400-2000ms)**
   - Truck grille fills entire viewport
   - Scale multiplier increases rapidly
   - Brief amber light flash

4. **Reveal (2000-2800ms)**
   - Truck slides up and exits screen
   - Login screen and company name fade in
   - Login card slides up from bottom

**Skip Behavior**
- Tap anywhere to skip immediately
- Auto-skip after 3 seconds if no interaction
- Only shows on first app launch (check `localStorage` / `FlutterSecureStorage`)

---

## 6. LOGIN SCREEN

### Layout
- Full navy-900 background with subtle diagonal hatching pattern
- Faint truck watermark (20% opacity, bottom-right)
- 3px amber gradient line at bottom
- Centered card: 420px max width, 48px padding
- Material 3 card elevation: 24x shadow

### Card Contents
1. Logo icon (centered, amber background circle)
2. "Kavya Transports" title (Syne/Poppins, large)
3. "Employee Portal" subtitle (gray text)
4. Divider line (navy-700)
5. Employee ID input (monospace font, person icon)
6. Password input (password-hidden, eye toggle)
7. Error alert (if any)
8. Sign In button (amber, full width)
9. Footer copyright text

---

## 7. APP SHELL (for web/tablets)

### Sidebar
- Width: 260px (expanded) / 64px (collapsed)
- Background: navy-950
- Nav items: 44px height, 16px padding, 8px border-radius
- Active state: 3px left border (amber-500)
- Role badge at bottom showing current role with color

### Top Bar
- Height: 64px
- Background: white (light) / navy-900 (dark)
- Left: page title (Syne 20px)
- Right: notification bell, user avatar

### Content Area
- Background: navy-50
- Padding: 24px
- Max-width: 1400px, centered
- Cards: white background, 1px navy-200 border, 12px border-radius

---

## 8. DO NOT DO THESE

❌ No purple gradients (Kavya is logistics, not startup)
❌ No rounded blob shapes or organic backgrounds
❌ No animated particles or stars on main UI
❌ No white text on amber (always navy-900)
❌ No light mode on Flutter driver app (always dark navy)
❌ No "cute" illustrations (use simple icon + message)
❌ No Inter for headings (use Poppins/Syne)
❌ No more than 3 font weights per screen
❌ No inline styles (use design tokens everywhere)
❌ No inconsistent spacing (use 8px multiples)
❌ Do NOT make more role colors (use the 7 defined)

---

## 9. CODE EXAMPLES

### Basic App Layout
```dart
import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/kt_colors.dart';

void main() {
  runApp(
    MaterialApp(
      title: 'Kavya Transports',
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,  // Default to dark
      home: const HomePage(),
    ),
  );
}

class HomePage extends StatelessWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Dashboard', style: KTTextStyles.h2),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stat cards
          KTStatCard(
            label: 'Active Trips',
            value: '45',
            icon: Icons.local_shipping,
            accentColor: KTColors.amber500,
            trend: '+8%',
          ),
          const SizedBox(height: 16),

          // Status badge
          KTStatusBadge(
            label: 'In Progress',
            status: KTStatusType.inProgress,
          ),
          const SizedBox(height: 16),

          // Button
          KTButton.primary(
            onPressed: () {},
            label: 'Create Trip',
          ),
        ],
      ),
      floatingActionButton: KTButton.fab(
        onPressed: () {},
        icon: Icons.add,
      ),
    );
  }
}
```

### Custom Color Application
```dart
// Text with brand color
Text(
  'Important Notice',
  style: KTTextStyles.h3.copyWith(
    color: KTColors.amber500,
  ),
)

// Container with semantic color
Container(
  decoration: BoxDecoration(
    color: KTColors.dangerBg,
    borderRadius: BorderRadius.circular(8),
  ),
  child: Text(
    'Error occurred',
    style: TextStyle(color: KTColors.danger),
  ),
)

// Role-specific styling
Container(
  color: KTColors.getRoleBackgroundColor('fleet_manager'),
  child: Text(
    'Fleet Manager',
    style: TextStyle(
      color: KTColors.getRoleColor('fleet_manager'),
    ),
  ),
)
```

---

## 10. DESIGN SYSTEM FILES

### Location in Project
```
lib/
  core/
    theme/
      kt_colors.dart         ← Color tokens & role functions
      kt_text_styles.dart    ← Typography system
      app_theme.dart         ← Theme definitions (light/dark)
    widgets/
      kt_button.dart         ← Button component library
      kt_components.dart     ← Cards, badges, stats, etc.
  screens/
    splash_screen.dart       ← Truck animation, onboarding
    login_screen.dart        ← Login UI with auth state
```

### Updates Made
1. ✅ Navy (0xFF0A0F1E) + Amber (0xFFF59E0B) color system
2. ✅ Poppins (headings) + Inter (body) + JetBrains Mono (data)
3. ✅ Splash screen with truck 3D animation (2.8s)
4. ✅ Login screen with card layout, error handling
5. ✅ Button library (primary, secondary, danger, ghost, outline, icon, FAB)
6. ✅ Component library (stat cards, badges, alerts, alerts, empty state, shimmer)
7. ✅ Role-specific accent colors (7 user roles)
8. ✅ Dark theme as default (navy-focused for drivers)
9. ✅ Typography scale (xs through 3xl)
10. ✅ Semantic & status colors (success, warning, danger, info)

---

## Notes

- **Dark mode is the default** for the mobile/driver app (navy-950 backgrounds)
- **Light mode is available** for web/tablet use via `AppTheme.lightTheme`
- **All text uses design tokens** from `KTTextStyles` (no hardcoded font sizes)
- **All colors use design tokens** from `KTColors` (no hardcoded `Color()` calls)
- **Spacing uses 8px multiples** for visual rhythm consistency
- **Elevation and shadows are minimal** (0-24x) for the industrial aesthetic

---

**Design System Version**: 1.0  
**Last Updated**: March 2026  
**Brand**: Kavya Transports – Tamil Nadu Logistics  
