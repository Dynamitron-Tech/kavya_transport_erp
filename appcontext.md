# Kavya Transports ERP - App Context Documentation

## 1. Overview

**Kavya Transports ERP** is a multi-role transportation management application built with **Flutter** and **Dart**. It provides different interfaces for various roles within a transportation company: Drivers, Fleet Managers, Accountants, Project Associates, and Admin users.

The application follows **Clean Architecture principles** with proper separation of concerns:
- **Models**: Data structures representing domain entities
- **Services**: Business logic and API integration  
- **Providers**: State management using Flutter Riverpod (18 provider modules)
- **Screens**: UI layer (Role-based screens for Driver, Fleet Manager, Accountant, Project Associate)
- **Core**: Reusable theme, routing, widgets, exceptions, and animations

### Key Features
✅ Multi-role authentication with JWT token management  
✅ Role-based navigation (Driver, Fleet Manager, Accountant, Project Associate)  
✅ Cinematic splash screen with animation sequence  
✅ Offline-first architecture with sync capabilities  
✅ Real-time GPS tracking and location services  
✅ Firebase Cloud Messaging for push notifications  
✅ Interactive checklists and photo capture  
✅ Top-up & expense management with receipts  
✅ WebSocket support for live updates  
✅ Biometric authentication (fingerprint)

---

## 2.1. Complete App Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  main.dart                              │
│  ├─ WidgetsFlutterBinding.ensureInitialized()          │
│  ├─ ProviderScope (Riverpod container)                 │
│  └─ KavyaApp (ConsumerWidget)                          │
└──────────────┬────────────────────────────────────────┘
               │
               ▼
       ┌───────────────────┐
       │  SplashScreen     │
       │  (Cinematic       │
       │   Animation)      │
       │                   │
       │  4200ms          │
       │  Phases: 0-100%  │
       └────────┬────────┘
                │ onComplete
                ▼
       ┌───────────────────┐
       │  LoginScreen      │
       │  (Auth Form)      │
       │  Input: Email     │
       │  Input: Password  │
       └────────┬────────┘
                │ login()
                ▼
      ┌────────────────────────┐
      │  AuthService.login()   │
      │  POST /auth/login      │
      │  Response:             │
      │  ├─ access_token       │
      │  ├─ refresh_token      │
      │  └─ user{roles: [...]} │
      └────────┬───────────────┘
               │ Save tokens
               ▼
     ┌──────────────────────────┐
     │ FlutterSecureStorage     │
     │ ├─ access_token          │
     │ └─ primary_role          │
     └────────┬──────────────────┘
              │ Route check
              ▼
   ┌────────────────────────────────┐
   │ GoRouter (Role-Based Route)    │
   │                                │
   │ driver → /driver/today         │
   │ fleet_manager → /fleet/home    │
   │ accountant → /accountant/home  │
   │ project_associate → /assoc/h   │
   └────────┬─────────────────────┘
            │
            ▼
   ┌────────────────────────┐
   │ Role-Specific Dashboard│
   │ with Bottom Navigation │
   │ & Tab-based UI         │
   └────────────────────────┘
```

---

## 2.2. Data Flow Architecture

```
              APPLICATION LAYER
    ┌────────────────────────────────┐
    │    Screens (ConsumerWidget)     │
    │                                │
    │  ref.watch(provider)           │
    │  ref.read(provider.notifier)   │
    └────────────┬───────────────────┘
                 │
    ┌────────────▼───────────────────┐
    │     State Management Layer      │
    │     (Riverpod Providers)        │
    │                                │
    │  StateNotifierProvider         │
    │  FutureProvider.family         │
    │  Provider.autoDispose          │
    └────────────┬───────────────────┘
                 │
    ┌────────────▼───────────────────┐
    │     Service Layer               │
    │                                │
    │  ApiService (Dio)              │
    │  AuthService                   │
    │  LocationService               │
    │  NotificationService           │
    │  OfflineSyncService            │
    └────────────┬───────────────────┘
                 │
    ┌────────────▼───────────────────┐
    │     Platform/External           │
    │                                │
    │  HTTP (Dio)                    │
    │  Secure Storage                │
    │  GPS / Location                │
    │  Firebase Messaging            │
    │  WebSocket                     │
    └────────────────────────────────┘
```

---

## 2.3. Provider Architecture (18 Modules)

```
AUTHENTICATION PROVIDERS:
├─ auth_provider.dart
│  └─ AuthStateNotifier
│     ├─ login(email, password)
│     ├─ logout()
│     ├─ refreshToken()
│     └─ getCurrentUser()
│
└─ authStateProvider (StateNotifierProvider)
   └─ AsyncValue<User?>

DOMAIN PROVIDERS (Data Management):
├─ trip_provider.dart
│  └─ TripsNotifier
│     ├─ fetchTrips()
│     ├─ getTripById(id)
│     ├─ updateTripStatus(id, status)
│     └─ closeTripWithReceipts(id)
│     
├─ expense_provider.dart
│  └─ ExpensesNotifier
│     ├─ fetchExpenses()
│     ├─ addExpense(expense)
│     └─ approveExpense(expenseId)
│
├─ attendance_provider.dart
│  └─ AttendanceNotifier
│     ├─ checkIn(location)
│     ├─ checkOut()
│     └─ getTodayAttendance()
│
├─ checklist_provider.dart
│  └─ Manages pre/post-trip checklists
│
├─ jobs_provider.dart
│  └─ Job management (Project Associate)
│
├─ vehicles_provider.dart
│  └─ Fleet vehicle inventory
│
└─ finance_provider.dart
   └─ Financial metrics & analytics

DASHBOARD PROVIDERS (Role-Specific):
├─ associate_dashboard_provider.dart (Project Associate KPIs)
├─ accountant_dashboard_provider.dart (Accountant KPIs)
└─ fleet_dashboard_provider.dart (Fleet Manager KPIs)

UTILITY PROVIDERS:
├─ connectivity_provider.dart
│  └─ Watch online/offline status
│
├─ offline_sync_status_provider.dart
│  └─ Pending requests counter
│
├─ notifications_provider.dart
│  └─ Unread notifications list
│
├─ notification_provider.dart (singular)
│  └─ Single notification detail
│
├─ search_provider.dart
│  └─ Global search across trips/expenses
│
├─ cache_manager_provider.dart
│  └─ Image & document caching
│
└─ recent_activity_provider.dart
   └─ Recent actions timeline
```

---

## 2.4. Provider Types & Patterns

### AsyncValue Pattern (Handles async states)
```dart
// In UI, access with .when()
final tripsAsync = ref.watch(tripsProvider);

tripsAsync.when(
  data: (trips) => ListView(children: trips.map((t) => TripCard(t))),
  loading: () => LoadingShimmer(),          // Skeleton loader
  error: (error, st) => ErrorWidget(error), // Error display
);
```

### State Notification
```dart
// StateNotifier allows mutations
ref.read(tripsProvider.notifier).updateTripStatus(tripId, 'completed');
// Automatically triggers rebuild via provider
```

---

### Tech Stack
- **Framework**: Flutter 3.x with Dart
- **State Management**: Flutter Riverpod (Provider pattern)
- **Navigation**: GoRouter (declarative routing with deep linking support)
- **HTTP Client**: Dio (with automatic token refresh)
- **Storage**: FlutterSecureStorage (for tokens), Hive (for offline data)
- **UI Framework**: Material 3 with custom theme
- **Location Services**: geolocator package
- **Image Handling**: image_picker, camera
- **Connectivity**: connectivity_plus

### Core Architecture Pattern
```
┌──────────────────────────────────────────────────┐
│         SPLASH SCREEN (Cinematic)                │
│  [Side]→[Turn]→[Front]→[Approach]→[UI Reveal]   │
│  Animation Duration: 4200ms (4 phases)           │
└────────────┬─────────────────────────────────────┘
             │ onComplete
             ▼
┌──────────────────────────────────────────────────┐
│         LOGIN SCREEN                             │
│  (Email/Password Entry)                          │
└────────────┬─────────────────────────────────────┘
             │ onSuccess
             ▼
┌──────────────────────────────────────────────────┐
│         UI Layer (Screens)                       │
│  (driver_today_screen, trip_list, etc)           │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│    State Management (Riverpod - 18 Providers)    │
│  (Providers watch streams of data)               │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│      Services (Business Logic)                   │
│  (ApiService, AuthService, LocationService)     │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│      Models & Data Classes                       │
│  (Trip, Expense, Attendance, Checklist, etc)     │
└──────────────────────────────────────────────────┘
```

---

## 2.5. Splash Screen Animation (NEW)

### Cinematic Truck Animation Sequence
The splash screen provides a **cinematic brand experience** with a multi-phase truck animation:

```
PHASE 1 (0-28%): Truck Enters from Left
├── Side-view truck drives in from -320px to 0px
├── Engine vibration effect (parallax sine wave)
└── Background road lines animate with parallax

PHASE 2 (28-46%): Right Turn (Side → Front View)
├── Side-view opacity fades out
├── Front-view opacity fades in
├── Smooth rotation transition
└── Vibration continues

PHASE 3 (46-74%): Approach Camera (Front View)
├── Truck scales from 1.0 to 10.0 (approaching)
├── Y position shifts down 90px (bearing down effect)
├── Head-on approach creates cinematic impact
└── Background darkens from navy-blue to pure black

PHASE 4 (68-82%): Headlight Flare Bloom
├── Headlight flare (radial gradient) spikes up
├── Creates volumetric light effect
├── Fades out by 95% mark
└── Truck fades out completely

PHASE 5 (78-100%): Login UI Reveal
├── UI card drifts up from 32px offset
├── Fade in from 0 to 1
├── "Kavya Transports" branding appears
├── "EMPLOYEE PORTAL" text
└── Ready for login interaction
```

### Callbacks & Flow
```dart
SplashScreen(
  onReadyForLogin: () => print('Login UI ready at 78%'),
  onComplete: () => navigate('/login'),
)
```

### Technical Details
- **File**: `lib/screens/splash_screen.dart` (~632 lines)
- **Duration**: 4200ms total
- **Custom Classes**:
  - `_DoorOpeningCurve`: Custom easing curve
  - `TruckSilhouette`: Reusable truck widget
  - `TruckPainter`: Custom painter (side & front views)
  - `BackgroundPainter`: Animated road and parallax lines
  - `Perspective`: 3D transformation helper

---

## 3. User Authentication & Role-Based Access

### Authentication Flow

```
1. User launches app
   ↓
2. Router checks for access_token in secure storage
   ↓
3a. NO TOKEN → Redirect to /login
3b. HAS TOKEN → Redirect based on primary_role
   ↓
4. Login screen:
   - User enters email & password
   - ApiService.login() calls /auth/login endpoint
   - Response contains: access_token, refresh_token, user object
   ↓
5. Tokens stored in FlutterSecureStorage:
   - access_token: Used for every API request
   - refresh_token: Used to get new access_token when expired
   ↓
6. User roles fetched and primary_role determined:
   - user.roles is an ARRAY (e.g., ['driver', 'fleet_manager'])
   - roles[0] = primary role that determines initial route
   ↓
7. Navigation:
   - 'driver' → /driver/today
   - 'fleet_manager' → /fleet/home
   - 'accountant' → /accountant/home
   - 'project_associate' → /associate/home
   - others (admin, auditor, etc) → /web-only
```

### Token Refresh Mechanism
When API returns 401 (Unauthorized):
1. ApiService interceptor catches the error
2. Reads refresh_token from storage
3. POSTs to `/auth/refresh` with refresh_token
4. Receives new access_token
5. Saves new access_token to storage
6. Retries original request with new token
7. If refresh fails → Clear all storage & redirect to login

---

## 4. Data Models

### Core Models

#### **User**
```dart
class User {
  String id;
  String name;
  String email;
  List<String> roles;  // e.g., ['driver', 'fleet_manager']
  
  String get primaryRole => roles.isNotEmpty ? roles.first : 'unknown';
}
```

#### **Trip**
```dart
class Trip {
  int id;
  String tripNumber;
  String status;  // pending, started, in_transit, loading, completed
  String origin;
  String destination;
  String vehicleNumber;
  int driverId;
  String startDate;
  String endDate;
  double distanceKm;
  double freightAmount;
  String clientName;
  String lrNumber;
  String remarks;
  
  bool get isActive => 
    status == 'in_transit' || 
    status == 'started' || 
    status == 'loading';
}
```

#### **Expense**
```dart
class Expense {
  int id;
  int tripId;
  String category;  // fuel, toll, food, maintenance, etc
  double amount;
  String description;
  String receiptUrl;
  String date;
  String status;  // pending, submitted, approved
}
```

#### **Attendance**
```dart
class Attendance {
  int id;
  int driverId;
  String date;
  String checkIn;    // e.g., "09:30"
  String checkOut;   // e.g., "17:45"
  String status;     // present, absent, on_trip, leave
  double checkInLat;
  double checkInLng;
}
```

#### **Checklist**
```dart
class Checklist {
  int tripId;
  String type;  // pre_trip or post_trip
  List<ChecklistItem> items;
  String completedAt;
  
  bool get isComplete => 
    items.isNotEmpty && items.every((i) => i.checked);
}

class ChecklistItem {
  String id;
  String label;
  bool checked;
  String note;  // Driver's optional comment
}
```

#### **Notification**
```dart
class NotificationModel {
  String id;
  String title;
  String body;
  String type;  // expense_submitted, ewb_expiring, trip_completed, etc
  String createdAt;
  bool read;
}
```

---

## 5. Navigation Structure (GoRouter)

### Route Hierarchy

```
/
├── /login (LoginScreen)
├── /web-only (WebOnlyScreen - for non-mobile roles)
│
└── DRIVER ROUTES (with Bottom Navigation Shell)
    ├── StatefulShellRoute builder: DriverHomeScreen
    │   └── navigationShell with 4 tabs:
    │       ├── /driver/today → DriverTodayScreen
    │       ├── /driver/trips → DriverTripListScreen
    │       ├── /driver/expenses → DriverExpenseListScreen
    │       └── /driver/profile → DriverProfileScreen
    │
    └── Modal Routes (outside shell, full screen):
        ├── /driver/add-expense → DriverAddExpenseScreen
        ├── /driver/trip/:id → DriverTripDetailScreen
        ├── /driver/checklist → DriverChecklistScreen
        ├── /driver/documents → DriverDocumentsScreen
        └── /driver/notifications → DriverNotificationsScreen

├── FLEET MANAGER ROUTES
│   └── /fleet/home, /fleet/map, /fleet/vehicles, etc.
│
├── ACCOUNTANT ROUTES
│   └── /accountant/home, /accountant/receivables, etc.
│
└── PROJECT ASSOCIATE ROUTES
    └── /associate/home, /associate/jobs, etc.
```

### Route Guard
Before navigation, router checks:
1. Is user authenticated? (Has access_token in storage)
2. Is user trying to access login? (Bypass if already logged in)
3. Should redirect based on role? (Send to appropriate home)

---

## 6. State Management (Riverpod Providers)

### Provider Types Used

#### **FutureProvider** (one-time async fetch)
```dart
final tripDetailProvider = FutureProvider.family<Trip, int>((ref, tripId) async {
  final api = ref.read(apiServiceProvider);
  return api.get('/trips/$tripId', fromJson: Trip.fromJson);
});
```
- Used when you need to fetch data for a specific trip ID
- Returns AsyncValue<Trip> which can be in loading/error/data state
- `.family` modifier allows passing parameters

#### **StateNotifierProvider** (mutable state)
```dart
final tripsProvider = StateNotifierProvider<TripsNotifier, AsyncValue<List<Trip>>>((ref) {
  return TripsNotifier(ref.read(apiServiceProvider));
});

class TripsNotifier extends StateNotifier<AsyncValue<List<Trip>>> {
  Future<void> fetchTrips() async { /* API call */ }
  Future<void> updateTripStatus(int tripId, String status) async { /* API call */ }
}
```
- Provides mutable state that can be modified through notifier
- Used for lists that can be modified
- fetchTrips() on startup, updateTripStatus() for mutations

#### **Provider** (computed/derived values)
```dart
final activeTripProvider = Provider<Trip?>((ref) {
  final trips = ref.watch(tripsProvider);
  return trips.valueOrNull?.where((t) => t.isActive).firstOrNull;
});
```
- Derives new value from other providers
- Pure functions, no side effects
- Automatically updates when dependencies change

#### **FutureProvider.autoDispose** (auto-cleanup)
```dart
final notificationsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  return api.getUnreadNotifications();
});
```
- Automatically disposes when no longer watched
- Good for memory management

### Provider Composition Example
```dart
// Watch multiple providers
final user = ref.watch(authStateProvider).valueOrNull;
final trips = ref.watch(tripsProvider);
final activeTrip = ref.watch(activeTripProvider);

// Update providers
ref.read(tripsProvider.notifier).updateTripStatus(tripId, 'completed');
```

---

## 7. API Integration & Network Flow

### ApiService (Dio-based HTTP client)

```dart
class ApiService {
  static const baseUrl = 'http://10.0.2.2:8000/api/v1';
  
  // Interceptor chain:
  // 1. OnRequest: Add Authorization header with access_token
  // 2. OnError: On 401, refresh token and retry request
}
```

### Request Flow
```
UI triggers action
  ↓
Provider/StateNotifier calls ApiService method
  ↓
ApiService.get/post/patch() adds auth header
  ↓
Dio sends request to backend
  ↓
Response:
  - 200 OK → Return parsed response
  - 401 Unauthorized → Refresh token, retry
  - Error → Throw exception captured by AsyncValue.error
  ↓
Provider updates state (loading → data/error)
  ↓
UI rebuilds with new data
`

### Example: Fetching Trips
```
DriverTripListScreen builds
  ↓
Calls ref.watch(tripsProvider)
  ↓
TripsNotifier.fetchTrips() executes on init
  ↓
ApiService.get('/trips/')
  ↓
Response: { items: [Trip{}, Trip{}, ...] }
  ↓
Parsed to List<Trip>
  ↓
Provider state = AsyncValue.data(tripsList)
  ↓
Screen rebuilds with trip list
```

### Token Refresh Example
```
Request to GET /trips/ with expired token
  ↓
Backend returns 401
  ↓
Dio interceptor catches 401
  ↓
Read refresh_token from FlutterSecureStorage
  ↓
POST /auth/refresh { refresh_token }
  ↓
Receive new access_token
  ↓
Save to storage
  ↓
Retry original GET /trips/ with new token
  ↓
Success → Return data
  ↓
If refresh fails → Clear storage, redirect to /login
```

---

## 8. Driver App Flow (Complete User Journey)

### 1. **App Launch → Authentication**
```
main.dart:
- Initialize OfflineSyncService
- Create ProviderScope with Riverpod
- Run KavyaApp (ConsumerWidget)
  ↓
KavyaApp:
- Watch routerProvider
- MaterialApp.router with Theme
- Show offline banner if no internet
  ↓
GoRouter initialization:
- Check secure storage for access_token
- If no token → /login
- If token exists → Check role & navigate
```

### 2. **Login Flow**
```
LoginScreen → User enters credentials
  ↓
Form validation (KtTextField with validators)
  ↓
onSubmit → ref.read(authStateProvider.notifier).login(email, password)
  ↓
AuthService.login():
  - Call API: POST /auth/login { email, password }
  - Extract: access_token, refresh_token, user
  - Save to FlutterSecureStorage
  - Navigate based on role
  ↓
For DRIVER role:
  - Save: access_token, refresh_token, primary_role='driver'
  - Navigate to /driver/today
```

### 3. **Driver Home (Bottom Navigation Hub)**
```
DriverHomeScreen has StatefulShellRoute with 4 tabs:

TAB 0: /driver/today → DriverTodayScreen
  - Shows attendance status (check-in/out times)
  - Shows active trip card
  - Lists today's trips
  - Quick action buttons (Add Expense, Checklist, Documents, Notifications)

TAB 1: /driver/trips → DriverTripListScreen
  - List of all trips with filtering & search
  - Filter by status (pending, in_transit, completed)
  - Tap to see details
  - Navigate to /driver/trip/:id

TAB 2: /driver/expenses → DriverExpenseListScreen
  - List of expenses with filtering
  - Filter by category (fuel, toll, food, etc)
  - Filter by status (pending, submitted, approved)
  - FAB to add expense → /driver/add-expense

TAB 3: /driver/profile → DriverProfileScreen
  - Display user info (name, email, phone, role)
  - Links to help, about
  - Logout button

Modal Routes (full screen, outside shell):
- /driver/add-expense → Add expense form with photo capture
- /driver/trip/:id → Trip details with status update option
- /driver/checklist → Interactive pre/post-trip checklist
- /driver/documents → View/upload vehicle and trip documents
- /driver/notifications → List of notifications
```

### 4. **Data Flow - Viewing Trips**
```
User navigates to /driver/trips
  ↓
DriverTripListScreen mounts
  ↓
ConsumerStatefulWidget watches: ref.watch(tripsProvider)
  ↓
tripsProvider (StateNotifierProvider) initializes
  ↓
TripsNotifier constructor calls fetchTrips()
  ↓
ApiService.get('/trips/'):
  - Add Authorization: Bearer {access_token}
  - POST request to backend
  ↓
Response: { items: [Trip{}, Trip{}, ...] }
  ↓
Parse JSON to List<Trip>
  ↓
Provider state = AsyncValue.data(trips)
  ↓
Screen's AsyncValue.when():
  - data: (trips) → Build ListView of trip cards
  - loading: → Show shimmer loaders
  - error: (e, st) → Show error widget
  ↓
User taps a trip card
  ↓
context.push('/driver/trip/${trip.id}')
  ↓
DriverTripDetailScreen receives tripId parameter
  ↓
Watches: ref.watch(tripDetailProvider(tripId))
  ↓
Single trip fetched and displayed
```

### 5. **Form Submission - Add Expense**
```
User: /driver/today → Quick action "Add Expense"
  ↓
context.push('/driver/add-expense')
  ↓
DriverAddExpenseScreen (ConsumerStatefulWidget)
  ↓
User fills form:
  - Category dropdown (fuel, toll, etc)
  - Amount text field
  - Description
  - Optional: Take photo of receipt
  ↓
onSubmit:
  - Validate form
  - Create Expense object
  - Set loading = true (shows loading state on button)
  ↓
ref.read(expensesProvider(null).notifier).addExpense(expense)
  ↓
ExpensesNotifier calls:
  - ApiService.post('/expenses/', data: expense.toJson())
  ↓
Response: { id: 123, ... }
  ↓
expensesProvider state updated
  ↓
Show SnackBar "Expense added"
  ↓
Navigator.pop(context) → Back to /driver/today
```

### 6. **Interactive Checklist Flow**
```
User: /driver/today → "Checklist" button
  ↓
context.push('/driver/checklist')
  ↓
DriverChecklistScreen
  ↓
User selects type: "Pre-Trip" or "Post-Trip"
  ↓
Items loaded:
  Pre-Trip: Engine Oil, Coolant, Tyres, Brakes, Lights, etc.
  Post-Trip: Vehicle Damage, Fuel, Mileage, Cargo, etc.
  ↓
Progress bar shows X/12 items checked
  ↓
User taps item → Checkbox toggles + optional note dialog
  ↓
User types notes (modal dialog)
  ↓
When done: "Complete Checklist" button
  ↓
Checklist object created:
  {
    tripId: 123,
    type: 'pre_trip',
    items: [
      ChecklistItem(id: 'engine_oil', checked: true, note: 'Good'),
      ...
    ],
    completedAt: '2025-03-17T14:30:00Z'
  }
  ↓
POST /checklists/ { ...checklist data }
  ↓
SnackBar "Checklist completed successfully"
  ↓
Dismiss popup, back to /driver/today
```

### 7. **Logout Flow**
```
User: Menu → "Logout"
  ↓
Confirm dialog?
  ↓
ref.read(authStateProvider.notifier).logout()
  ↓
AuthService.logout():
  - Clear all secure storage
  - Route.go('/login')
  ↓
All providers reset (AuthState cleared)
  ↓
Redirect to LoginScreen
```

---

## 9. Offline Capability

### OfflineSyncService
```dart
class OfflineSyncService {
  bool isOnline;  // Watched by connectivityProvider
  
  // Queue failed requests locally
  void queueRequest(String method, String path, data);
  
  // When online again, retry queued requests
  Future<void> syncPending();
}
```

### Offline Workflow
```
User submits expense while offline:
  ↓
API request fails (no internet)
  ↓
OfflineSyncService.queueRequest() stores locally
  ↓
Show banner at top: "Operating offline"
  ↓
Internet returns:
  ↓
OfflineSyncService detects connectivity change
  ↓
syncPending() sends queued requests
  ↓
All updates sync back to server
```

### UI Integration
```dart
// In main.dart builder:
if (!isOnline) {
  Positioned(
    child: Container(
      color: KTColors.danger,
      child: Text("No internet connection"),
    ),
  );
}
```

---

## 10. Theme & Styling System

### Color Palette (KTColors)
```dart
// Brand Colors
primary = Color(0xFFE65100);        // Orange
primaryDark = Color(0xFFBF360C);
primaryLight = Color(0xFFFFCCBC);

// Role Accent Colors
roleDriver = Color(0xFF006064);     // Teal
roleFleet = Color(0xFF1B5E20);      // Green
roleAccountant = Color(0xFFF57F17); // Amber

// Semantic Colors
success = Color(0xFF2E7D32);   // Green
warning = Color(0xFFF9A825);   // Amber
danger = Color(0xFFC62828);    // Red
info = Color(0xFF01579B);      // Blue

// Surface Colors
cardSurface = Color(0xFFFAFAFA);
cardSurfaceDark = Color(0xFF1E1E1E);
```

### Text Styles (KTTextStyles)
```dart
h1 = Poppins 24px w600;
h2 = Poppins 20px w600;
h3 = Poppins 16px w600;
body = Inter 14px w400;
bodySmall = Inter 12px w400;
label = Inter 13px w500;
mono = JetBrainsMono 13px;
```

### Theme Switching
```dart
// Light & Dark themes defined in AppTheme
// System automatically switches based on device settings
// Can be overridden: themeMode: ThemeMode.light/dark/system
```

---

## 11. Common Widgets Library

Located in `core/widgets/`, reusable across all screens:

```
KtButton                  - Primary action buttons (solid/outlined)
KtTextField               - Text input with validation
KtStatusBadge            - Status indicator chips
KtStatCard               - Dashboard stat cards
KtLoadingShimmer         - Loading skeleton screens
SectionHeader            - Section title with divider
OfflineBanner            - "Operating offline" notification
PhotoCapture             - Camera/gallery image picker
ErrorStateWidget         - Error display with retry
EmptyStateWidget         - Empty list display
```

### Widget Usage Example
```dart
KtTextField(
  label: 'Amount',
  controller: amountCtrl,
  keyboardType: TextInputType.number,
  validator: (v) {
    if (v == null || v.isEmpty) return 'Required';
    if (double.tryParse(v) == null) return 'Invalid';
    return null;
  },
)

KtButton(
  label: 'Submit',
  icon: Icons.send,
  onPressed: () => _submit(),
  isLoading: submitting,
)
```

---

## 12. Exception Handling

### Exception Hierarchy
```dart
core/exceptions/

- NetworkException
- AuthenticationException
- ValidationException
- ServerException
- LocalStorageException
```

### Try-Catch Pattern
```dart
try {
  final data = await apiService.get('/trips/');
  state = AsyncValue.data(data);
} catch (e, st) {
  state = AsyncValue.error(e, st);
  // UI shows in AsyncValue.error() branch
}
```

---

## 13. File Structure Summary

```
lib/
├── main.dart                          # App entry point with ProviderScope
│   └─ Currently shows SplashTestApp for splash screen testing
│
├── screens/
│   ├── splash_screen.dart             # 🎬 Cinematic splash animation (NEW)
│   │   ├─ SplashScreen (ConsumerStatefulWidget)
│   │   ├─ Animation phases: drive in → turn → approach → fade
│   │   ├─ Callbacks: onReadyForLogin, onComplete
│   │   ├─ Helper classes: TruckPainter, BackgroundPainter, Perspective
│   │   └─ Custom curve: _DoorOpeningCurve
│   │
│   ├── auth/
│   │   ├── login_screen.dart          # Login form with email/password
│   │   └── web_only_screen.dart       # Web platform fallback
│   │
│   ├── driver/
│   │   ├── driver_home_screen.dart    # Bottom nav shell (4 tabs)
│   │   ├── driver_today_screen.dart   # Daily tasks & active trip
│   │   ├── driver_trip_list_screen.dart   # Trip browsing & filtering
│   │   ├── driver_trip_detail_screen.dart # Trip details + status update
│   │   ├── driver_expense_list_screen.dart # Expense history
│   │   ├── driver_add_expense_screen.dart  # Add expense form
│   │   ├── driver_gps_tracking_screen.dart # Real-time location
│   │   ├── driver_checklist_screen.dart    # Pre/post-trip checklist
│   │   ├── driver_documents_screen.dart    # License & permits
│   │   ├── driver_notifications_screen.dart # Notification center
│   │   └── driver_profile_screen.dart  # User profile
│   │
│   ├── fleet_manager/ (or fleet/)
│   │   ├── fleet_home_screen.dart          # Fleet dashboard
│   │   ├── fleet_vehicle_list_screen.dart  # Vehicle inventory
│   │   ├── fleet_vehicle_detail_screen.dart # Vehicle details & maintenance
│   │   ├── fleet_live_map_screen.dart      # Real-time fleet tracking
│   │   ├── fleet_service_log_screen.dart   # Service records
│   │   └── fleet_tyre_event_screen.dart    # Tyre management
│   │
│   ├── accountant/
│   │   ├── accountant_home_screen.dart     # Accountant dashboard
│   │   ├── accountant_invoices_screen.dart # Invoice management
│   │   ├── accountant_payments_screen.dart # Payment tracking
│   │   ├── accountant_receivables_screen.dart # AR/AP reporting
│   │   └── accountant_expense_approval_screen.dart # Expense approvals
│   │
│   └── associate/
│       ├── associate_home_screen.dart      # Associate dashboard
│       ├── associate_job_list_screen.dart  # Job management
│       ├── associate_trip_close_screen.dart # Trip closure
│       ├── associate_lr_create_screen.dart # Lorry Receipt
│       └── associate_ewb_create_screen.dart # E-Way Bill
│
├── core/
│   ├── router/
│   │   ├── app_router.dart                 # GoRouter config (role-based)
│   │   └── page_transitions.dart           # Custom animations
│   │
│   ├── theme/
│   │   ├── app_theme.dart                  # Material 3 theme setup
│   │   ├── kt_colors.dart                  # Brand color palette
│   │   └── kt_text_styles.dart             # Typography system
│   │
│   ├── widgets/                            # Reusable UI components
│   │   ├── kt_button.dart                  # 6 button variants
│   │   ├── kt_text_field.dart              # Form input with validation
│   │   ├── kt_status_badge.dart            # Status indicators
│   │   ├── kt_stat_card.dart               # Dashboard KPI cards
│   │   ├── kt_role_badge.dart              # Role-based badges
│   │   ├── kt_alert_card.dart              # Alert messages
│   │   ├── kt_loading_shimmer.dart         # Skeleton loaders
│   │   ├── kt_empty_state.dart             # Empty state UI
│   │   ├── kt_error_state.dart             # Error display
│   │   ├── offline_banner.dart             # Offline indicator
│   │   ├── section_header.dart             # Section titles
│   │   ├── photo_capture.dart              # Camera/gallery picker
│   │   ├── status_chip.dart                # Inline status
│   │   └── ... (15+ components total)
│   │
│   └── exceptions/
│       └── app_exception.dart              # Custom exceptions
│
├── models/
│   ├── user.dart                           # User entity
│   ├── trip.dart                           # Trip entity
│   ├── expense.dart                        # Expense entity
│   ├── attendance.dart                     # Attendance entity
│   ├── checklist.dart                      # Checklist entity
│   └── notification.dart                   # Notification entity
│
├── services/
│   ├── api_service.dart                    # HTTP client (Dio)
│   │   ├─ Base URL: http://10.0.2.2:8000/api/v1 (Android emulator)
│   │   ├─ Token refresh interceptor
│   │   └─ Authorization header injection
│   │
│   ├── auth_service.dart                   # Authentication logic
│   ├── location_service.dart               # GPS tracking
│   ├── notification_service.dart           # Firebase Messaging
│   ├── offline_sync_service.dart           # Async offline queue
│   ├── biometric_auth_service.dart         # Fingerprint auth
│   └── websocket_service.dart              # Real-time updates
│
├── providers/
│   ├── auth_provider.dart                  # Auth state & token management
│   ├── trip_provider.dart                  # Trip list & details
│   ├── expense_provider.dart               # Expense management
│   ├── attendance_provider.dart            # Check-in/out
│   ├── checklist_provider.dart             # Pre/post-trip checklists
│   ├── jobs_provider.dart                  # Job assignments
│   ├── vehicles_provider.dart              # Fleet vehicles
│   ├── finance_provider.dart               # Financial metrics
│   │
│   ├── associate_dashboard_provider.dart   # Associate KPIs
│   ├── accountant_dashboard_provider.dart  # Accountant KPIs
│   ├── fleet_dashboard_provider.dart       # Fleet KPIs
│   │
│   ├── connectivity_provider.dart          # Online/offline status
│   ├── offline_sync_status_provider.dart   # Pending requests
│   ├── notifications_provider.dart         # Notification list
│   ├── notification_provider.dart          # Single notification
│   ├── search_provider.dart                # Global search
│   ├── cache_manager_provider.dart         # Image caching
│   └── recent_activity_provider.dart       # Activity timeline
│
└── utils/
    └── optimistic_update.dart              # Optimistic UI updates

```

---

## 14. Development Workflow

### Adding a New Feature

1. **Create Model** (if needed)
   ```dart
   // models/my_entity.dart
   class MyEntity {
     factory MyEntity.fromJson(Map<String, dynamic> json) { }
     Map<String, dynamic> toJson() { }
   }
   ```

2. **Create API Methods**
   ```dart
   // services/api_service.dart
   Future<List<MyEntity>> getMyEntities() async {
     final response = await _dio.get('/my-entities/');
     return (response.data['items'] as List)
       .map((e) => MyEntity.fromJson(e))
       .toList();
   }
   ```

3. **Create Provider**
   ```dart
   // providers/my_entity_provider.dart
   final myEntitiesProvider = StateNotifierProvider<MyEntitiesNotifier, AsyncValue<List<MyEntity>>>((ref) {
     return MyEntitiesNotifier(ref.read(apiServiceProvider));
   });
   
   class MyEntitiesNotifier extends StateNotifier<AsyncValue<List<MyEntity>>> {
     Future<void> fetch() async { }
   }
   ```

4. **Create Screen**
   ```dart
   // screens/my_entity_screen.dart
   class MyEntityScreen extends ConsumerWidget {
     @override
     Widget build(BuildContext context, WidgetRef ref) {
       final entitiesAsync = ref.watch(myEntitiesProvider);
       return entitiesAsync.when(
         data: (entities) => _buildList(entities),
         loading: () => _buildLoading(),
         error: (e, st) => _buildError(e),
       );
     }
   }
   ```

5. **Add Route**
   ``` dart
   // core/router/app_router.dart
   GoRoute(
     path: '/my-entities',
     builder: (_, __) => MyEntityScreen(),
   )
   ```

---

## 17. Updated Key Takeaways for Understanding the App

✅ **Multi-Layer Architecture**: Splash → Login → UI (Screens) → State (Providers) → Services → Logic

✅ **Cinematic User Experience**: Splash screen sets the tone with a 4.2-second cinematic truck animation before login

✅ **Riverpod State Management**: 18 provider modules managing auth, domain data, dashboards, and utilities

✅ **Async State Handling**: Every provider returns `AsyncValue` with three states (loading/error/data)

✅ **Token-Based Auth**: JWT tokens in secure storage, auto-refresh on 401 errors

✅ **Role-Based Routing**: User's primary role determines entire app navigation tree

✅ **Clean Separation**: 
  - Models: Pure data structures (no logic)
  - Services: Business logic & API calls (no UI)
  - Providers: State management (watch/read patterns)
  - Screens: UI only (no business logic)

✅ **Offline-First Design**: Failed requests queued locally, automatically synced when online

✅ **Material 3 Design System**: Custom Kavya brand theme with orange primary, role-based accent colors

✅ **Type Safety**: All models implement fromJson/toJson for proper serialization

✅ **Error Handling**: AsyncValue.error pattern, SnackBars for user feedback

✅ **Real-Time Features**: WebSocket support, Firebase Messaging, GPS location tracking

✅ **Interactive UI**: Checklists with item notes, photo capture, optimistic updates

---

## 18. App Initialization Lifecycle

```
┌─────────────────────────────┐
│ main() async               │
├─────────────────────────────┤
│ 1. ensureInitialized()      │
│    (Binding setup)          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ ProviderScope              │
│ └─ Global provider container│
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ KavyaApp (ConsumerWidget)  │
│ ├─ MaterialApp.router       │
│ ├─ Theme dark mode          │
│ └─ Watch routerProvider     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ routerProvider checks:      │
│                             │
│ 1. No token? → /login       │
│ 2. Has token? Check role    │
│ 3. Route based on role      │
└──────────┬──────────────────┘
           │
           ├─── driver ────┐
           ├─── fleet_mgr  ┤─► StatefulShell
           ├─── accountant │    (Bottom nav)
           └─── associate──┘

  (All states managed by Riverpod)
```

### Provider Initialization Order
```
1. connectivityProvider          (Online/offline check)
2. authStateProvider            (Restore session if token exists)
3. offlineSyncStatusProvider    (Check pending requests)
4. routerProvider               (Navigate based on auth state)
5. Other domain providers       (Load on demand per screen)
```

---

## 19. Services Deep Dive

### ApiService (HTTP Client)
```dart
class ApiService {
  final Dio _dio;
  
  // Configuration:
  baseUrl = 'http://10.0.2.2:8000/api/v1'  // Android emulator
  timeoutMs = 30000
  
  // Interceptors:
  - RequestInterceptor: Add Authorization header
  - ErrorInterceptor: Handle 401 token refresh
  - LoggingInterceptor: Debug request/response logging
  
  // Methods:
  get<T>(path, {fromJson})
  post<T>(path, {data, contentType})
  patch<T>(path, {data})
  delete(path)
}
```

### AuthService (Authentication)
```dart
Future<(String, String, User)> login(email, password) async {
  // POST /auth/login
  // Returns: (accessToken, refreshToken, userObject)
}

Future<String> refreshToken(refreshToken) async {
  // POST /auth/refresh
  // Returns: newAccessToken
}

Future<void> logout() async {
  // Clear FlutterSecureStorage
  // Reset all providers
}
```

### LocationService (GPS Tracking)
```dart
Stream<Position> getLocationUpdates({
  accuracy: LocationAccuracy.best,
  distanceFilter: 0,  // Update on every change
})

// Integrates with real-time trip tracking
// Sends coordinates to backend via API
```

### NotificationService (Firebase)
```dart
// Receives push notifications
// Parses payload
// Updates notificationsProvider
// Shows local notification if app in foreground
```

### OfflineSyncService (Queue Management)
```dart
// Stores failed requests in local DB
// Monitors connectivity changes
// On internet restored: syncPending()
// Retries all queued requests
```

---

## 20. Complete Data Flow Example: Add Expense

```
USER INTERACTION:
┌─────────────────────────────────────────┐
│ User: Driver Home → "Add Expense" FAB    │
└────────────┬────────────────────────────┘
             │ context.push('/driver/add-expense')
             ▼
┌──────────────────────────────────────────┐
│ DriverAddExpenseScreen mounts             │
│ ├─ Form fields: category, amount, desc   │
│ ├─ Optional photo capture button          │
│ └─ Submit button (with loading state)    │
└────────────┬─────────────────────────────┘
             │ User fills form & taps Submit
             ▼
┌──────────────────────────────────────────┐
│ onSubmit callback                        │
│ ├─ Validate all fields                  │
│ ├─ Set loading = true (UI update)       │
│ └─ Create Expense object                │
└────────────┬─────────────────────────────┘
             │ ref.read(expensesProvider.notifier).addExpense(expense)
             ▼
┌──────────────────────────────────────────┐
│ ExpensesNotifier receives request        │
│ └─ state = AsyncValue.loading            │
└────────────┬─────────────────────────────┘
             │ (UI shows loading spinner)
             ▼
┌──────────────────────────────────────────┐
│ ApiService.post('/expenses/', data)      │
│ ├─ Add Authorization header              │
│ ├─ Serialize expense.toJson()            │
│ └─ Send to backend                       │
└────────────┬─────────────────────────────┘
             │ Response from server
             ▼
┌──────────────────────────────────────────┐
│ Response: { id: 123, ... }               │
│                                          │
│ SUCCESS:                                 │
│ ├─ Parse to Expense object               │
│ ├─ Add to expenses list                  │
│ ├─ state = AsyncValue.data(newList)      │
│ └─ Show SnackBar: "Expense added"        │
│                                          │
│ ERROR (e.g., timeout):                   │
│ ├─ Queue in OfflineSyncService           │
│ ├─ state = AsyncValue.error(exception)   │
│ ├─ Show SnackBar: "Will sync when online"│
│ └─ Display error UI                      │
└────────────┬─────────────────────────────┘
             │ Set loading = false
             ▼
┌──────────────────────────────────────────┐
│ UI Rebuilds (ConsumerStatefulWidget)     │
│ ├─ Loading spinner disappears            │
│ ├─ Form resets                           │
│ └─ List updates (if watching provider)   │
└────────────┬─────────────────────────────┘
             │ Navigator.pop() after delay
             ▼
┌──────────────────────────────────────────┐
│ Back to /driver/today                   │
│ └─ Expense list includes new item        │
└──────────────────────────────────────────┘
```

---

## 21. Role-Based Route Structure

```
DRIVER ROLE ROUTES:
/login (entry point)
  └─ /driver (shell)
     ├─ /driver/today          (default, active trip)
     ├─ /driver/trips          (browsable list)
     ├─ /driver/expenses       (expense history)
     └─ /driver/profile        (user settings)
     
     Modal routes (full screen):
     ├─ /driver/trip/:id       (detail screen)
     ├─ /driver/add-expense    (form)
     ├─ /driver/checklist      (interactive)
     ├─ /driver/documents      (gallery)
     ├─ /driver/gps            (tracking map)
     └─ /driver/notifications  (notification center)

FLEET MANAGER ROLE ROUTES:
/login
  └─ /fleet (shell)
     ├─ /fleet/home           (dashboard)
     ├─ /fleet/vehicles       (inventory)
     ├─ /fleet/map            (live tracking)
     ├─ /fleet/analytics      (reports)
     └─ /fleet/notifications  (center)

ACCOUNTANT ROLE ROUTES:
/login
  └─ /accountant (shell)
     ├─ /accountant/home           (dashboard)
     ├─ /accountant/invoices       (management)
     ├─ /accountant/payments       (tracking)
     ├─ /accountant/receivables    (AR/AP)
     └─ /accountant/approvals      (expense review)

PROJECT ASSOCIATE ROLE ROUTES:
/login
  └─ /associate (shell)
     ├─ /associate/home              (dashboard)
     ├─ /associate/jobs              (assignments)
     ├─ /associate/trip-close        (closure workflow)
     ├─ /associate/lr-create         (Lorry Receipt)
     └─ /associate/ewb-create        (E-Way Bill)
```

---

---

## 22. API Endpoints Expected by the App

```
BASE URL: http://10.0.2.2:8000/api/v1 (Android emulator)
           http://localhost:8000/api/v1 (Web/local)

AUTHENTICATION:
POST   /auth/login                  { email, password }
POST   /auth/refresh                { refresh_token }
POST   /auth/logout                 (requires auth header)
GET    /auth/me                     (returns current user)

TRIPS:
GET    /trips/                      (list all trips, with filters)
GET    /trips/{id}                  (trip details)
PATCH  /trips/{id}/status           { status: "in_transit"|"completed" }
POST   /trips/{id}/close            { receivedAmount, items[], notes }
GET    /trips/{id}/checklist        (pre/post-trip)

EXPENSES:
GET    /expenses/                   (list expenses, with filters)
GET    /expenses/{id}               (expense detail)
POST   /expenses/                   { tripId, category, amount, description, receiptUrl }
PATCH  /expenses/{id}               (update expense)
PATCH  /expenses/{id}/approve       (accountant action)

ATTENDANCE:
GET    /attendance/today            (daily record)
POST   /attendance/check-in         { lat, lng, timestamp }
POST   /attendance/check-out        { lat, lng, timestamp }

CHECKLISTS:
GET    /checklists/{tripId}         (fetch checklist)
POST   /checklists/                 { tripId, type, items, completedAt }
PATCH  /checklists/{id}             (update checklist)

VEHICLES:
GET    /vehicles/                   (fleet inventory)
GET    /vehicles/{id}               (vehicle details)
POST   /vehicles/{id}/service       { date, type, notes }

LOCATIONS (Real-time Tracking):
POST   /location/track              { tripId, lat, lng, accuracy, timestamp }
GET    /location/trip/{tripId}      (tracking history)

NOTIFICATIONS:
GET    /notifications/              (list unread)
PATCH  /notifications/{id}/read     (mark as read)
DELETE /notifications/{id}          (delete)

DOCUMENTS:
POST   /documents/upload            multipart/form-data
GET    /documents/{id}/download     (fetch document)

JOBS (Project Associate):
GET    /jobs/                       (assigned jobs)
PATCH  /jobs/{id}/status            (update job status)

INVOICES (Accountant):
GET    /invoices/                   (invoice list)
GET    /invoices/{id}               (invoice detail)
POST   /invoices/generate           { tripIds[], clientId }

FINANCE:
GET    /finance/summary             (KPIs: total revenue, expenses, etc)
GET    /finance/daily-report        (daily metrics)
GET    /finance/monthly-report      (monthly metrics)
```

---

## 23. Common Error Handling Scenarios

```
NETWORK ERROR (No Internet):
├─ ApiService throws NetworkException
├─ Provider state = AsyncValue.error(NetworkException)
├─ UI shows: "No internet connection"
├─ OfflineSyncService queues the request
└─ Automatic retry when online

401 UNAUTHORIZED (Token Expired):
├─ ApiService interceptor catches 401
├─ Attempts token refresh: POST /auth/refresh
├─ If refresh succeeds:
│  ├─ Save new access_token
│  └─ Retry original request
├─ If refresh fails:
│  ├─ Clear FlutterSecureStorage
│  ├─ Reset all providers
│  └─ Redirect to /login
└─ User must re-authenticate

500 SERVER ERROR:
├─ ApiService throws ServerException
├─ Provider state = AsyncValue.error(ServerException)
├─ UI shows: "Server error occurred"
└─ User can retry manually or wait for auto-sync

VALIDATION ERROR (400):
├─ ApiService throws ValidationException
├─ Provider state = AsyncValue.error(ValidationException)
├─ UI shows: Specific field errors (e.g., "Invalid amount")
└─ User corrects form and retries
```

---

## 24. Performance Optimizations

```
LAZY LOADING:
├─ FutureProvider.autoDispose
│  └─ Disposes when not watched (saves memory)
├─ Provider.family
│  └─ Parametrized providers (e.g., tripDetailProvider(tripId))
└─ Select watchers
   └─ Only rebuild when watched property changes

CACHING:
├─ cache_manager_provider
│  └─ Image & document caching via hive/cache_hit
├─ Provider memoization
│  └─ Computed providers cache unless deps change
└─ HTTP response caching
   └─ Via Dio & backend cache-control headers

DEBOUNCING:
├─ Search queries debounced (500ms)
├─ Location tracking debounced (by distance)
└─ Form validation debounced (avoid excessive rebuilds)

BATCHING:
├─ Async operations batched
├─ Auto-sync combines multiple requests
└─ WebSocket reduces polling requests
```

---

## 25. Testing Strategy (Test Files Provided)

```
test/
├── widget_test.dart               # UI component tests
├── offline_sync_test.dart         # Offline queue & sync logic

Testing patterns in app:
├─ Unit tests for models & services
├─ Widget tests for screens & components
├─ Integration tests for auth flow
└─ E2E tests for critical user journeys
```

---

## 26. Deployment & Build Configuration

```
FLAVORS (build variants):
├─ dev    (10.0.2.2:8000 - Android emulator)
├─ staging (staging.kavya.com)
└─ prod  (api.kavya.com)

BUILD COMMANDS:
flutter build apk --flavor dev -t lib/main.dart
flutter build apk --flavor prod -t lib/main.dart
flutter build ios --flavor prod -t lib/main.dart

PLATFORM CONFIGS:
├─ iOS:    ios/Runner/Info.plist (permissions)
├─ Android: android/app/build.gradle.kts (signing)
├─ Web:     web/index.html (PWA config)
└─ macOS:   macos/Runner/Info.plist
```

---

## 27. Live Data Features

```
REAL-TIME UPDATES:
├─ WebSocket Service
│  ├─ Trip status updates
│  ├─ Notification broadcasts
│  └─ Fleet location sync (30-second intervals)
│
├─ Firebase Cloud Messaging
│  ├─ Push notifications
│  ├─ Silent data messages
│  └─ Local notification fallback
│
└─ GPS Location Streaming
   ├─ Updates every 10 meters (or 5 seconds)
   ├─ Sent to backend for tracking
   └─ Used for real-time map display (Fleet Manager)
```

---

## 28. Security Considerations

```
TOKEN SECURITY:
├─ FlutterSecureStorage (iOS Keychain, Android Keystore)
├─ Access token: Short-lived (15 min typical)
├─ Refresh token: Long-lived (7 days typical)
└─ Never stored in SharedPreferences or plain text

HTTPS/TLS:
├─ All API calls over HTTPS (production)
├─ Certificate pinning available via Dio config
└─ Dev uses HTTP on emulator (10.0.2.2)

BIOMETRIC AUTH:
├─ Optional fingerprint/face unlock
├─ Uses device secure enclave
└─ Falls back to password if biometric unavailable

DATA VALIDATION:
├─ Client-side form validation (before submit)
├─ Server-side validation (always)
├─ Input sanitization for text fields
└─ File upload size/type restrictions
```

---

## 29. Common Development Tasks

```
ADD NEW ROLE/FEATURE:

1. Create model (if needed):
   models/new_entity.dart

2. Create provider:
   providers/new_entity_provider.dart

3. Create API methods:
   services/api_service.dart (add get/post methods)

4. Create screens:
   screens/new_role/new_role_screen.dart

5. Add navigation:
   core/router/app_router.dart (add GoRoute)

6. Add tests:
   test/new_entity_test.dart

7. Update auth for new role:
   services/auth_service.dart (add role case)
```

---

## Summary of Key Tech Stack

```
UI Framework       : Flutter 3.x + Material 3
State Management   : Flutter Riverpod (18 providers)
Navigation         : GoRouter (with deep linking)
HTTP Client        : Dio (auto token refresh)
Authentication     : JWT tokens + Biometric
Storage            : FlutterSecureStorage + Hive
Real-Time          : WebSocket + Firebase Messaging
Location           : geolocator package
Image Handling     : image_picker + camera
Database (offline) : Hive for local queue
Notifications      : Firebase Cloud Messaging
Animations         : Flutter CustomPaint (splash screen)
Typography         : Poppins, Inter, JetBrains Mono
Testing            : Flutter test framework
```

---

**📚 This comprehensive documentation provides a complete understanding of the Kavya Transports ERP Flutter app architecture, data flow, and implementation patterns. Use this as a reference for development and onboarding!** 🚀

