import 'package:intl/intl.dart';

/// Indian number and currency formatting for Kavya Transports.
/// Uses lakh/crore grouping (₹1,00,000 not ₹100,000).
class IndianFormat {
  IndianFormat._();

  /// Full Indian currency: ₹1,84,000
  static String currency(num amount) {
    if (amount < 0) return '-${currency(-amount)}';
    final whole = amount.truncate();
    return '₹${_indianGrouping(whole)}';
  }

  /// Compact: ₹1.84L or ₹2.1Cr
  static String currencyCompact(num amount) {
    final abs = amount.abs();
    if (abs >= 10000000) {
      return '₹${(amount / 10000000).toStringAsFixed(2)}Cr';
    } else if (abs >= 100000) {
      return '₹${(amount / 100000).toStringAsFixed(2)}L';
    } else if (abs >= 1000) {
      return '₹${(amount / 1000).toStringAsFixed(1)}K';
    }
    return '₹${amount.toStringAsFixed(0)}';
  }

  /// Number with Indian grouping: 1,84,000
  static String number(num value) {
    return _indianGrouping(value.truncate());
  }

  /// Format litres: 245.50 L
  static String litres(num value) {
    return '${value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 2)} L';
  }

  /// Format km: 1,245 km
  static String km(num value) {
    return '${_indianGrouping(value.truncate())} km';
  }

  /// Format weight: 24.5 MT
  static String mt(num value) {
    return '${value.toStringAsFixed(1)} MT';
  }

  /// Date: 19 Mar 2026
  static String date(DateTime dt) {
    return DateFormat('dd MMM yyyy').format(dt);
  }

  /// Time: 2:30 PM
  static String time(DateTime dt) {
    return DateFormat('h:mm a').format(dt);
  }

  /// DateTime: 19 Mar 2026, 2:30 PM
  static String dateTime(DateTime dt) {
    return '${date(dt)}, ${time(dt)}';
  }

  /// Relative time: "2 min ago", "3 hrs ago", "Yesterday"
  static String relativeTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hrs ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return date(dt);
  }

  /// Percentage string
  static String percent(num value) {
    return '${value.toStringAsFixed(1)}%';
  }

  static String _indianGrouping(int value) {
    if (value < 0) return '-${_indianGrouping(-value)}';
    final str = value.toString();
    if (str.length <= 3) return str;

    final last3 = str.substring(str.length - 3);
    var rest = str.substring(0, str.length - 3);

    final groups = <String>[];
    while (rest.length > 2) {
      groups.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) groups.insert(0, rest);

    return '${groups.join(',')},$last3';
  }
}
