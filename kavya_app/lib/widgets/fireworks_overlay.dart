import 'dart:math';
import 'package:flutter/material.dart';

/// Full-screen fireworks overlay shown when a trip is completed.
///
/// Rockets launch from the bottom of the screen and burst in the
/// centre area. Tap anywhere (or wait ~5 s) to dismiss.
class FireworksOverlay extends StatefulWidget {
  /// Called when the animation finishes or the user taps to skip.
  final VoidCallback onDone;

  const FireworksOverlay({super.key, required this.onDone});

  @override
  State<FireworksOverlay> createState() => _FireworksOverlayState();
}

class _FireworksOverlayState extends State<FireworksOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final AnimationController _fadeCtrl;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4800),
    )..forward().then((_) => _dismiss());

    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
  }

  void _dismiss() {
    if (_dismissed) return;
    _dismissed = true;
    if (!mounted) return;
    _ctrl.stop();
    _fadeCtrl.reverse().then((_) {
      if (mounted) widget.onDone();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return GestureDetector(
      onTap: _dismiss,
      behavior: HitTestBehavior.opaque,
      child: FadeTransition(
        opacity: _fadeCtrl,
        child: Material(
          type: MaterialType.transparency,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Dark backdrop
              Container(color: Colors.black.withOpacity(0.82)),
              // Fireworks canvas
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => CustomPaint(
                  painter: _FireworksPainter(_ctrl.value),
                  size: size,
                ),
              ),
              // Celebration text
              Positioned(
                left: 0,
                right: 0,
                top: size.height * 0.38,
                child: const _CelebrationText(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Celebration text ─────────────────────────────────────────────────────────

class _CelebrationText extends StatelessWidget {
  const _CelebrationText();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🎉', style: TextStyle(fontSize: 72)),
          const SizedBox(height: 14),
          const Text(
            'Trip Completed!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Great job! Delivery done.',
            style: TextStyle(
              fontSize: 15,
              color: Colors.white.withOpacity(0.75),
              fontWeight: FontWeight.w400,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          Text(
            'Tap anywhere to continue',
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withOpacity(0.40),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Rocket config ─────────────────────────────────────────────────────────────

class _RocketConfig {
  final double sx; // start x [0,1] relative to width
  final double bx; // burst x [0,1] relative to width
  final double by; // burst y [0,1] relative to height (0=top)
  final double t0; // animation fraction when this rocket launches
  final double tb; // animation fraction when this rocket bursts
  final List<Color> colors;

  const _RocketConfig({
    required this.sx,
    required this.bx,
    required this.by,
    required this.t0,
    required this.tb,
    required this.colors,
  });
}

// ─── Painter ──────────────────────────────────────────────────────────────────

class _FireworksPainter extends CustomPainter {
  final double t;

  static const _rockets = <_RocketConfig>[
    // Centre — amber/gold — first launch
    _RocketConfig(
      sx: 0.50, bx: 0.50, by: 0.28, t0: 0.00, tb: 0.22,
      colors: <Color>[Color(0xFFFBBF24), Color(0xFFF59E0B), Colors.white],
    ),
    // Left — red/orange/pink
    _RocketConfig(
      sx: 0.18, bx: 0.27, by: 0.25, t0: 0.18, tb: 0.38,
      colors: <Color>[Color(0xFFEF4444), Color(0xFFF97316), Color(0xFFEC4899)],
    ),
    // Right — green/teal
    _RocketConfig(
      sx: 0.82, bx: 0.73, by: 0.25, t0: 0.18, tb: 0.38,
      colors: <Color>[Color(0xFF10B981), Color(0xFF34D399), Colors.white],
    ),
    // Centre-left — blue/purple
    _RocketConfig(
      sx: 0.33, bx: 0.37, by: 0.20, t0: 0.38, tb: 0.56,
      colors: <Color>[Color(0xFF60A5FA), Color(0xFF38BDF8), Color(0xFF818CF8)],
    ),
    // Centre-right — purple/pink/amber
    _RocketConfig(
      sx: 0.67, bx: 0.63, by: 0.21, t0: 0.38, tb: 0.56,
      colors: <Color>[Color(0xFFA78BFA), Color(0xFFF472B6), Color(0xFFFBBF24)],
    ),
    // Grand finale — centre, highest burst
    _RocketConfig(
      sx: 0.50, bx: 0.50, by: 0.16, t0: 0.58, tb: 0.78,
      colors: <Color>[Colors.white, Color(0xFFFBBF24), Color(0xFF10B981)],
    ),
  ];

  const _FireworksPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    for (final r in _rockets) {
      _paintRocket(canvas, size, r);
    }
  }

  void _paintRocket(Canvas canvas, Size size, _RocketConfig cfg) {
    if (t < cfg.t0) return;

    final sx = cfg.sx * size.width;
    final sy = size.height; // launch from very bottom
    final bx = cfg.bx * size.width;
    final by = cfg.by * size.height;

    final ascDur = cfg.tb - cfg.t0;
    final phase1 = ((t - cfg.t0) / ascDur).clamp(0.0, 1.0);

    if (phase1 < 1.0) {
      // ── Phase 1: Ascending trail ──────────────────────────────────────────
      final ease = Curves.easeIn.transform(phase1);
      final cx = sx + (bx - sx) * ease;
      final cy = sy + (by - sy) * ease;

      // Draw trail (gradient from transparent → white)
      final trailFrac = (ease - 0.22).clamp(0.0, 1.0);
      final tsx = sx + (bx - sx) * trailFrac;
      final tsy = sy + (by - sy) * trailFrac;

      if ((cx - tsx).abs() > 1 || (cy - tsy).abs() > 1) {
        final trailPaint = Paint()
          ..shader = LinearGradient(
            colors: [Colors.transparent, Colors.white.withOpacity(0.85)],
          ).createShader(Rect.fromPoints(Offset(tsx, tsy), Offset(cx, cy)))
          ..strokeWidth = 2.5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(Offset(tsx, tsy), Offset(cx, cy), trailPaint);
      }

      // Rocket head — bright glow dot
      canvas.drawCircle(
        Offset(cx, cy),
        4.5,
        Paint()
          ..color = Colors.white.withOpacity(0.80)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      canvas.drawCircle(Offset(cx, cy), 2.2, Paint()..color = Colors.white);
    } else {
      // ── Phase 2: Burst particles ─────────────────────────────────────────
      final burstDur = 1.0 - cfg.tb;
      if (burstDur <= 0) return;

      final phase2 = ((t - cfg.tb) / burstDur).clamp(0.0, 1.0);
      final alpha = (1.0 - phase2 * phase2).clamp(0.0, 1.0);
      if (alpha <= 0) return;

      // Central flash at moment of burst
      if (phase2 < 0.18) {
        final flashA = ((0.18 - phase2) / 0.18) * 0.70;
        canvas.drawCircle(
          Offset(bx, by),
          12 + 55 * (phase2 / 0.18),
          Paint()
            ..color = Colors.white.withOpacity(flashA)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16),
        );
      }

      // Radial particles
      const count = 28;
      final spread = size.width * 0.40;

      for (int i = 0; i < count; i++) {
        final angle = (i / count) * 2 * pi + (i % 3 - 1) * 0.07;
        final speedMult = 0.70 + (i % 5) * 0.09;
        final dist = spread * speedMult * phase2;
        // Downward gravity effect
        final gravity = spread * 0.38 * phase2 * phase2;
        final px = bx + cos(angle) * dist;
        final py = by + sin(angle) * dist + gravity;

        final color = cfg.colors[i % cfg.colors.length].withOpacity(alpha);
        final radius = (3.5 * (1.0 - phase2 * 0.5)).clamp(1.5, 4.0);

        canvas.drawCircle(
          Offset(px, py),
          radius,
          Paint()
            ..color = color
            ..maskFilter = phase2 < 0.28
                ? const MaskFilter.blur(BlurStyle.normal, 2)
                : null,
        );
      }

      // Inner sparkle ring
      if (phase2 < 0.45) {
        const stars = 12;
        final starA = (1.0 - phase2 / 0.45).clamp(0.0, 1.0);
        for (int i = 0; i < stars; i++) {
          final a = (i / stars) * 2 * pi;
          final d = 28.0 * phase2 / 0.45;
          canvas.drawCircle(
            Offset(bx + cos(a) * d, by + sin(a) * d),
            1.5,
            Paint()..color = Colors.white.withOpacity(starA),
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(_FireworksPainter other) => other.t != t;
}
