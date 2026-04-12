import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ---------------------------------------------------------------------------
// Providers — vehicle-based, NOT trip-based
// ---------------------------------------------------------------------------

final _myVehicleProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/drivers/me/fuel-vehicle') as Map<String, dynamic>;
  return res['data'] as Map<String, dynamic>?;
});

final _fuelLogsProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, vehicleId) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/drivers/me/fuel-logs?vehicle_id=$vehicleId')
      as Map<String, dynamic>;
  final data = res['data'] as Map<String, dynamic>?;
  return data ?? {'items': <dynamic>[], 'summary': null};
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class DriverFuelEntryScreen extends ConsumerWidget {
  const DriverFuelEntryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleAsync = ref.watch(_myVehicleProvider);
    final vehicle = vehicleAsync.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: KTColors.driverAccent,
        foregroundColor: KTColors.white,
        title: const Text('Fuel Entry'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(_myVehicleProvider);
              if (vehicle != null) {
                ref.invalidate(_fuelLogsProvider(vehicle['id'] as int));
              }
            },
          ),
        ],
      ),
      floatingActionButton: vehicle == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openSheet(context, ref, vehicle),
              backgroundColor: KTColors.driverAccent,
              icon: const Icon(Icons.local_gas_station, color: Colors.white),
              label: const Text('Log Fill-Up',
                  style: TextStyle(color: Colors.white)),
            ),
      body: vehicleAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          onRetry: () => ref.invalidate(_myVehicleProvider),
        ),
        data: (v) {
          if (v == null) return const _NoVehicleState();
          return _VehicleBody(
            vehicle: v,
            onRefresh: () =>
                ref.invalidate(_fuelLogsProvider(v['id'] as int)),
          );
        },
      ),
    );
  }

  void _openSheet(
      BuildContext context, WidgetRef ref, Map<String, dynamic> vehicle) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FuelLogSheet(
        vehicle: vehicle,
        onAdded: () =>
            ref.invalidate(_fuelLogsProvider(vehicle['id'] as int)),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Vehicle body
// ---------------------------------------------------------------------------

class _VehicleBody extends ConsumerWidget {
  final Map<String, dynamic> vehicle;
  final VoidCallback onRefresh;

  const _VehicleBody({required this.vehicle, required this.onRefresh});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleId = vehicle['id'] as int;
    final logsAsync = ref.watch(_fuelLogsProvider(vehicleId));

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _VehicleCard(vehicle: vehicle)),
          logsAsync.when(
            loading: () => const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: _ErrorState(onRetry: onRefresh),
              ),
            ),
            data: (data) {
              final items = (data['items'] as List? ?? [])
                  .cast<Map<String, dynamic>>();
              final summary = data['summary'] as Map<String, dynamic>?;
              if (items.isEmpty) {
                return SliverToBoxAdapter(child: _EmptyLogs());
              }
              return SliverMainAxisGroup(slivers: [
                if (summary != null)
                  SliverToBoxAdapter(
                      child: _SummaryStrip(summary: summary)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _FuelLogCard(log: items[i]),
                  ),
                ),
              ]);
            },
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Vehicle info card
// ---------------------------------------------------------------------------

class _VehicleCard extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _VehicleCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final reg = vehicle['registration_number'] as String? ?? '-';
    final make = vehicle['make'] as String? ?? '';
    final model = vehicle['model'] as String? ?? '';
    final tankCap = vehicle['fuel_tank_capacity'];
    final mileage = vehicle['mileage_per_litre'];
    final fuelType =
        (vehicle['fuel_type'] as String? ?? 'diesel').toUpperCase();

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KTColors.driverAccent,
            KTColors.driverAccent.withOpacity(0.82),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: KTColors.driverAccent.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_shipping,
                  color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(reg,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(fuelType,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('$make $model'.trim(),
              style: TextStyle(
                  color: Colors.white.withOpacity(0.85), fontSize: 13)),
          const SizedBox(height: 14),
          Row(
            children: [
              _InfoPill(
                  icon: Icons.water_drop_outlined,
                  label:
                      tankCap != null ? 'Tank: ${tankCap}L' : 'Tank: N/A'),
              const SizedBox(width: 10),
              _InfoPill(
                  icon: Icons.speed_outlined,
                  label: mileage != null
                      ? 'Target: $mileage km/L'
                      : 'Target: N/A'),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoPill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 13),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

class _SummaryStrip extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryStrip({required this.summary});

  @override
  Widget build(BuildContext context) {
    final avgNum = (summary['avg_km_per_litre'] as num?)?.toDouble();
    final avg = avgNum?.toStringAsFixed(2);
    final total = summary['total_fills'] as int? ?? 0;

    String behaviourLabel;
    Color behaviourColor;
    if (avgNum == null || total == 0) {
      behaviourLabel = 'N/A';
      behaviourColor = const Color(0xFF94A3B8);
    } else if (avgNum >= 6.0) {
      behaviourLabel = 'Good';
      behaviourColor = const Color(0xFF16A34A);
    } else if (avgNum >= 4.5) {
      behaviourLabel = 'Average';
      behaviourColor = const Color(0xFFD97706);
    } else {
      behaviourLabel = 'Bad';
      behaviourColor = const Color(0xFFDC2626);
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.border),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 6,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Avg Mileage',
                  style: TextStyle(
                      fontSize: 11, color: KTColors.textSecondary)),
              Text(avg != null ? '$avg km/L' : 'N/A',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: KTColors.driverAccent)),
              Text('$total fill-ups tracked',
                  style: TextStyle(
                      fontSize: 11, color: KTColors.textSecondary)),
            ],
          ),
          const Spacer(),
          _DrivingBehaviourBadge(
              label: behaviourLabel, color: behaviourColor),
        ],
      ),
    );
  }
}

class _DrivingBehaviourBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _DrivingBehaviourBadge(
      {required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Driving Behaviour',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: color)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Fill-up log card
// ---------------------------------------------------------------------------

class _FuelLogCard extends StatelessWidget {
  final Map<String, dynamic> log;
  const _FuelLogCard({required this.log});

  @override
  Widget build(BuildContext context) {
    final rawDate = log['fill_date'] as String? ?? '';
    final dateStr =
        rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    final litres =
        (log['litres_filled'] as num?)?.toStringAsFixed(1) ?? '-';
    final odo = log['odometer_km'];
    final kml = (log['km_per_litre'] as num?)?.toStringAsFixed(2);
    final kmDriven = (log['km_since_last_fill'] as num?)?.toInt();
    final rating = log['mileage_rating'] as String?;
    final pump = log['pump_name'] as String?;
    final loc = log['pump_location'] as String?;
    final notes = log['notes'] as String?;
    final fuelType =
        (log['fuel_type'] as String? ?? 'diesel').toUpperCase();

    Color ratingColor;
    String ratingLabel;
    switch (rating) {
      case 'good':
        ratingColor = const Color(0xFF16A34A);
        ratingLabel = 'Good';
        break;
      case 'medium':
        ratingColor = const Color(0xFFD97706);
        ratingLabel = 'Average';
        break;
      case 'bad':
        ratingColor = const Color(0xFFDC2626);
        ratingLabel = 'Poor';
        break;
      default:
        ratingColor = KTColors.textSecondary;
        ratingLabel = 'First Fill';
    }

    // Build the badge text:
    // - has rating + kml  → "Good · 4.20 km/L"
    // - has kml, no rating → "4.20 km/L"  (calculated from previous fill, no target set)
    // - no kml            → "First Fill"
    final badgeText = (rating != null && kml != null)
        ? '$ratingLabel · $kml km/L'
        : (kml != null ? '$kml km/L' : ratingLabel);

    return Card(
      elevation: 2,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(dateStr,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: KTColors.textHeading)),
                const SizedBox(width: 8),
                _MiniChip(
                    label: fuelType,
                    color: KTColors.driverAccentBg,
                    textColor: KTColors.driverAccent),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ratingColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: ratingColor.withOpacity(0.3)),
                  ),
                  child: Text(
                    badgeText,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: ratingColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _StatBox(
                    icon: Icons.water_drop_outlined,
                    value: '$litres L',
                    label: 'Filled'),
                const SizedBox(width: 8),
                if (kmDriven != null)
                  _StatBox(
                      icon: Icons.route_outlined,
                      value: '$kmDriven km',
                      label: 'Driven'),
                const SizedBox(width: 8),
                if (odo != null)
                  _StatBox(
                      icon: Icons.speed_outlined,
                      value: '$odo km',
                      label: 'Odometer'),
              ],
            ),
            if (pump != null || loc != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.local_gas_station_outlined,
                      size: 13, color: KTColors.textSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      [pump, loc].whereType<String>().join(' · '),
                      style: TextStyle(
                          fontSize: 12, color: KTColors.textSecondary),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            if (notes != null && notes.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(notes,
                  style: TextStyle(
                      fontSize: 12,
                      color: KTColors.textSecondary,
                      fontStyle: FontStyle.italic)),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  const _StatBox(
      {required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: KTColors.surface,
        border: Border.all(color: KTColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: KTColors.textSecondary),
              const SizedBox(width: 3),
              Text(value,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: KTColors.textHeading)),
            ],
          ),
          Text(label,
              style: TextStyle(
                  fontSize: 10, color: KTColors.textSecondary)),
        ],
      ),
    );
  }
}

class _MiniChip extends StatelessWidget {
  final String label;
  final Color color;
  final Color textColor;
  const _MiniChip(
      {required this.label, required this.color, required this.textColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
          color: color, borderRadius: BorderRadius.circular(5)),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: textColor)),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty / error / no-vehicle states
// ---------------------------------------------------------------------------

class _EmptyLogs extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 280,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_gas_station_outlined,
                size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            const Text('No fill-ups logged yet.',
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(
              'Tap "Log Fill-Up" each time you fill\nthe tank to full to track mileage.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  color: KTColors.textSecondary,
                  height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoVehicleState extends StatelessWidget {
  const _NoVehicleState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_shipping_outlined,
                size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            const Text('No Vehicle Assigned',
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              'Ask your fleet manager to assign a\nvehicle to your driver profile.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  color: KTColors.textSecondary,
                  height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline,
              color: KTColors.danger, size: 40),
          const SizedBox(height: 8),
          Text('Failed to load',
              style: TextStyle(color: KTColors.textSecondary)),
          const SizedBox(height: 12),
          OutlinedButton(
              onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Log fill-up bottom sheet
// ---------------------------------------------------------------------------

class _FuelLogSheet extends ConsumerStatefulWidget {
  final Map<String, dynamic> vehicle;
  final VoidCallback onAdded;

  const _FuelLogSheet({required this.vehicle, required this.onAdded});

  @override
  ConsumerState<_FuelLogSheet> createState() => _FuelLogSheetState();
}

class _FuelLogSheetState extends ConsumerState<_FuelLogSheet> {
  final _formKey = GlobalKey<FormState>();
  final _odoCtrl = TextEditingController();
  final _litresCtrl = TextEditingController();

  String _fuelType = 'diesel';
  DateTime _fillDate = DateTime.now();
  bool _submitting = false;

  static const _fuelTypes = ['diesel', 'petrol', 'cng', 'lpg'];

  @override
  void initState() {
    super.initState();
    final cap = widget.vehicle['fuel_tank_capacity'];
    if (cap != null) _litresCtrl.text = cap.toString();
    final ft = widget.vehicle['fuel_type'] as String?;
    if (ft != null && _fuelTypes.contains(ft)) _fuelType = ft;
  }

  @override
  void dispose() {
    _odoCtrl.dispose();
    _litresCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _fillDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _fillDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final d = _fillDate;
      final payload = {
        'vehicle_id': widget.vehicle['id'] as int,
        'fill_date':
            '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}',
        'odometer_km': int.parse(_odoCtrl.text),
        'litres_filled': double.parse(_litresCtrl.text),
        'fuel_type': _fuelType,
      };
      final res = await api.post('/drivers/me/fuel-logs', data: payload)
          as Map<String, dynamic>;
      final saved = res['data'] as Map<String, dynamic>?;
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onAdded();
      String msg = 'Fill-up logged!';
      if (saved != null) {
        final kml =
            (saved['km_per_litre'] as num?)?.toStringAsFixed(2);
        final rating = saved['mileage_rating'] as String?;
        if (kml != null && rating != null) {
          final emoji = rating == 'good'
              ? '😊'
              : (rating == 'medium' ? '😐' : '😟');
          msg =
              '$emoji $kml km/L · ${rating[0].toUpperCase()}${rating.substring(1)} mileage';
        }
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: KTColors.driverAccent,
        behavior: SnackBarBehavior.floating,
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed: $e'),
        backgroundColor: KTColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final reg =
        widget.vehicle['registration_number'] as String? ?? '-';
    final d = _fillDate;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, bottom + 24),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.local_gas_station,
                      color: KTColors.driverAccent, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Log Full-Tank Fill-Up · $reg',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Record each time you fill the tank completely.',
                style: TextStyle(
                    fontSize: 12,
                    color: KTColors.textSecondary,
                    height: 1.4),
              ),
              const SizedBox(height: 18),
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(8),
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Fill Date *',
                    prefixIcon: Icon(Icons.calendar_today_outlined),
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  child: Text(
                    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _odoCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly
                ],
                decoration: const InputDecoration(
                  labelText: 'Odometer Reading (km) *',
                  prefixIcon: Icon(Icons.speed_outlined),
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  helperText: 'Exact km shown on the dashboard',
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (int.tryParse(v) == null) return 'Enter a number';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _litresCtrl,
                keyboardType: const TextInputType.numberWithOptions(
                    decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                      RegExp(r'^\d*\.?\d{0,1}'))
                ],
                decoration: InputDecoration(
                  labelText: 'Litres Filled *',
                  prefixIcon: const Icon(Icons.water_drop_outlined),
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  helperText:
                      widget.vehicle['fuel_tank_capacity'] != null
                          ? 'Tank capacity: ${widget.vehicle["fuel_tank_capacity"]}L'
                          : null,
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (double.tryParse(v) == null) return 'Enter a number';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _fuelType,
                decoration: const InputDecoration(
                  labelText: 'Fuel Type',
                  prefixIcon:
                      Icon(Icons.local_gas_station_outlined),
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
                items: _fuelTypes
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(
                              t[0].toUpperCase() + t.substring(1)),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _fuelType = v!),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: KTColors.driverAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.check),
                  label:
                      Text(_submitting ? 'Saving\u2026' : 'Save Fill-Up'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
