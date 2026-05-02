import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

class KTRoleBadge extends StatelessWidget {
  final String role;
  const KTRoleBadge({super.key, required this.role});

  Color get _roleColor {
    switch (role.toLowerCase()) {
      case 'admin': return KTColors.roleAdmin;
      case 'manager': return KTColors.roleManager;
      case 'fleet_manager': return KTColors.roleFleet;
      case 'accountant': return KTColors.roleAccountant;
      case 'project_associate': return KTColors.roleAssociate;
      case 'driver': return KTColors.roleDriver;
      case 'auditor': return KTColors.roleAuditor;
      default: return KTColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: _roleColor, borderRadius: BorderRadius.circular(20)),
      child: Text(
        role.replaceAll('_', ' ').toUpperCase(),
        style: KTTextStyles.label.copyWith(color: Colors.white, fontSize: 11),
      ),
    );
  }
}