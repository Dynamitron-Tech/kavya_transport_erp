# Kavya Transports Flutter App — UI/UX Design Implementation

This document explains the complete design system implementation for the Kavya Transports ERP mobile application.

## Quick Start

### 1. Using Design Colors

```dart
import 'package:kavya_app/core/theme/kt_colors.dart';

// Primary brand colors
Container(
  color: KTColors.navy950,  // Dark navy background
  child: Text(
    'Premium',
    style: TextStyle(color: KTColors.amber500),
  ),
)

// Semantic colors
Container(
  color: KTColors.successBg,
  child: Text(
    'Delivery Complete',
    style: TextStyle(color: KTColors.success),
  ),
)

// Role-specific colors
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

### 2. Using Typography

```dart
import 'package:kavya_app/core/theme/kt_text_styles.dart';

Text('Dashboard', style: KTTextStyles.h1)
Text('Active Trips', style: KTTextStyles.label)
Text('₹4,50,000', style: KTTextStyles.kpiNumber)
Text('Updated 2 hours ago', style: KTTextStyles.caption)
```

### 3. Using Buttons

```dart
import 'package:kavya_app/core/widgets/kt_button.dart';

// Primary action (amber)
KTButton.primary(
  onPressed: () {},
  label: 'Start Trip',
  isLoading: false,
)

// Secondary action (navy)
KTButton.secondary(
  onPressed: () {},
  label: 'Cancel',
)

// Dangerous action (red)
KTButton.danger(
  onPressed: () {},
  label: 'Delete',
)

// Explore action
KTButton.ghost(
  onPressed: () {},
  label: 'View Details',
)

// Icon button
KTButton.icon(
  onPressed: () {},
  icon: Icons.menu,
)

// Floating action button
KTButton.fab(
  onPressed: () {},
  icon: Icons.add,
)
```

### 4. Using Components

```dart
import 'package:kavya_app/core/widgets/kt_components.dart';

// Stat card (KPI display)
KTStatCard(
  label: 'Active Vehicles',
  value: '24',
  icon: Icons.directions_car,
  accentColor: KTColors.amber500,
  trend: '+3 vehicles',
  trendUp: true,
)

// Status badge
KTStatusBadge(
  label: 'In Progress',
  status: KTStatusType.inProgress,
)

// Alert message
KTAlertCard(
  message: 'Network connection lost. Retry?',
  type: KTAlertType.warning,
  onDismiss: () {},
)

// Empty state
KTEmptyState(
  icon: Icons.inbox_outlined,
  title: 'No Active Trips',
  message: 'Create a new trip to get started.',
  action: KTButton.primary(
    onPressed: () {},
    label: 'Create Trip',
  ),
)

// Loading placeholder
KTShimmerPlaceholder(
  width: MediaQuery.of(context).size.width - 32,
  height: 80,
  borderRadius: BorderRadius.circular(12),
)

// Role badge
KTRoleBadge(
  role: 'fleet_manager',
  compact: false,
)
```

## Theme Application

### Dark Mode (Default for Mobile)
The app uses dark navy as the default theme for mobile/driver app:

```dart
// main.dart
MaterialApp(
  darkTheme: AppTheme.darkTheme,
  themeMode: ThemeMode.dark,  // ← Always dark mode
  home: const HomePage(),
)
```

**Why dark mode?**
- Reduces eye strain for drivers during long use
- Amber accents pop better on dark backgrounds
- Professional, industrial aesthetic
- Battery saving on AMOLED screens

### Light Mode (for Web/Admin)
Light mode is available for web/tablet admin dashboards:

```dart
// For web context
MaterialApp(
  theme: AppTheme.lightTheme,
  themeMode: ThemeMode.light,
)
```

## Component Usage Patterns

### 1. Dashboard Layout
```dart
class DashboardPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Fleet Overview', style: KTTextStyles.h2),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          children: [
            KTStatCard(
              label: 'Active Vehicles',
              value: '24',
              icon: Icons.directions_car,
              trend: '+3',
            ),
            KTStatCard(
              label: 'Total Revenue',
              value: '₹45.2L',
              icon: Icons.trending_up,
              trend: '+12.5%',
            ),
          ],
        ),
      ),
    );
  }
}
```

### 2. Form with Proper Styling
```dart
class CreateTripForm extends StatefulWidget {
  @override
  State<CreateTripForm> createState() => _CreateTripFormState();
}

class _CreateTripFormState extends State<CreateTripForm> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Field label
        Text(
          'Destination',
          style: KTTextStyles.label.copyWith(
            color: KTColors.white,
          ),
        ),
        const SizedBox(height: 8),

        // Input field (uses AppTheme input decoration)
        TextField(
          decoration: InputDecoration(
            hintText: 'Enter destination city',
            prefixIcon: Icon(Icons.location_on_outlined),
          ),
        ),
        const SizedBox(height: 24),

        // Submit button
        KTButton.primary(
          onPressed: () {},
          label: 'Create Trip',
          isLoading: false,
        ),
      ],
    );
  }
}
```

### 3. List with Status Badges
```dart
ListView.builder(
  itemCount: trips.length,
  itemBuilder: (context, index) {
    final trip = trips[index];
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListTile(
        title: Text(trip.destination, style: KTTextStyles.label),
        subtitle: Text(trip.date, style: KTTextStyles.caption),
        trailing: KTStatusBadge(
          label: trip.status,
          status: _getStatusType(trip.status),
        ),
        onTap: () => _viewTrip(trip),
      ),
    );
  },
)
```

### 4. Error Handling UI
```dart
if (error != null)
  KTAlertCard(
    message: error,
    type: KTAlertType.error,
    onDismiss: () => _clearError(),
  )
else if (isEmpty)
  KTEmptyState(
    icon: Icons.search_off,
    title: 'No Results',
    message: 'Adjust your filters and try again.',
  )
else
  ListView(children: buildContent())
```

## Design Principles for Implementation

### 1. **Information Hierarchy**
- Use `h1`, `h2`, `h3` for heading levels
- Use `body` for main content
- Use `caption` for timestamps/secondary info
- Use `kpiNumber` for important metrics

### 2. **Color Meaning**
- **Amber**: Action items, highlights, buttons
- **Green**: Success, completion, active state
- **Red**: Danger, errors, critical alerts
- **Blue**: Information, pending, loading
- **Navy**: Default text, backgrounds, structure

### 3. **Spacing**
Use multiples of 8px:
- `const SizedBox(height: 8)` → small gap
- `const SizedBox(height: 16)` → medium gap
- `const SizedBox(height: 24)` → large gap
- `const SizedBox(height: 32)` → extra large gap

### 4. **Elevation & Shadows**
Cards come with built-in shadows from `AppTheme`. Don't add extra elevation unless necessary.

### 5. **Loading States**
```dart
// Show shimmer placeholders while loading
isLoading 
  ? KTShimmerPlaceholder(height: 100)
  : ListView(children: content)
```

## Splash & Login Screen Integration

### Splash Screen Flow
```dart
// Show splash screen on first app launch
class AppStartup extends StatefulWidget {
  @override
  State<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<AppStartup> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Initialize services
    await Future.delayed(const Duration(seconds: 1));
    
    // Navigate to login
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return SplashScreen(
      onComplete: () {
        Navigator.of(context).pushReplacementNamed('/login');
      },
    );
  }
}
```

### Login Screen Integration
```dart
// In your router/navigation
GoRoute(
  path: '/login',
  builder: (context, state) => const LoginScreen(),
  routes: [
    GoRoute(
      path: 'home',
      builder: (context, state) => const HomePage(),
    ),
  ],
),
```

## Customization Guide

### Creating a Custom Button Style
```dart
// If you need a button not in KTButton library
ElevatedButton(
  onPressed: () {},
  style: ElevatedButton.styleFrom(
    backgroundColor: KTColors.navy700,
    foregroundColor: KTColors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(10),
    ),
    elevation: 0,
  ),
  child: Text('Custom', style: KTTextStyles.buttonMedium),
)
```

### Creating a Custom Card
```dart
Container(
  padding: const EdgeInsets.all(16),
  decoration: BoxDecoration(
    color: KTColors.navy800,
    borderRadius: BorderRadius.circular(12),
    border: Border.all(
      color: KTColors.navy700,
      width: 1,
    ),
  ),
  child: Column(
    children: [
      Text('Title', style: KTTextStyles.h3),
      const SizedBox(height: 12),
      Text('Content', style: KTTextStyles.body),
    ],
  ),
)
```

## File Structure

```
kavya_app/lib/
├── core/
│   ├── theme/
│   │   ├── kt_colors.dart          ← Color tokens
│   │   ├── kt_text_styles.dart     ← Typography
│   │   └── app_theme.dart          ← Theme definitions
│   └── widgets/
│       ├── kt_button.dart          ← Button library
│       └── kt_components.dart      ← Card/Badge/etc library
├── screens/
│   ├── splash_screen.dart          ← Truck animation
│   ├── login_screen.dart           ← Login UI
│   └── [other screens]
├── main.dart                        ← App entry point
└── [other directories]
```

## Performance Tips

1. **Use const constructors** wherever possible
   ```dart
   const SizedBox(height: 16)  // ✅ Better
   SizedBox(height: 16)        // ❌ Rebuilds
   ```

2. **Use design token variables** instead of Color objects
   ```dart
   Color.something  // ❌ No
   KTColors.amber500  // ✅ Yes
   ```

3. **Cache complex builds**
   ```dart
   final sharedButton = KTButton.primary(
     onPressed: () {},
     label: 'Save',
   );
   // Reuse in multiple widgets
   ```

## Testing Your Design System

```dart
// In your test file
testWidgets('Button displays correctly', (WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: Scaffold(
        body: KTButton.primary(
          onPressed: () {},
          label: 'Test',
        ),
      ),
    ),
  );

  expect(find.text('Test'), findsOneWidget);
  expect(find.byType(ElevatedButton), findsOneWidget);
});
```

## Troubleshooting

### Dark theme not applying?
```dart
// Ensure main.dart has:
MaterialApp(
  darkTheme: AppTheme.darkTheme,
  themeMode: ThemeMode.dark,  // ← Must be set to 'dark'
)
```

### Colors looking wrong?
- Check `KTColors` import: `import 'core/theme/kt_colors.dart';`
- Verify color hex codes in `kt_colors.dart`
- Use `KTColors.navy950` not `Color(0xFF0A0F1E)`

### Text styles not applying?
```dart
// Always use design tokens
Text('Hello', style: KTTextStyles.h1)  // ✅
Text('Hello', style: TextStyle(fontSize: 22))  // ❌
```

### Buttons too wide/narrow?
Buttons use `width: double.infinity` by default. For fixed width:
```dart
SizedBox(
  width: 200,
  child: KTButton.primary(
    onPressed: () {},
    label: 'Submit',
  ),
)
```

---

## Summary

✅ **Implemented:**
- Complete color system (Navy + Amber)
- Typography scale (Poppins + Inter + JetBrains Mono)
- Splash screen with truck 3D animation
- Login screen with full UI
- Button component library (8 variants)
- Card/Badge/Alert component library (10+ components)
- Role-specific accent colors (7 roles)
- Dark theme as default
- Light theme for web

✅ **Ready to Use:**
- All design tokens available in `kt_colors.dart`
- All text styles available in `kt_text_styles.dart`
- All button variants in `KTButton` class
- All card/component variants in `kt_components.dart`

**Next Steps:**
1. Integrate splash/login screens into app router
2. Build screens using components & design tokens
3. Test on actual devices (physical dark appearance)
4. Adjust shadows/elevations based on real world testing
5. Monitor performance with Flutter DevTools

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Maintained by**: Kavya Transports Engineering Team
