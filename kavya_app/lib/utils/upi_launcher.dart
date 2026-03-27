// UPI deep-link launcher utility
// Transport ERP Flutter App
//
// IMPORTANT: This class only LAUNCHES the UPI app.
// It does NOT confirm payment. The caller MUST always show a
// confirmation dialog after launch() returns.

import 'package:url_launcher/url_launcher.dart';

enum UpiApp { gpay, phonepe, paytm, bhim, any }

class UpiLaunchResult {
  final bool launched;
  final UpiApp app;
  const UpiLaunchResult({required this.launched, required this.app});
}

class UpiAppNotFoundException implements Exception {
  final String message;
  const UpiAppNotFoundException(this.message);
  @override
  String toString() => 'UpiAppNotFoundException: $message';
}

class UpiLauncher {
  // Package IDs — must match <queries> entries in AndroidManifest.xml
  static const _pkgGpay = 'com.google.android.apps.nbu.paisa.user';
  static const _pkgPhonepe = 'com.phonepe.app';
  static const _pkgPaytm = 'net.one97.paytm';
  static const _pkgBhim = 'in.org.npci.upiapp';

  static String _buildUpiParams({
    required String upiId,
    required String payeeName,
    required double amount,
    required String transactionNote,
  }) {
    // Percent-encode pn and tn to handle spaces and special chars
    final pa = Uri.encodeComponent(upiId);
    final pn = Uri.encodeComponent(payeeName);
    final am = amount.toStringAsFixed(2);
    final tn = Uri.encodeComponent(transactionNote);
    return 'pa=$pa&pn=$pn&am=$am&tn=$tn&cu=INR';
  }

  static Uri _intentUri({
    required String params,
    required String package,
  }) {
    // Android intent:// URI targeting a specific UPI app
    return Uri.parse(
      'intent://pay?$params#Intent;scheme=upi;package=$package;end',
    );
  }

  static Uri _genericUri(String params) =>
      Uri.parse('upi://pay?$params');

  /// Launches the selected UPI app with the payment details.
  ///
  /// Throws [UpiAppNotFoundException] if the specific app is not installed
  /// and cannot fall back (caller should retry with [UpiApp.any]).
  static Future<UpiLaunchResult> launch({
    required String upiId,
    required String payeeName,
    required double amount,
    required String transactionNote,
    required UpiApp app,
  }) async {
    final params = _buildUpiParams(
      upiId: upiId,
      payeeName: payeeName,
      amount: amount,
      transactionNote: transactionNote,
    );

    final Uri uri;
    switch (app) {
      case UpiApp.gpay:
        uri = _intentUri(params: params, package: _pkgGpay);
      case UpiApp.phonepe:
        uri = _intentUri(params: params, package: _pkgPhonepe);
      case UpiApp.paytm:
        uri = _intentUri(params: params, package: _pkgPaytm);
      case UpiApp.bhim:
        uri = _intentUri(params: params, package: _pkgBhim);
      case UpiApp.any:
        uri = _genericUri(params);
    }

    final canLaunch = await canLaunchUrl(uri);
    if (!canLaunch) {
      throw UpiAppNotFoundException(
        app == UpiApp.any
            ? 'No UPI app found on this device.'
            : '${app.name} is not installed.',
      );
    }

    await launchUrl(uri, mode: LaunchMode.externalApplication);
    return UpiLaunchResult(launched: true, app: app);
  }

  /// Returns the user-visible display name for each app.
  static String appDisplayName(UpiApp app) {
    switch (app) {
      case UpiApp.gpay:
        return 'GPay';
      case UpiApp.phonepe:
        return 'PhonePe';
      case UpiApp.paytm:
        return 'Paytm';
      case UpiApp.bhim:
        return 'BHIM';
      case UpiApp.any:
        return 'Any App';
    }
  }
}
