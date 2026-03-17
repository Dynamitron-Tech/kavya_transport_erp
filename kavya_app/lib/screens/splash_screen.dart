import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:math' as math;

// ─────────────────────────────────────────────
//  ANIMATION PHASES
//  0.00 → 0.28  Phase 1 : Truck drives in from mid-left  (side view)
//  0.28 → 0.44  Phase 2 : Truck turns right              (side → front morph)
//  0.44 → 0.72  Phase 3 : Truck rushes toward camera     (front view, scale up)
//  0.68 → 0.80  Phase 4 : Flash / white-out              (truck fills screen)
//  0.76 → 1.00  Phase 5 : Login card rises in            (fade + slide)
// ─────────────────────────────────────────────

class SplashScreen extends ConsumerStatefulWidget {
  final VoidCallback? onReadyForLogin;
  final VoidCallback onComplete;

  const SplashScreen({
    Key? key,
    this.onReadyForLogin,
    required this.onComplete,
  }) : super(key: key);

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  // ── Controllers ──────────────────────────────
  late AnimationController _mainController;
  late AnimationController _roadLoopController; // infinite road parallax

  // ── Phase 1 : Drive-in ────────────────────────
  late Animation<double> _truckX; // -1.0 → 0.0 (fraction of half-screen)

  // ── Phase 2 : Turn (side → front morph) ───────
  late Animation<double> _turnProgress; // 0 → 1

  // ── Phase 3 : Approach ────────────────────────
  late Animation<double> _approachScale;   // 1 → 9
  late Animation<double> _approachOpacity; // 1 → 0

  // ── Phase 4 : Flash ───────────────────────────
  late Animation<double> _flashOpacity; // 0 → 1 → 0

  // ── Phase 5 : Login reveal ────────────────────
  late Animation<double> _loginSlide;   // 60px → 0px
  late Animation<double> _loginOpacity; // 0 → 1
  late Animation<double> _bgDarken;     // sky darkens during approach

  // ── State ─────────────────────────────────────
  bool _loginReadyFired = false;
  bool _skipLocked      = false;

  static const Duration _total = Duration(milliseconds: 4800);

  // ─────────────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();

    _roadLoopController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    )..repeat();

    _mainController = AnimationController(duration: _total, vsync: this);
    _mainController.addListener(_onMainTick);

    // ── Phase 1 ──────────────────────────────────────────────────────────
    _truckX = Tween<double>(begin: -1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.00, 0.28, curve: Curves.easeOutCubic),
      ),
    );

    // ── Phase 2 ──────────────────────────────────────────────────────────
    _turnProgress = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.28, 0.44, curve: Curves.easeInOut),
      ),
    );

    // ── Phase 3 ──────────────────────────────────────────────────────────
    _approachScale = Tween<double>(begin: 1.0, end: 9.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.44, 0.72, curve: Curves.easeInQuart),
      ),
    );

    _approachOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.64, 0.76, curve: Curves.easeIn),
      ),
    );

    // ── Phase 4 ──────────────────────────────────────────────────────────
    _flashOpacity = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 1.0)
            .chain(CurveTween(curve: Curves.easeInExpo)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeOutQuad)),
        weight: 70,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.68, 0.84),
      ),
    );

    // ── Phase 5 ──────────────────────────────────────────────────────────
    _loginSlide = Tween<double>(begin: 60.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.78, 1.00, curve: Curves.easeOutCubic),
      ),
    );

    _loginOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.76, 0.96, curve: Curves.easeOut),
      ),
    );

    _bgDarken = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.44, 0.74, curve: Curves.easeOut),
      ),
    );

    // ── Start ─────────────────────────────────────────────────────────────
    _mainController.forward();

    // Auto-complete safety net
    Future.delayed(const Duration(milliseconds: 5400), () {
      if (mounted) widget.onComplete();
    });
  }

  void _onMainTick() {
    final v = _mainController.value;

    // Road stops once truck faces front
    if (v > 0.44 && _roadLoopController.isAnimating) {
      _roadLoopController.stop();
    }

    // Notify login ready after flash
    if (v > 0.80 && !_loginReadyFired) {
      _loginReadyFired = true;
      HapticFeedback.mediumImpact();
      widget.onReadyForLogin?.call();
    }

    // Auto-complete at end
    if (v >= 1.0) {
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) widget.onComplete();
      });
    }
  }

  void _handleTap() {
    if (_skipLocked) return;
    final v = _mainController.value;

    if (v < 0.44) {
      _mainController.animateTo(
        0.44,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutExpo,
      );
      return;
    }

    if (v < 0.76) {
      _mainController.animateTo(
        0.78,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutExpo,
      );
      return;
    }

    _skipLocked = true;
    _mainController.animateTo(
      1.0,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOut,
    );
    Future.delayed(
      const Duration(milliseconds: 360),
      widget.onComplete,
    );
  }

  @override
  void dispose() {
    _mainController.dispose();
    _roadLoopController.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _handleTap,
        child: Stack(
          children: [
            // Layer 0 – Road background (parallax)
            _buildRoad(size),

            // Layer 1 – Truck (all phases)
            _buildTruck(size),

            // Layer 2 – Flash overlay
            AnimatedBuilder(
              animation: _flashOpacity,
              builder: (_, __) {
                if (_flashOpacity.value == 0) return const SizedBox.shrink();
                return Container(
                  color: Colors.white.withOpacity(_flashOpacity.value),
                );
              },
            ),

            // Layer 3 – Login card
            _buildLoginCard(),

            // Layer 4 – "Tap to skip" hint
            _buildSkipHint(),
          ],
        ),
      ),
    );
  }

  // ── Road ──────────────────────────────────────────────────────────────────
  Widget _buildRoad(Size size) {
    return AnimatedBuilder(
      animation:
          Listenable.merge([_roadLoopController, _bgDarken, _mainController]),
      builder: (_, __) => CustomPaint(
        painter: _RoadPainter(
          scrollT:   _roadLoopController.value,
          moving:    _mainController.value < 0.44,
          darkening: _bgDarken.value,
        ),
        size: Size.infinite,
      ),
    );
  }

  // ── Truck ─────────────────────────────────────────────────────────────────
  Widget _buildTruck(Size size) {
    return AnimatedBuilder(
      animation: _mainController,
      builder: (_, __) {
        final v = _mainController.value;

        // Phase 1: side-view sliding in from mid-left
        if (v <= 0.28) {
          final dx = size.width * 0.5 * _truckX.value;
          return Positioned(
            left: size.width * 0.5 + dx - 90,
            top:  size.height * 0.5 - 38,
            child: _TruckSideView(
              engineVibration:
                  math.sin(_roadLoopController.value * math.pi * 2) * 1.2,
            ),
          );
        }

        // Phase 2: turn morph (side → front)
        if (v <= 0.44) {
          final t      = _turnProgress.value;
          // Horizontal squish simulates the truck rotating toward us
          final scaleX = 1.0 - (t < 0.5 ? t : 1.0 - t) * 0.7;
          return Positioned(
            left: size.width * 0.5 - 50 + t * 20,
            top:  size.height * 0.5 - 50,
            child: Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()..scale(scaleX, 1.0),
              child: t < 0.5
                  ? _TruckSideView(engineVibration: 0)
                  : const _TruckFrontView(glowIntensity: 0.3),
            ),
          );
        }

        // Phase 3: front view rushes toward camera
        if (v <= 0.84) {
          return Center(
            child: Opacity(
              opacity: _approachOpacity.value.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: _approachScale.value,
                child: const _TruckFrontView(glowIntensity: 1.0),
              ),
            ),
          );
        }

        // After flash – truck gone
        return const SizedBox.shrink();
      },
    );
  }

  // ── Login card ────────────────────────────────────────────────────────────
  Widget _buildLoginCard() {
    return AnimatedBuilder(
      animation: Listenable.merge([_loginSlide, _loginOpacity]),
      builder: (_, __) {
        if (_loginOpacity.value == 0) return const SizedBox.shrink();
        return Positioned.fill(
          child: Opacity(
            opacity: _loginOpacity.value,
            child: Transform.translate(
              offset: Offset(0, _loginSlide.value),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Logo
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withOpacity(0.14),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(0xFFF59E0B).withOpacity(0.35),
                            width: 1.5,
                          ),
                        ),
                        child: const Icon(
                          Icons.local_shipping_rounded,
                          size: 48,
                          color: Color(0xFFF59E0B),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Company name
                      const Text(
                        'KAVYA TRANSPORTS',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2.4,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Subtitle (delayed fade)
                      _DelayedFade(
                        delay: const Duration(milliseconds: 200),
                        child: const Text(
                          'Employee Portal',
                          style: TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontSize: 13,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ),
                      const SizedBox(height: 40),

                      // Amber gradient divider
                      Container(
                        height: 1,
                        margin: const EdgeInsets.symmetric(horizontal: 32),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              const Color(0xFFF59E0B).withOpacity(0.4),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Ready indicator
                      _DelayedFade(
                        delay: const Duration(milliseconds: 350),
                        child: const Text(
                          'Ready to sign in',
                          style: TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 12,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ── Skip hint ─────────────────────────────────────────────────────────────
  Widget _buildSkipHint() {
    return Positioned(
      bottom: 40, left: 0, right: 0,
      child: AnimatedBuilder(
        animation: _mainController,
        builder: (_, __) => Opacity(
          opacity: (1.0 - _mainController.value * 2.0).clamp(0.0, 0.45),
          child: const Center(
            child: Text(
              'TAP TO SKIP',
              style: TextStyle(
                color: Colors.white,
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: FontWeight.w300,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRUCK : SIDE VIEW
// ─────────────────────────────────────────────────────────────────────────────
class _TruckSideView extends StatelessWidget {
  final double engineVibration;
  const _TruckSideView({this.engineVibration = 0});

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(0, engineVibration),
      child: SizedBox(
        width: 180,
        height: 76,
        child: CustomPaint(painter: _TruckSidePainter()),
      ),
    );
  }
}

class _TruckSidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width;
    final h = s.height;

    // Trailer
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(0, h * 0.18, w * 0.66, h * 0.54),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFF1E3A5F),
    );

    // Trailer highlight strip
    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.18, w * 0.66, h * 0.06),
      Paint()..color = const Color(0xFF2D5A8E).withOpacity(0.7),
    );

    // Branding
    final tp = TextPainter(
      text: const TextSpan(
        text: 'KAVYA',
        style: TextStyle(
          color: Color(0xFFF59E0B),
          fontSize: 9,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.5,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(w * 0.16, h * 0.32));

    // Cabin
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.63, h * 0.08, w * 0.29, h * 0.64),
        const Radius.circular(4),
      ),
      Paint()..color = const Color(0xFF243B55),
    );

    // Window
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.70, h * 0.12, w * 0.16, h * 0.24),
        const Radius.circular(2),
      ),
      Paint()..color = const Color(0xFF7DD3FC).withOpacity(0.55),
    );

    // Wheels
    for (final cx in [w * 0.18, w * 0.45, w * 0.73]) {
      canvas.drawCircle(Offset(cx, h * 0.82), h * 0.14,
          Paint()..color = const Color(0xFF111827));
      canvas.drawCircle(
        Offset(cx, h * 0.82), h * 0.07,
        Paint()
          ..color = const Color(0xFF6B7280)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }

    // Headlight glow
    canvas.drawCircle(
      Offset(w * 0.91, h * 0.38), h * 0.08,
      Paint()
        ..color = const Color(0xFFF59E0B).withOpacity(0.5)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
    canvas.drawCircle(Offset(w * 0.91, h * 0.38), h * 0.05,
        Paint()..color = const Color(0xFFF59E0B));
  }

  @override
  bool shouldRepaint(_TruckSidePainter _) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRUCK : FRONT VIEW
// ─────────────────────────────────────────────────────────────────────────────
class _TruckFrontView extends StatelessWidget {
  final double glowIntensity;
  const _TruckFrontView({required this.glowIntensity});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 100,
      height: 90,
      child: CustomPaint(painter: _TruckFrontPainter(glow: glowIntensity)),
    );
  }
}

class _TruckFrontPainter extends CustomPainter {
  final double glow;
  const _TruckFrontPainter({required this.glow});

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width;
    final h = s.height;

    // Cab body
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.08, h * 0.06, w * 0.84, h * 0.80),
        const Radius.circular(8),
      ),
      Paint()..color = const Color(0xFF1E3A5F),
    );

    // Roof fin
    final roofPath = Path()
      ..moveTo(w * 0.18, h * 0.06)
      ..lineTo(w * 0.82, h * 0.06)
      ..lineTo(w * 0.72, h * 0.0)
      ..lineTo(w * 0.28, h * 0.0)
      ..close();
    canvas.drawPath(roofPath, Paint()..color = const Color(0xFF243B55));

    // Windshield
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.18, h * 0.08, w * 0.64, h * 0.32),
        const Radius.circular(4),
      ),
      Paint()..color = const Color(0xFF7DD3FC).withOpacity(0.45),
    );

    // Grille bars
    final grillePaint = Paint()
      ..color = const Color(0xFF374151)
      ..strokeWidth = 2;
    for (int i = 0; i < 4; i++) {
      final y = h * 0.50 + i * (h * 0.07);
      canvas.drawLine(Offset(w * 0.14, y), Offset(w * 0.86, y), grillePaint);
    }
    canvas.drawLine(
        Offset(w * 0.50, h * 0.48), Offset(w * 0.50, h * 0.80), grillePaint);

    // Headlights
    for (final pos in [Offset(w * 0.24, h * 0.88), Offset(w * 0.76, h * 0.88)]) {
      if (glow > 0) {
        canvas.drawCircle(
          pos, h * 0.16,
          Paint()
            ..color = const Color(0xFFF59E0B).withOpacity(0.25 * glow)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, 12 * glow),
        );
      }
      canvas.drawCircle(pos, h * 0.09, Paint()..color = const Color(0xFFF59E0B));
      canvas.drawCircle(
        pos.translate(-h * 0.025, -h * 0.025), h * 0.025,
        Paint()..color = Colors.white.withOpacity(0.7),
      );
    }

    // Center badge
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.35, h * 0.82, w * 0.30, h * 0.12),
        const Radius.circular(2),
      ),
      Paint()..color = const Color(0xFFF59E0B),
    );
  }

  @override
  bool shouldRepaint(_TruckFrontPainter old) => old.glow != glow;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROAD BACKGROUND PAINTER
// ─────────────────────────────────────────────────────────────────────────────
class _RoadPainter extends CustomPainter {
  final double scrollT;
  final bool   moving;
  final double darkening;

  const _RoadPainter({
    required this.scrollT,
    required this.moving,
    required this.darkening,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Sky gradient
    final skyGrad = LinearGradient(
      begin: Alignment.topCenter,
      end:   Alignment.bottomCenter,
      colors: [
        Color.lerp(const Color(0xFF0B1120), const Color(0xFF060C18), darkening)!,
        Color.lerp(const Color(0xFF152035), const Color(0xFF0D1524), darkening)!,
      ],
    );
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..shader = skyGrad.createShader(Rect.fromLTWH(0, 0, w, h)),
    );

    // Road surface (bottom 40%)
    final roadTop = h * 0.60;
    canvas.drawRect(
      Rect.fromLTWH(0, roadTop, w, h - roadTop),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end:   Alignment.bottomCenter,
          colors: [Color(0xFF1A1A2E), Color(0xFF0F0F1A)],
        ).createShader(Rect.fromLTWH(0, roadTop, w, h - roadTop)),
    );

    // Horizon glow
    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.58, w, h * 0.04),
      Paint()
        ..color = const Color(0xFFF59E0B).withOpacity(0.12)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );

    // Scrolling dashed centre-line
    const dashLen = 28.0;
    const gapLen  = 18.0;
    const period  = dashLen + gapLen;
    final offset  = moving ? (scrollT * period) : 0.0;

    final dashPaint = Paint()
      ..color = const Color(0xFFF59E0B).withOpacity(0.55)
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    var x = -period + offset;
    while (x < w + period) {
      canvas.drawLine(
        Offset(x, h * 0.615),
        Offset(x + dashLen, h * 0.615),
        dashPaint,
      );
      x += period;
    }

    // Road edge lines
    final edgePaint = Paint()
      ..color = Colors.white.withOpacity(0.08)
      ..strokeWidth = 1.0;
    canvas.drawLine(Offset(0, h * 0.60), Offset(w, h * 0.60), edgePaint);
    canvas.drawLine(Offset(0, h * 0.96), Offset(w, h * 0.96), edgePaint);

    // Motion speed lines while driving
    if (moving) {
      final rng        = math.Random(42);
      final speedPaint = Paint()..strokeWidth = 1.0..strokeCap = StrokeCap.round;
      for (int i = 0; i < 18; i++) {
        final y  = roadTop + rng.nextDouble() * (h - roadTop) * 0.35;
        final xS = rng.nextDouble() * w;
        final len = 20.0 + rng.nextDouble() * 60;
        speedPaint.color = Colors.white.withOpacity(0.03 + rng.nextDouble() * 0.04);
        canvas.drawLine(Offset(xS, y), Offset(xS + len, y), speedPaint);
      }
    }

    // Stars
    final starPaint = Paint()
      ..color = Colors.white.withOpacity(0.45 - darkening * 0.3);
    final starRng = math.Random(7);
    for (int i = 0; i < 60; i++) {
      canvas.drawCircle(
        Offset(starRng.nextDouble() * w, starRng.nextDouble() * h * 0.55),
        starRng.nextDouble() * 1.2,
        starPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_RoadPainter old) =>
      old.scrollT != scrollT || old.moving != moving || old.darkening != darkening;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER : delayed fade-in widget
// ─────────────────────────────────────────────────────────────────────────────
class _DelayedFade extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const _DelayedFade({required this.child, required this.delay});

  @override
  State<_DelayedFade> createState() => _DelayedFadeState();
}

class _DelayedFadeState extends State<_DelayedFade>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double>   _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _opacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );
    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _opacity, child: widget.child);
  }
}