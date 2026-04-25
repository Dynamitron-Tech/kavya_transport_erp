import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';

/// Pump History — browse past fuel-log entries by day (notification style).
class PumpHistoryScreen extends ConsumerWidget {
  const PumpHistoryScreen({super.key});

  static const _amber = Color(0xFFEA580C);
  static const _red = Color(0xFFEF4444);
  static const _green = Color(0xFF10B981);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);
  static const _cardColor = Color(0xFFFFFFFF);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(pumpHistoryDateProvider);
    final dateStr = _fmtDate(selectedDate);
    final issuesAsync = ref.watch(pumpFuelIssuesByDateProvider(dateStr));
    final statsAsync = ref.watch(pumpStatsByDateProvider(dateStr));

    return RefreshIndicator(
      color: _amber,
      onRefresh: () async {
        ref.invalidate(pumpFuelIssuesByDateProvider(dateStr));
        ref.invalidate(pumpStatsByDateProvider(dateStr));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // ─── Day timeline (30 days) ───
          _buildTimeline(ref, selectedDate),
          const SizedBox(height: 16),

          // ─── Day summary ───
          statsAsync.when(
            data: (s) => _daySummary(s, selectedDate),
            loading: () => _shimmer(64),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 16),

          // ─── Fuel entries as notification cards ───
          issuesAsync.when(
            data: (issues) {
              if (issues.isEmpty) {
                return _emptyState(selectedDate);
              }
              return Column(
                children: issues.map((i) => _notificationCard(i)).toList(),
              );
            },
            loading: () => Column(
              children: List.generate(4, (_) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _shimmer(72),
              )),
            ),
            error: (_, __) => _errorCard('Failed to load fuel entries'),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 30-day horizontal timeline
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildTimeline(WidgetRef ref, DateTime selected) {
    final today = DateTime.now();
    final days = List.generate(30, (i) => today.subtract(Duration(days: 29 - i)));

    return SizedBox(
      height: 68,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        reverse: true,
        itemCount: days.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final d = days[days.length - 1 - i]; // newest first when reversed
          final isSel = _fmtDate(d) == _fmtDate(selected);
          final isToday = _isToday(d);
          return GestureDetector(
            onTap: () => ref.read(pumpHistoryDateProvider.notifier).state = d,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 46,
              decoration: BoxDecoration(
                color: isSel ? _amber : _cardColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSel ? _amber : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_weekday(d),
                      style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: isSel ? Colors.white : _textSecondary)),
                  const SizedBox(height: 3),
                  Text('${d.day}',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: isSel ? Colors.white : _textPrimary)),
                  if (isToday)
                    Container(
                      margin: const EdgeInsets.only(top: 3),
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: isSel ? Colors.white : _amber,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Day Summary Banner
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _daySummary(Map<String, dynamic> s, DateTime date) {
    final litres = (s['total_litres'] as double?) ?? 0;
    final cost = (s['total_cost'] as double?) ?? 0;
    final count = (s['entry_count'] as int?) ?? 0;
    final flags = (s['mismatch_count'] as int?) ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          _summaryItem(IndianFormat.litres(litres), 'Litres', _amber),
          _divider(),
          _summaryItem('$count', 'Entries', _green),
          _divider(),
          _summaryItem(IndianFormat.currencyCompact(cost), 'Cost', const Color(0xFF3B82F6)),
          if (flags > 0) ...[
            _divider(),
            _summaryItem('$flags', 'Flags', _red),
          ],
        ],
      ),
    );
  }

  Widget _summaryItem(String value, String label, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: _textSecondary)),
        ],
      ),
    );
  }

  Widget _divider() => Container(
        width: 1,
        height: 30,
        color: const Color(0xFFE2E8F0),
      );

  // ═══════════════════════════════════════════════════════════════════════════
  // Notification-style issue card
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _notificationCard(FuelIssue issue) {
    final time = issue.issuedAt.toLocal();
    final timeStr =
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline dot + line
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: issue.isFlagged ? _red : _amber,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: (issue.isFlagged ? _red : _amber).withValues(alpha: 0.3),
                    width: 3,
                  ),
                ),
              ),
              Container(width: 2, height: 60, color: const Color(0xFFE2E8F0)),
            ],
          ),
          const SizedBox(width: 12),
          // Card
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _cardColor,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: issue.isFlagged
                      ? _red.withValues(alpha: 0.3)
                      : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          issue.vehicleRegistration ??
                              (issue.vehicleId != null ? 'Vehicle #${issue.vehicleId}' : 'Manual Entry'),
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _textPrimary),
                        ),
                      ),
                      Text(timeStr,
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _chip(
                        '${issue.quantityLitres.toStringAsFixed(1)} L',
                        _amber,
                      ),
                      const SizedBox(width: 6),
                      _chip(
                        IndianFormat.currency(issue.totalAmount),
                        const Color(0xFF3B82F6),
                      ),
                      if (issue.isFlagged) ...[
                        const SizedBox(width: 6),
                        _chip('FLAGGED', _red),
                      ],
                    ],
                  ),
                  if (issue.driverName != null) ...[
                    const SizedBox(height: 4),
                    Text('Driver: ${issue.driverName}',
                        style: const TextStyle(
                            fontSize: 11, color: _textSecondary)),
                  ],
                  if (issue.tankName != null) ...[
                    const SizedBox(height: 2),
                    Text('Tank: ${issue.tankName}',
                        style: const TextStyle(
                            fontSize: 11, color: _textSecondary)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty / Error states
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _emptyState(DateTime date) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          Icon(Icons.history_rounded,
              size: 48, color: _textSecondary.withValues(alpha: 0.4)),
          const SizedBox(height: 12),
          Text(
            _isToday(date)
                ? 'No fuel entries today yet'
                : 'No fuel entries on ${_displayDate(date)}',
            style: const TextStyle(fontSize: 14, color: _textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _errorCard(String msg) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _red.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(msg, style: const TextStyle(color: _red, fontSize: 13)),
      );

  Widget _shimmer(double h) => Container(
        height: h,
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(12),
        ),
      );

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════
  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  String _displayDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
  bool _isToday(DateTime d) {
    final n = DateTime.now();
    return d.year == n.year && d.month == n.month && d.day == n.day;
  }

  String _weekday(DateTime d) =>
      const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.weekday - 1];
}
