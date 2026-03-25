import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';

/// Full fuel dispensing log — filterable list of all issues.
class PumpFuelLogScreen extends ConsumerWidget {
  const PumpFuelLogScreen({super.key});

  static const _cardColor = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _red = Color(0xFFEF4444);
  static const _green = Color(0xFF10B981);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logAsync = ref.watch(todayFuelIssuesProvider);

    return logAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: _amber)),
      error: (e, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: _red, size: 48),
            const SizedBox(height: 12),
            const Text('Failed to load log', style: TextStyle(color: _textPrimary)),
            const SizedBox(height: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: _amber),
              onPressed: () => ref.invalidate(todayFuelIssuesProvider),
              child: const Text('Retry', style: TextStyle(color: Colors.black)),
            ),
          ],
        ),
      ),
      data: (issues) {
        if (issues.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.local_gas_station_outlined, color: _textSecondary.withValues(alpha: 0.5), size: 64),
                const SizedBox(height: 16),
                const Text(
                  'No fuel dispensed today',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _textPrimary),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Entries will appear here as fuel is issued',
                  style: TextStyle(fontSize: 13, color: _textSecondary),
                ),
              ],
            ),
          );
        }

        // Summary header
        final totalLitres = issues.fold<double>(0, (sum, i) => sum + i.quantityLitres);
        final totalAmount = issues.fold<double>(0, (sum, i) => sum + i.totalAmount);
        final flaggedCount = issues.where((i) => i.isFlagged).length;

        return RefreshIndicator(
          color: _amber,
          onRefresh: () async => ref.invalidate(todayFuelIssuesProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary bar
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _cardColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _summaryItem('Entries', '${issues.length}'),
                    _divider(),
                    _summaryItem('Total', '${totalLitres.toStringAsFixed(0)} L'),
                    _divider(),
                    _summaryItem('Amount', IndianFormat.currency(totalAmount)),
                    if (flaggedCount > 0) ...[
                      _divider(),
                      _summaryItem('Flagged', '$flaggedCount', color: _red),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Log entries
              ...issues.map((issue) => _logCard(issue)),
            ],
          ),
        );
      },
    );
  }

  Widget _summaryItem(String label, String value, {Color? color}) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: color ?? _amber,
            fontFamily: 'JetBrains Mono',
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: _textSecondary)),
      ],
    );
  }

  Widget _divider() {
    return Container(width: 1, height: 32, color: const Color(0xFFE8EEF4));
  }

  Widget _logCard(FuelIssue issue) {
    final matchColor = issue.isFlagged ? _red : _green;
    final matchLabel = issue.isFlagged ? 'MISMATCH' : 'Matched';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(10),
        border: issue.isFlagged
            ? Border.all(color: _red.withValues(alpha: 0.4))
            : null,
      ),
      child: Column(
        children: [
          // Top row: vehicle + time + status
          Row(
            children: [
              Expanded(
                child: Text(
                  issue.vehicleRegistration ?? 'Vehicle #${issue.vehicleId}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _textPrimary,
                  ),
                ),
              ),
              Text(
                IndianFormat.time(issue.issuedAt),
                style: const TextStyle(fontSize: 12, color: _textSecondary),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: matchColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  matchLabel,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: matchColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Detail row
          Row(
            children: [
              if (issue.driverName != null) ...[
                const Icon(Icons.person, size: 14, color: _textSecondary),
                const SizedBox(width: 4),
                Text(issue.driverName!, style: const TextStyle(fontSize: 12, color: _textSecondary)),
                const SizedBox(width: 16),
              ],
              const Icon(Icons.local_gas_station, size: 14, color: _amber),
              const SizedBox(width: 4),
              Text(
                '${issue.quantityLitres.toStringAsFixed(1)} L',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _amber,
                  fontFamily: 'JetBrains Mono',
                ),
              ),
              const SizedBox(width: 16),
              Text(
                IndianFormat.currency(issue.totalAmount),
                style: const TextStyle(fontSize: 12, color: _textSecondary),
              ),
            ],
          ),
          if (issue.isFlagged && issue.flagReason != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.warning, size: 14, color: _red),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    issue.flagReason!,
                    style: const TextStyle(fontSize: 11, color: _red),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
