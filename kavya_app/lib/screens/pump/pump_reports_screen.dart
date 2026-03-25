import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../utils/indian_format.dart';

/// Pump Operator — Reports screen (4th tab).
/// Shows today/month summary, top vehicles bar chart, recent log table.
class PumpReportsScreen extends ConsumerWidget {
  const PumpReportsScreen({super.key});

  static const _amber = Color(0xFFEA580C);
  static const _cardColor = Color(0xFFFFFFFF);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);
  static const _green = Color(0xFF10B981);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(pumpDashboardProvider);
    final issuesAsync = ref.watch(todayFuelIssuesProvider);

    return RefreshIndicator(
      color: _amber,
      onRefresh: () async {
        ref.invalidate(pumpDashboardProvider);
        ref.invalidate(todayFuelIssuesProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Fuel Reports',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary)),
              issuesAsync.when(
                data: (issues) => _shareButton(context, issues),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Monthly Summary from dashboard
          dashAsync.when(
            loading: () => const LinearProgressIndicator(color: _amber),
            error: (_, __) => const SizedBox.shrink(),
            data: (stats) => _monthlySummary(stats),
          ),
          const SizedBox(height: 24),

          // Top Vehicles chart (today's issues)
          issuesAsync.when(
            loading: () => const LinearProgressIndicator(color: _amber),
            error: (e, _) => Text('Failed to load issues: $e',
                style: const TextStyle(color: Colors.red)),
            data: (issues) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _vehicleChart(issues),
                const SizedBox(height: 24),
                _recentLog(issues),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _shareButton(BuildContext context, List<dynamic> issues) {
    return IconButton(
      onPressed: () {
        final lines = issues.map((i) {
          final date = DateTime.tryParse(i['issued_at']?.toString() ?? '')
              ?.toLocal()
              .toString()
              .substring(0, 16) ?? '';
          return '${i['vehicle_registration'] ?? i['vehicle_id']}  ${i['quantity_litres']}L  ₹${i['total_amount']}  $date';
        }).join('\n');
        SharePlus.instance.share(ShareParams(text: 'Kavya Transport — Today\'s Fuel Log\n\n$lines'));
      },
      icon: const Icon(Icons.share, color: _amber),
      tooltip: 'Share report',
    );
  }

  Widget _monthlySummary(dynamic stats) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('This Month'),
        const SizedBox(height: 12),
        Row(
          children: [
            _summaryCard(
              icon: Icons.local_gas_station,
              label: 'Issued (L)',
              value: IndianFormat.litres(stats.monthIssuedLitres),
              color: _amber,
            ),
            const SizedBox(width: 12),
            _summaryCard(
              icon: Icons.currency_rupee,
              label: 'Cost',
              value: IndianFormat.currency(stats.monthCost),
              color: _green,
            ),
            const SizedBox(width: 12),
            _summaryCard(
              icon: Icons.inventory_2_outlined,
              label: 'Stock (L)',
              value: IndianFormat.litres(stats.totalStockLitres),
              color: const Color(0xFF60A5FA),
            ),
          ],
        ),
      ],
    );
  }

  Widget _summaryCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: color,
                    fontFamily: 'JetBrains Mono'),
                textAlign: TextAlign.center),
            const SizedBox(height: 2),
            Text(label,
                style:
                    const TextStyle(fontSize: 10, color: _textSecondary),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _vehicleChart(List<dynamic> issues) {
    // Aggregate by vehicle
    final map = <String, double>{};
    for (final i in issues) {
      final key = i['vehicle_registration']?.toString() ?? 'V#${i['vehicle_id']}';
      map[key] = (map[key] ?? 0) + (double.tryParse(i['quantity_litres']?.toString() ?? '0') ?? 0);
    }
    if (map.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text('No fuel issues recorded today',
              style: TextStyle(color: _textSecondary, fontSize: 13)),
        ),
      );
    }

    final sorted = map.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = sorted.take(6).toList();
    final maxVal = top.first.value;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Today — Top Vehicles (L)'),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _cardColor,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: top.map((entry) {
              final pct = maxVal > 0 ? entry.value / maxVal : 0.0;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Text(entry.key,
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: _textPrimary,
                                  fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis),
                        ),
                        Text('${entry.value.toStringAsFixed(1)} L',
                            style: const TextStyle(
                                fontSize: 12,
                                color: _amber,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct,
                        minHeight: 8,
                        backgroundColor: const Color(0xFFE8EEF4),
                        valueColor: const AlwaysStoppedAnimation<Color>(_amber),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _recentLog(List<dynamic> issues) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("Today's Full Log (${issues.length} entries)"),
        const SizedBox(height: 12),
        if (issues.isEmpty)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
                color: _cardColor, borderRadius: BorderRadius.circular(12)),
            child: const Center(
              child: Text('No entries today',
                  style: TextStyle(color: _textSecondary, fontSize: 13)),
            ),
          )
        else
          ...issues.map((i) => _logRow(i)),
      ],
    );
  }

  Widget _logRow(dynamic issue) {
    final timeStr = () {
      final dt = DateTime.tryParse(issue['issued_at']?.toString() ?? '');
      if (dt == null) return '';
      final local = dt.toLocal();
      return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    }();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.local_gas_station, color: _amber, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  issue['vehicle_registration']?.toString() ??
                      'Vehicle #${issue['vehicle_id']}',
                  style: const TextStyle(
                      color: _textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w700),
                ),
                if (issue['driver_name'] != null)
                  Text(issue['driver_name'].toString(),
                      style: const TextStyle(
                          color: _textSecondary, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${double.tryParse(issue['quantity_litres']?.toString() ?? '0')?.toStringAsFixed(1) ?? '—'} L',
                style: const TextStyle(
                    color: _amber,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'JetBrains Mono'),
              ),
              Text(timeStr,
                  style: const TextStyle(color: _textSecondary, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: _textPrimary,
        letterSpacing: 0.3,
      ),
    );
  }
}
