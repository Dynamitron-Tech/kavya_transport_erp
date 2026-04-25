import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../providers/admin_providers.dart';

class AdminMastersScreen extends ConsumerWidget {
  const AdminMastersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clients = ref.watch(adminClientListProvider);
    final vehicles = ref.watch(adminVehicleListProvider);
    final drivers = ref.watch(adminDriverListProvider);

    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Masters',
            style: TextStyle(color: KTColors.darkTextPrimary)),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: KTColors.amber600,
        onPressed: () => _showAddSheet(context),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminClientListProvider);
          ref.invalidate(adminVehicleListProvider);
          ref.invalidate(adminDriverListProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Clients ──
            _sectionHead('CLIENTS'),
            clients.when(
              data: (list) {
                final items = list.take(3).toList();
                return Column(
                  children: [
                    ...items.map<Widget>((c) {
                      final m = c as Map<String, dynamic>;
                      return _clientTile(context, m);
                    }),
                    _addButton('+ Add client',
                        () => context.push('/manager/clients/create')),
                  ],
                );
              },
              loading: () => _loader(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 20),

            // ── Vehicles ──
            _sectionHead('VEHICLES'),
            vehicles.when(
              data: (list) {
                final items = list.take(4).toList();
                return Column(
                  children: [
                    ...items.map<Widget>((v) {
                      final m = v as Map<String, dynamic>;
                      return _vehicleTile(context, m);
                    }),
                    _addButton('+ Add vehicle',
                        () => context.push('/manager/fleet')),
                  ],
                );
              },
              loading: () => _loader(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 20),

            // ── Drivers ──
            _sectionHead('DRIVERS'),
            drivers.when(
              data: (list) {
                final items = list.take(4).toList();
                return Column(
                  children: [
                    ...items.map<Widget>((d) {
                      final m = d as Map<String, dynamic>;
                      return _driverTile(context, m);
                    }),
                    _addButton('+ Add driver',
                        () => context.push('/admin/employees/create')),
                  ],
                );
              },
              loading: () => _loader(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _sectionHead(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style: const TextStyle(
                color: KTColors.darkTextSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );

  Widget _loader() => const SizedBox(
      height: 60,
      child: Center(
          child: CircularProgressIndicator(color: KTColors.amber600)));

  Widget _clientTile(BuildContext context, Map<String, dynamic> m) {
    final name = m['company_name'] as String? ?? m['name'] as String? ?? '—';
    final outstanding = _fmtAmt(m['outstanding_amount']);
    final status = (m['status'] as String? ?? 'active').toUpperCase();
    final isOverdue = status == 'OVERDUE' || (m['is_overdue'] == true);
    return GestureDetector(
      onTap: () => context.push('/admin/clients/${m['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: KTColors.info.withAlpha(30),
              child: Text(name.substring(0, name.length.clamp(0, 2)).toUpperCase(),
                  style: const TextStyle(
                      color: KTColors.info,
                      fontWeight: FontWeight.bold,
                      fontSize: 12)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(
                          color: KTColors.darkTextPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                  Text(outstanding != '₹0' ? '$outstanding outstanding' : 'No outstanding',
                      style: const TextStyle(
                          color: KTColors.darkTextSecondary, fontSize: 12)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isOverdue
                    ? KTColors.danger.withAlpha(20)
                    : KTColors.success.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                isOverdue ? 'Overdue' : 'Active',
                style: TextStyle(
                    color: isOverdue ? KTColors.danger : KTColors.success,
                    fontSize: 10,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _vehicleTile(BuildContext context, Map<String, dynamic> m) {
    final reg = m['registration_number'] as String? ?? '—';
    final type = m['vehicle_type'] as String? ?? '';
    final cap = _safeInt(m['capacity_tons'] ?? m['capacity']);
    final status = (m['status'] as String? ?? 'AVAILABLE').toUpperCase();
    final isAvail = status == 'AVAILABLE';
    return GestureDetector(
      onTap: () => context.push('/admin/vehicles/${m['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(reg,
                      style: const TextStyle(
                          color: KTColors.darkTextPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 14)),
                  Text('$type ${cap}T',
                      style: const TextStyle(
                          color: KTColors.darkTextSecondary, fontSize: 12)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isAvail
                    ? KTColors.success.withAlpha(20)
                    : KTColors.info.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                isAvail ? 'Available' : 'On trip',
                style: TextStyle(
                    color: isAvail ? KTColors.success : KTColors.info,
                    fontSize: 10,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _driverTile(BuildContext context, Map<String, dynamic> m) {
    final name = '${m['first_name'] ?? ''} ${(m['last_name'] ?? '').toString().isNotEmpty ? '${(m['last_name'] as String).substring(0, 1)}.' : ''}';
    final status = (m['status'] as String? ?? 'AVAILABLE').toUpperCase();
    final isAvail = status == 'AVAILABLE';
    return GestureDetector(
      onTap: () => context.push('/admin/drivers/${m['id']}'),
      child: Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: KTColors.amber600.withAlpha(30),
            child: Text(
              name.trim().isNotEmpty ? name.trim().substring(0, name.trim().length.clamp(0, 2)).toUpperCase() : '?',
              style: const TextStyle(
                  color: KTColors.amber600,
                  fontWeight: FontWeight.bold,
                  fontSize: 11),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.trim(),
                    style: const TextStyle(
                        color: KTColors.darkTextPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                Text(isAvail ? 'Available' : 'On trip',
                    style: const TextStyle(
                        color: KTColors.darkTextSecondary, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: isAvail
                  ? KTColors.success.withAlpha(20)
                  : KTColors.info.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isAvail ? 'Available' : 'On trip',
              style: TextStyle(
                  color: isAvail ? KTColors.success : KTColors.info,
                  fontSize: 10,
                  fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _addButton(String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12),
        margin: const EdgeInsets.only(top: 4),
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.darkBorder, width: 0.5),
        ),
        child: Center(
            child: Text(label,
                style: const TextStyle(
                    color: KTColors.darkTextPrimary,
                    fontWeight: FontWeight.w600))),
      ),
    );
  }

  void _showAddSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: KTColors.darkSurface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.person_add, color: KTColors.info),
              title: const Text('Add client',
                  style: TextStyle(color: KTColors.darkTextPrimary)),
              onTap: () {
                Navigator.pop(context);
                context.push('/manager/clients/create');
              },
            ),
            ListTile(
              leading:
                  const Icon(Icons.local_shipping, color: KTColors.success),
              title: const Text('Add vehicle',
                  style: TextStyle(color: KTColors.darkTextPrimary)),
              onTap: () {
                Navigator.pop(context);
                context.push('/manager/fleet');
              },
            ),
            ListTile(
              leading: const Icon(Icons.badge, color: KTColors.amber600),
              title: const Text('Add driver',
                  style: TextStyle(color: KTColors.darkTextPrimary)),
              onTap: () {
                Navigator.pop(context);
                context.push('/admin/employees/create');
              },
            ),
          ],
        ),
      ),
    );
  }

  String _fmtAmt(dynamic val) {
    final v = (val is num)
        ? val.toDouble()
        : double.tryParse(val?.toString() ?? '') ?? 0.0;
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(0)}K';
    return '₹${v.toStringAsFixed(0)}';
  }

  String _safeInt(dynamic val) {
    if (val == null) return '0';
    final d = double.tryParse(val.toString()) ?? 0;
    return d.toInt().toString();
  }
}
