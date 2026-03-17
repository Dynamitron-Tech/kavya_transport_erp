import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/widgets/section_header.dart';

class DriverProfileScreen extends ConsumerWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: Column(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: KTColors.primary.withValues(alpha: 0.12),
                child: Text((user?.fullName ?? 'D').substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: KTColors.primary)),
              ),
              const SizedBox(height: 12),
              Text(user?.fullName ?? 'Driver', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
              Text(user?.role ?? 'driver', style: const TextStyle(color: KTColors.textSecondary, fontSize: 14)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const SectionHeader(title: 'Personal Info'),
        _infoTile(Icons.person_outline, 'Username', user?.username ?? '-'),
        _infoTile(Icons.phone_outlined, 'Phone', user?.phone ?? '-'),
        _infoTile(Icons.email_outlined, 'Email', user?.email ?? '-'),
        _infoTile(Icons.badge_outlined, 'Status', user?.isActive == true ? 'Active' : 'Inactive'),
        const SizedBox(height: 24),
        const SectionHeader(title: 'App'),
        _actionTile(Icons.help_outline, 'Help & Support', () {}),
        _actionTile(Icons.info_outline, 'About', () => showAboutDialog(context: context, applicationName: 'KT Driver App', applicationVersion: '1.0.0', applicationLegalese: '© 2025 Kavya Transports')),
        const SizedBox(height: 16),
        _actionTile(Icons.logout, 'Logout', () {
          showDialog(context: context, builder: (ctx) => AlertDialog(
            title: const Text('Logout'),
            content: const Text('Are you sure you want to logout?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              TextButton(onPressed: () { Navigator.pop(ctx); ref.read(authStateProvider.notifier).logout(); }, child: const Text('Logout', style: TextStyle(color: KTColors.error))),
            ],
          ));
        }, color: KTColors.error),
      ],
    );
  }

  Widget _infoTile(IconData icon, String label, String value) => Card(
    child: ListTile(
      leading: Icon(icon, color: KTColors.primary, size: 22),
      title: Text(label, style: const TextStyle(fontSize: 12, color: KTColors.textSecondary)),
      subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
    ),
  );

  Widget _actionTile(IconData icon, String label, VoidCallback onTap, {Color? color}) => Card(
    child: ListTile(
      leading: Icon(icon, color: color ?? KTColors.textSecondary, size: 22),
      title: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: color ?? KTColors.textPrimary)),
      trailing: Icon(Icons.chevron_right, color: color ?? KTColors.textMuted),
      onTap: onTap,
    ),
  );
}
