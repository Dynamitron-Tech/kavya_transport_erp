import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Custom page transitions for GoRouter
class CustomPageTransitions {
  /// Fade transition
  static Page<dynamic> fadeTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(opacity: animation, child: child);
      },
      transitionDuration: duration,
    );
  }

  /// Slide from right transition
  static Page<dynamic> slideRightTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const begin = Offset(1.0, 0.0);
        const end = Offset.zero;
        const curve = Curves.easeInOutCubic;
        final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
        return SlideTransition(position: animation.drive(tween), child: child);
      },
      transitionDuration: duration,
    );
  }

  /// Slide from left transition
  static Page<dynamic> slideLeftTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const begin = Offset(-1.0, 0.0);
        const end = Offset.zero;
        const curve = Curves.easeInOutCubic;
        final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
        return SlideTransition(position: animation.drive(tween), child: child);
      },
      transitionDuration: duration,
    );
  }

  /// Scale + Fade transition (pop-in effect)
  static Page<dynamic> scaleTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const curve = Curves.easeInOutCubic;
        final scaleTween = Tween<double>(begin: 0.0, end: 1.0)
            .chain(CurveTween(curve: curve));
        final fadeAnimation = animation.drive(scaleTween);

        return ScaleTransition(
          scale: fadeAnimation,
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      transitionDuration: duration,
    );
  }

  /// Slide up from bottom transition (modal-like)
  static Page<dynamic> slideUpTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 400),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const begin = Offset(0.0, 1.0);
        const end = Offset.zero;
        const curve = Curves.easeOutCubic;
        final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));

        return SlideTransition(
          position: animation.drive(tween),
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      transitionDuration: duration,
    );
  }

  /// Rotate + Scale transition (festive effect)
  static Page<dynamic> rotateScaleTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 500),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const curve = Curves.easeInOutBack;
        final rotateTween = Tween<double>(begin: 0.0, end: 1.0)
            .chain(CurveTween(curve: curve));

        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001)
            ..rotateY(rotateTween.evaluate(animation) * 1.57),
          child: ScaleTransition(
            scale: animation,
            child: FadeTransition(opacity: animation, child: child),
          ),
        );
      },
      transitionDuration: duration,
    );
  }

  /// Nested route transition (for pages within shells)
  static Page<dynamic> nestedTransition({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
    Duration duration = const Duration(milliseconds: 200),
  }) {
    return CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return ScaleTransition(
          scale: Tween<double>(begin: 0.95, end: 1.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeInOutQuad),
          ),
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      transitionDuration: duration,
    );
  }
}

/// Page transition presets for different route types
class PageTransitionPreset {
  static const Map<String, Duration> transitionDurations = {
    'fast': Duration(milliseconds: 200),
    'normal': Duration(milliseconds: 300),
    'slow': Duration(milliseconds: 500),
  };

  /// Standard transition for main screens
  static Page<dynamic> standard({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
  }) {
    return CustomPageTransitions.slideRightTransition(
      context: context,
      state: state,
      child: child,
      duration: transitionDurations['normal']!,
    );
  }

  /// Modal-like transition for form/detail screens
  static Page<dynamic> modal({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
  }) {
    return CustomPageTransitions.slideUpTransition(
      context: context,
      state: state,
      child: child,
      duration: transitionDurations['normal']!,
    );
  }

  /// Fast transition for tabs/nested routes
  static Page<dynamic> fast({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
  }) {
    return CustomPageTransitions.nestedTransition(
      context: context,
      state: state,
      child: child,
      duration: transitionDurations['fast']!,
    );
  }

  /// Pop-in for dialogs/overlays
  static Page<dynamic> popIn({
    required BuildContext context,
    required GoRouterState state,
    required Widget child,
  }) {
    return CustomPageTransitions.scaleTransition(
      context: context,
      state: state,
      child: child,
      duration: transitionDurations['normal']!,
    );
  }
}
