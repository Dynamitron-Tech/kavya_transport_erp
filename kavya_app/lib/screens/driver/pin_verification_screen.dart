import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A professional in-app PIN verification screen.
/// Shows a 6-digit PIN pad matching the app's dark-blue theme.
/// Returns `true` via Navigator.pop when PIN is verified, `false`/null on cancel.
class PinVerificationScreen extends StatefulWidget {
  final String title;
  final String subtitle;
  final Future<bool> Function(String pin) onVerify;

  const PinVerificationScreen({
    super.key,
    this.title = 'Security Verification',
    this.subtitle = 'Enter your 6-digit security PIN',
    required this.onVerify,
  });

  @override
  State<PinVerificationScreen> createState() => _PinVerificationScreenState();
}

class _PinVerificationScreenState extends State<PinVerificationScreen>
    with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _verifying = false;
  String? _error;
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  static const int _pinLength = 6;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = Tween<double>(begin: 0, end: 12).animate(
      CurvedAnimation(parent: _shakeController, curve: Curves.elasticIn),
    );
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  void _onDigit(String digit) {
    if (_pin.length >= _pinLength || _verifying) return;
    HapticFeedback.lightImpact();
    setState(() {
      _pin += digit;
      _error = null;
    });
    if (_pin.length == _pinLength) {
      _verify();
    }
  }

  void _onBackspace() {
    if (_pin.isEmpty || _verifying) return;
    HapticFeedback.lightImpact();
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = null;
    });
  }

  Future<void> _verify() async {
    setState(() => _verifying = true);
    try {
      final ok = await widget.onVerify(_pin);
      if (ok) {
        if (mounted) Navigator.of(context).pop(true);
      } else {
        _showError('Incorrect PIN. Try again.');
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  void _showError(String msg) {
    setState(() {
      _error = msg;
      _pin = '';
    });
    _shakeController.forward(from: 0);
    HapticFeedback.heavyImpact();
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF0F1B2D);
    const cardColor = Color(0xFF172A45);
    const accentColor = Color(0xFFE8A838);
    const textColor = Colors.white;
    const mutedColor = Color(0xFF8899AA);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: textColor),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            // Lock icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withValues(alpha: 0.15),
              ),
              child: const Icon(Icons.lock_outline, color: accentColor, size: 36),
            ),
            const SizedBox(height: 20),
            Text(
              widget.title,
              style: const TextStyle(
                color: textColor,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              widget.subtitle,
              style: const TextStyle(color: mutedColor, fontSize: 14),
            ),
            const SizedBox(height: 32),
            // PIN dots
            AnimatedBuilder(
              animation: _shakeAnimation,
              builder: (context, child) {
                return Transform.translate(
                  offset: Offset(
                    _shakeController.isAnimating
                        ? _shakeAnimation.value *
                            ((_shakeController.value * 10).toInt().isEven ? 1 : -1)
                        : 0,
                    0,
                  ),
                  child: child,
                );
              },
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_pinLength, (i) {
                  final filled = i < _pin.length;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: filled ? accentColor : Colors.transparent,
                      border: Border.all(
                        color: _error != null
                            ? Colors.redAccent
                            : filled
                                ? accentColor
                                : mutedColor,
                        width: 2,
                      ),
                    ),
                  );
                }),
              ),
            ),
            if (_verifying) ...[
              const SizedBox(height: 16),
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: accentColor),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ],
            const Spacer(),
            // Numpad
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Column(
                children: [
                  _buildRow(['1', '2', '3'], cardColor, textColor),
                  const SizedBox(height: 12),
                  _buildRow(['4', '5', '6'], cardColor, textColor),
                  const SizedBox(height: 12),
                  _buildRow(['7', '8', '9'], cardColor, textColor),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _buildKey('', cardColor, textColor, empty: true),
                      const SizedBox(width: 16),
                      _buildKey('0', cardColor, textColor),
                      const SizedBox(width: 16),
                      _buildBackspace(cardColor),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: mutedColor, fontSize: 15),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(List<String> digits, Color bg, Color textColor) {
    return Row(
      children: digits.map((d) {
        final idx = digits.indexOf(d);
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              left: idx == 0 ? 0 : 8,
              right: idx == 2 ? 0 : 8,
            ),
            child: _buildKey(d, bg, textColor),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildKey(String digit, Color bg, Color textColor, {bool empty = false}) {
    if (empty) return const SizedBox(height: 64);
    return SizedBox(
      height: 64,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _onDigit(digit),
          child: Center(
            child: Text(
              digit,
              style: TextStyle(
                color: textColor,
                fontSize: 26,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBackspace(Color bg) {
    return Expanded(
      child: SizedBox(
        height: 64,
        child: Material(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: _onBackspace,
            onLongPress: () {
              HapticFeedback.lightImpact();
              setState(() {
                _pin = '';
                _error = null;
              });
            },
            child: const Center(
              child: Icon(Icons.backspace_outlined, color: Color(0xFF8899AA), size: 24),
            ),
          ),
        ),
      ),
    );
  }
}
