import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import '../../providers/intelligence_provider.dart';
import '../../utils/indian_format.dart';
import 'pump_shift_screen.dart';

/// Pump Operator dashboard — Today's summary, tank gauge, mismatch alerts.
/// UI: Dark slate, bold amber numbers, industrial high-contrast.
class PumpDashboardScreen extends ConsumerWidget {
  const PumpDashboardScreen({super.key});

  static const _cardColor = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _red = Color(0xFFEF4444);
  static const _green = Color(0xFF10B981);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(pumpDashboardProvider);

    final shiftAsync = ref.watch(activeShiftProvider);

    return dashAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: _amber)),
      error: (e, _) => _errorState(ref, e.toString()),
      data: (stats) => RefreshIndicator(
        color: _amber,
        onRefresh: () async {
          ref.invalidate(pumpDashboardProvider);
          ref.invalidate(recentEventsProvider);
          ref.invalidate(activeShiftProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ─── Shift Banner ───
            shiftAsync.maybeWhen(
              data: (shift) => GestureDetector(
                onTap: () => context.push('/pump/shift'),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: shift == null
                        ? const Color(0xFFFFE4E4)
                        : const Color(0xFFEAFAF1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: shift == null ? _red : _green,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        shift == null ? Icons.lock_open_outlined : Icons.lock_outlined,
                        color: shift == null ? _red : _green,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          shift == null
                              ? 'No active shift — Tap to open shift'
                              : 'Shift open since ${shift['started_at']?.toString().substring(11, 16) ?? '--:--'} — Tap to close',
                          style: TextStyle(
                            color: shift == null ? _red : _green,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: shift == null ? _red : _green, size: 18),
                    ],
                  ),
                ),
              ),
              orElse: () => const SizedBox.shrink(),
            ),
            // ─── Quick Actions ───
            Row(
              children: [
                Expanded(
                  child: _actionButton(
                    context: context,
                    icon: Icons.price_change_outlined,
                    label: 'Update Rate',
                    onTap: () => showModalBottomSheet(
                      context: context,
                      backgroundColor: Colors.transparent,
                      isScrollControlled: true,
                      builder: (_) => const _UpdateRateSheet(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _actionButton(
                    context: context,
                    icon: Icons.local_shipping_outlined,
                    label: 'Refill Tank',
                    onTap: () => context.push('/pump/refill'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _actionButton(
                    context: context,
                    icon: Icons.add_circle_outline,
                    label: 'Create Tank',
                    onTap: () => context.push('/pump/create-tank'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ─── KPI Row ───
            _sectionTitle('Today\'s Fuel Summary'),
            const SizedBox(height: 12),
            Row(
              children: [
                _kpiCard(
                  icon: Icons.local_gas_station,
                  label: 'Litres Dispensed',
                  value: IndianFormat.litres(stats.todayIssuedLitres),
                  color: _amber,
                ),
                const SizedBox(width: 12),
                _kpiCard(
                  icon: Icons.directions_car,
                  label: 'Vehicles Fuelled',
                  value: '${stats.todayIssuedCount}',
                  color: _green,
                ),
                const SizedBox(width: 12),
                _kpiCard(
                  icon: Icons.warning_amber_rounded,
                  label: 'Mismatch Alerts',
                  value: '${stats.openAlerts}',
                  color: stats.openAlerts > 0 ? _red : _green,
                ),
              ],
            ),
            const SizedBox(height: 28),

            // ─── Tank Level Gauges ───
            _sectionTitle('Tank Levels'),
            const SizedBox(height: 12),
            if (stats.tanks.isEmpty)
              _emptyCard('No fuel tanks configured')
            else
              ...stats.tanks.map(_tankGauge),

            const SizedBox(height: 28),

            // ─── Alerts ───
            _sectionTitle('Mismatch Alerts'),
            const SizedBox(height: 12),
            _alertsList(ref),

            const SizedBox(height: 28),

            // ─── Today's Log ───
            _sectionTitle('Today\'s Fuel Log'),
            const SizedBox(height: 12),
            _todayLog(ref),

            const SizedBox(height: 28),

            // ─── Fuel Intelligence ───
            _fuelIntelligenceSection(ref),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: _textPrimary,
        letterSpacing: 0.3,
      ),
    );
  }

  Widget _actionButton({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _amber.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: _amber, size: 26),
            const SizedBox(height: 6),
            Text(label,
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: _textPrimary)),
          ],
        ),
      ),
    );
  }

  Widget _kpiCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color,
                fontFamily: 'JetBrains Mono',
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: _textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tankGauge(FuelTank tank) {
    final pct = tank.stockPercent;
    final isLow = pct < 20;
    final barColor = isLow ? _red : (pct < 50 ? _amber : _green);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tank.name,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: _textPrimary,
                ),
              ),
              if (isLow)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning, color: _red, size: 14),
                      SizedBox(width: 4),
                      Text('LOW FUEL', style: TextStyle(color: _red, fontSize: 11, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          // Tank fill bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 24,
              backgroundColor: const Color(0xFFE8EEF4),
              color: barColor,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${tank.currentStockLitres.toStringAsFixed(0)} L',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: barColor,
                  fontFamily: 'JetBrains Mono',
                ),
              ),
              Text(
                '${pct.toStringAsFixed(1)}% of ${tank.capacityLitres.toStringAsFixed(0)} L',
                style: const TextStyle(fontSize: 13, color: _textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _alertsList(WidgetRef ref) {
    final alertsAsync = ref.watch(fuelAlertsProvider);
    return alertsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: _amber)),
      error: (e, _) => _emptyCard('Failed to load alerts'),
      data: (alerts) {
        if (alerts.isEmpty) {
          return _emptyCard('No mismatch alerts — all clear');
        }
        return Column(
          children: alerts.map((a) => _alertCard(a)).toList(),
        );
      },
    );
  }

  Widget _alertCard(FuelTheftAlert alert) {
    final isCritical = alert.severity == 'critical';
    final color = isCritical ? _red : _amber;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 10,
            height: 10,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${alert.vehicleRegistration ?? 'Vehicle #${alert.vehicleId}'} · ${alert.alertType.replaceAll('_', ' ').toUpperCase()}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  alert.description,
                  style: const TextStyle(fontSize: 12, color: _textSecondary),
                ),
                if (alert.createdAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      IndianFormat.relativeTime(alert.createdAt!),
                      style: const TextStyle(fontSize: 11, color: _textSecondary),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _todayLog(WidgetRef ref) {
    final logAsync = ref.watch(todayFuelIssuesProvider);
    return logAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: _amber)),
      error: (e, _) => _emptyCard('Failed to load today\'s log'),
      data: (issues) {
        if (issues.isEmpty) {
          return _emptyCard('No fuel dispensed today');
        }
        return Column(
          children: issues.map((i) => _logEntry(i)).toList(),
        );
      },
    );
  }

  Widget _logEntry(FuelIssue issue) {
    final matchColor = issue.isFlagged ? _red : _green;
    final matchLabel = issue.isFlagged ? 'MISMATCH' : 'Matched';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          // Vehicle & Driver
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  issue.vehicleRegistration ?? 'Vehicle #${issue.vehicleId}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _textPrimary,
                  ),
                ),
                if (issue.driverName != null)
                  Text(
                    issue.driverName!,
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
              ],
            ),
          ),
          // Litres
          Expanded(
            flex: 2,
            child: Text(
              '${issue.quantityLitres.toStringAsFixed(1)} L',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: _amber,
                fontFamily: 'JetBrains Mono',
              ),
            ),
          ),
          // Time
          Expanded(
            flex: 2,
            child: Text(
              IndianFormat.time(issue.issuedAt),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: _textSecondary),
            ),
          ),
          // Match status
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: matchColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              matchLabel,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: matchColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fuelIntelligenceSection(WidgetRef ref) {
    final eventsAsync = ref.watch(recentEventsProvider);
    return eventsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (events) {
        final fuelEvents = events
            .where((e) =>
                (e['event_type'] ?? '').toString().toLowerCase().contains('fuel') ||
                (e['event_type'] ?? '').toString().toLowerCase().contains('mismatch'))
            .toList();
        if (fuelEvents.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle('Fuel Intelligence'),
            const SizedBox(height: 12),
            ...fuelEvents.take(5).map((e) => _fuelIntelCard(e as Map<String, dynamic>)),
          ],
        );
      },
    );
  }

  Widget _fuelIntelCard(Map<String, dynamic> event) {
    final payload = event['payload'] as Map<String, dynamic>? ?? {};
    final severity = payload['severity']?.toString() ?? '';
    final isCritical = severity == 'critical';
    final color = isCritical ? _red : _amber;
    final description = payload['description'] ??
        payload['reason'] ??
        (event['event_type'] ?? '').toString().replaceAll('_', ' ');
    final entityId = event['entity_id']?.toString() ?? '';
    final time = event['triggered_at'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isCritical ? Icons.local_fire_department : Icons.analytics,
            color: color,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  description.toString(),
                  style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                if (entityId.isNotEmpty)
                  Text(
                    'Fuel Issue #$entityId',
                    style: const TextStyle(color: _textSecondary, fontSize: 11),
                  ),
                if (time != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      IndianFormat.relativeTime(DateTime.tryParse(time) ?? DateTime.now()),
                      style: const TextStyle(color: _textSecondary, fontSize: 10),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              isCritical ? 'CRITICAL' : 'ALERT',
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyCard(String message) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(fontSize: 13, color: _textSecondary),
        ),
      ),
    );
  }

  Widget _errorState(WidgetRef ref, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: _red, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Failed to load dashboard',
            style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(error, style: const TextStyle(color: _textSecondary, fontSize: 12)),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _amber),
            onPressed: () => ref.invalidate(pumpDashboardProvider),
            child: const Text('Retry', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Update Rate Bottom Sheet
// ---------------------------------------------------------------------------

class _UpdateRateSheet extends StatefulWidget {
  const _UpdateRateSheet();

  @override
  State<_UpdateRateSheet> createState() => _UpdateRateSheetState();
}

class _UpdateRateSheetState extends State<_UpdateRateSheet> {
  static const _bg = Color(0xFFF7F9FC);
  static const _card = Color(0xFFFFFFFF);
  static const _amber = Color(0xFFEA580C);
  static const _textPrimary = Color(0xFF0D1B2A);
  static const _textSecondary = Color(0xFF8494A4);

  final _rateCtrl = TextEditingController(text: '93.21');

  @override
  void dispose() {
    _rateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: _bg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EEF4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Update Fuel Rate',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _textPrimary)),
            const SizedBox(height: 4),
            const Text('Set the current rate per litre for new dispensing entries',
                style: TextStyle(fontSize: 13, color: _textSecondary)),
            const SizedBox(height: 20),
            TextFormField(
              controller: _rateCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
              autofocus: true,
              style: const TextStyle(color: _textPrimary, fontSize: 22, fontWeight: FontWeight.w700),
              decoration: InputDecoration(
                hintText: 'e.g. 97.50',
                hintStyle: const TextStyle(color: _textSecondary),
                prefixText: '₹ ',
                prefixStyle: const TextStyle(
                    color: _amber, fontWeight: FontWeight.w700, fontSize: 22),
                suffixText: '/L',
                suffixStyle: const TextStyle(color: _textSecondary, fontSize: 16),
                filled: true,
                fillColor: _card,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _amber, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  final rate = double.tryParse(_rateCtrl.text);
                  if (rate == null || rate <= 0) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Enter a valid rate'), backgroundColor: Color(0xFFEF4444)),
                    );
                    return;
                  }
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Rate updated to ₹${rate.toStringAsFixed(2)}/L'),
                      backgroundColor: const Color(0xFF10B981),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _amber,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                child: const Text('Save Rate'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
