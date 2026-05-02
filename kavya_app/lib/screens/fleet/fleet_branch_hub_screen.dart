import 'package:flutter/material.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../models/fuel.dart';
import '../../providers/pump_dashboard_provider.dart';
import 'fleet_branch_tanks_screen.dart';
import 'fleet_branch_pumps_screen.dart';

class FleetBranchHubScreen extends StatelessWidget {
  final Branch branch;
  final List<FuelTank> tanks;

  const FleetBranchHubScreen({
    super.key,
    required this.branch,
    required this.tanks,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(branch.name,
                style: KTTextStyles.h3.copyWith(
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none)),
            Text(
              branch.city ?? 'Fuel Management',
              style: KTTextStyles.labelSmall.copyWith(
                  color: KTColors.textMuted,
                  decoration: TextDecoration.none),
            ),
          ],
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            _HubTile(
              label: 'Tanks',
              description: 'Manage fuel tanks for this branch',
              icon: Icons.water_drop_rounded,
              color: const Color(0xFF0288D1),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => FleetBranchTanksScreen(
                    branch: branch,
                    tanks: tanks,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _HubTile(
              label: 'Pumps',
              description: 'View and manage pumps at this branch',
              icon: Icons.local_gas_station_rounded,
              color: const Color(0xFF00897B),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => FleetBranchPumpsScreen(branch: branch),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HubTile extends StatelessWidget {
  final String label;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _HubTile({
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, size: 28, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: KTColors.textHeading)),
                  const SizedBox(height: 4),
                  Text(description,
                      style: const TextStyle(
                          fontSize: 13, color: KTColors.textMuted)),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: color),
          ],
        ),
      ),
    );
  }
}
