import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// We will import the actual screens as we build them in subsequent steps.
// For now, these act as placeholders for the routes defined in [cite: 45-47].
import '../../screens/auth/login_screen.dart'; 
import '../../screens/auth/web_only_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  const storage = FlutterSecureStorage();

  return GoRouter(
    initialLocation: '/login',
    redirect: (BuildContext context, GoRouterState state) async { // [cite: 42]
      final token = await storage.read(key: 'access_token');
      final role = await storage.read(key: 'primary_role'); // [cite: 43]
      final isLoginPage = state.matchedLocation == '/login';

      if (token == null && !isLoginPage) {
        return '/login'; // [cite: 43]
      }
      
      if (token != null && isLoginPage) { // [cite: 44]
        // Redirect to correct home for this role
        switch (role) {
          case 'driver': return '/home/today';
          case 'fleet_manager': return '/fleet/home';
          case 'accountant': return '/accountant/home';
          case 'project_associate': return '/associate/home';
          default: return '/web-only';
        }
      }
      return null; // [cite: 45]
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const Scaffold(body: Center(child: Text('Login Screen Coming Next'))), // Placeholder for LoginScreen [cite: 45]
      ),
      GoRoute(
        path: '/web-only',
        builder: (context, state) => const Scaffold(body: Center(child: Text('Web Only Screen'))), // Placeholder for WebOnlyScreen [cite: 45]
      ),
      // --- Fleet Routes --- [cite: 45-46]
      GoRoute(path: '/fleet/home', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/map', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/vehicles', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/vehicle/:id', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/expenses', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/service/new', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/fleet/tyre/new', builder: (context, state) => const Scaffold()),
      
      // --- Accountant Routes --- [cite: 46]
      GoRoute(path: '/accountant/home', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/accountant/receivables', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/accountant/invoices', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/accountant/invoice/:id', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/accountant/expenses', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/accountant/payments', builder: (context, state) => const Scaffold()),
      
      // --- Associate Routes --- [cite: 46-47]
      GoRoute(path: '/associate/home', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/jobs', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/lr/create', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/lr/list', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/ewb/create', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/trip/close', builder: (context, state) => const Scaffold()),
      GoRoute(path: '/associate/upload', builder: (context, state) => const Scaffold()),
      
      // --- Driver Routes --- [cite: 47]
      GoRoute(path: '/home/today', builder: (context, state) => const Scaffold()),
    ],
  );
});