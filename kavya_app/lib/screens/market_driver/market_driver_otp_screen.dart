import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

// ═══════════════════════════════════════════════════════════════════
//  MARKET DRIVER OTP SCREEN
//  Two-step: phone entry → OTP entry → JWT issued → trips screen.
// ═══════════════════════════════════════════════════════════════════

class MarketDriverOtpScreen extends ConsumerStatefulWidget {
  const MarketDriverOtpScreen({super.key});

  @override
  ConsumerState<MarketDriverOtpScreen> createState() =>
      _MarketDriverOtpScreenState();
}

class _MarketDriverOtpScreenState extends ConsumerState<MarketDriverOtpScreen> {
  // Steps: 0 = phone entry, 1 = OTP entry
  int _step = 0;

  final _phoneCtrl = TextEditingController();
  final _otpCtrl   = TextEditingController();
  final List<TextEditingController> _otpBoxCtrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes =
      List.generate(6, (_) => FocusNode());

  bool _loading = false;
  String? _error;

  // Returned by send-otp endpoint
  String _sessionId   = '';
  String _msg91Token  = '';
  String _phoneMasked = '';

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    for (final c in _otpBoxCtrls) c.dispose();
    for (final f in _otpFocusNodes) f.dispose();
    super.dispose();
  }

  // ── SEND OTP ──────────────────────────────────────────────────────

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.length != 10 || !RegExp(r'^\d{10}$').hasMatch(phone)) {
      setState(() => _error = 'Enter a valid 10-digit phone number');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final api = ApiService();
      final resp = await api.post('/auth/market-driver/send-otp', data: {'phone': phone});
      final data = (resp['data'] ?? resp) as Map<String, dynamic>;
      _sessionId   = data['session_id']  as String;
      _msg91Token  = data['msg91_token'] as String;
      _phoneMasked = data['phone_masked'] as String? ?? phone;
      setState(() { _step = 1; _loading = false; });
      // Auto-focus first OTP box
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocusNodes[0].requestFocus();
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = _extractError(e);
      });
    }
  }

  // ── VERIFY OTP ───────────────────────────────────────────────────

  Future<void> _verifyOtp() async {
    final otp = _otpBoxCtrls.map((c) => c.text).join();
    if (otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authProvider.notifier).loginMarketDriver(
        sessionId:   _sessionId,
        accessToken: _msg91Token,
        otpCode:     otp,
      );
      // On success auth_service navigates to /market-driver/trips
    } catch (e) {
      setState(() {
        _loading = false;
        _error = _extractError(e);
      });
    }
  }

  // ── RESEND OTP ───────────────────────────────────────────────────

  Future<void> _resendOtp() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ApiService();
      final resp = await api.post('/auth/market-driver/resend-otp', data: {
        'session_id': _sessionId,
      });
      final data = (resp['data'] ?? resp) as Map<String, dynamic>;
      _sessionId  = data['session_id']  as String;
      _msg91Token = data['msg91_token'] as String;
      for (final c in _otpBoxCtrls) c.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocusNodes[0].requestFocus();
      });
      setState(() { _loading = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('OTP resent'), backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      setState(() { _loading = false; _error = _extractError(e); });
    }
  }

  String _extractError(Object e) {
    final s = e.toString();
    // DioException wraps backend detail
    final m = RegExp(r'"detail":"([^"]+)"').firstMatch(s);
    return m != null ? m.group(1)! : 'Something went wrong. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050D1F),
      body: Stack(
        children: [
          // Gradient background
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFF050D1F), Color(0xFF0A1535), Color(0xFF071030)],
                  stops: [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                22, 20, 22, MediaQuery.of(context).viewInsets.bottom + 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Back button
                  GestureDetector(
                    onTap: () {
                      if (_step == 1) {
                        setState(() { _step = 0; _error = null; });
                      } else {
                        context.go('/login');
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      child: const Icon(Icons.arrow_back_rounded, color: Colors.white70, size: 20),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Heading
                  ShaderMask(
                    shaderCallback: (r) => const LinearGradient(
                      colors: [Colors.white, Color(0xFF93C5FD)],
                    ).createShader(r),
                    child: Text(
                      _step == 0 ? 'Hired Driver Login' : 'Enter OTP',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _step == 0
                        ? 'Enter your registered mobile number to receive an OTP'
                        : 'We sent a 6-digit OTP to $_phoneMasked',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.45),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Card
                  ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.white.withValues(alpha: 0.10),
                              Colors.white.withValues(alpha: 0.04),
                              Colors.white.withValues(alpha: 0.08),
                            ],
                          ),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.13),
                          ),
                        ),
                        child: _step == 0 ? _buildPhoneStep() : _buildOtpStep(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── STEP 0: PHONE ENTRY ──────────────────────────────────────────

  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label('Mobile Number'),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.13)),
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text(
                  '+91',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(width: 1, height: 24, color: Colors.white.withValues(alpha: 0.12)),
              Expanded(
                child: TextField(
                  controller: _phoneCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: InputDecoration(
                    hintText: '10-digit number',
                    hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25)),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  ),
                  onSubmitted: (_) => _sendOtp(),
                ),
              ),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          _errorText(_error!),
        ],
        const SizedBox(height: 24),
        _primaryButton(
          label: 'Send OTP',
          icon: Icons.send_rounded,
          onTap: _loading ? null : _sendOtp,
          loading: _loading,
        ),
      ],
    );
  }

  // ── STEP 1: OTP ENTRY ───────────────────────────────────────────

  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label('6-Digit OTP'),
        const SizedBox(height: 14),
        // OTP boxes
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (i) => _otpBox(i)),
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          _errorText(_error!),
        ],
        const SizedBox(height: 24),
        _primaryButton(
          label: 'Verify & Login',
          icon: Icons.verified_user_outlined,
          onTap: _loading ? null : _verifyOtp,
          loading: _loading,
        ),
        const SizedBox(height: 14),
        Center(
          child: GestureDetector(
            onTap: _loading ? null : _resendOtp,
            child: Text(
              'Resend OTP',
              style: TextStyle(
                color: const Color(0xFF60A5FA).withValues(alpha: _loading ? 0.4 : 1.0),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _otpBox(int index) {
    return SizedBox(
      width: 44,
      height: 52,
      child: TextField(
        controller: _otpBoxCtrls[index],
        focusNode: _otpFocusNodes[index],
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(1),
        ],
        style: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ).toInputDecoration(),
        onChanged: (val) {
          if (val.length == 1 && index < 5) {
            _otpFocusNodes[index + 1].requestFocus();
          } else if (val.isEmpty && index > 0) {
            _otpFocusNodes[index - 1].requestFocus();
          }
          // Auto-submit when all 6 filled
          final full = _otpBoxCtrls.every((c) => c.text.isNotEmpty);
          if (full) _verifyOtp();
        },
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.5),
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
        ),
      );

  Widget _errorText(String text) => Text(
        text,
        style: const TextStyle(color: KTColors.danger, fontSize: 12),
      );

  Widget _primaryButton({
    required String label,
    required IconData icon,
    required VoidCallback? onTap,
    bool loading = false,
  }) {
    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF60A5FA), Color(0xFF2563EB)],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.4),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2.5),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

// Helper to turn BoxDecoration into InputDecoration
extension _BoxToInput on BoxDecoration {
  InputDecoration toInputDecoration() => InputDecoration(
        border: OutlineInputBorder(
          borderRadius: borderRadius as BorderRadius? ??
              BorderRadius.circular(0),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: borderRadius as BorderRadius? ??
              BorderRadius.circular(0),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: borderRadius as BorderRadius? ??
              BorderRadius.circular(0),
          borderSide: const BorderSide(color: Color(0xFF60A5FA), width: 1.5),
        ),
        filled: true,
        fillColor: color ?? Colors.transparent,
        contentPadding: EdgeInsets.zero,
      );
}
