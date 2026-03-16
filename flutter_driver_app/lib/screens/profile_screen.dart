import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/section_header.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Avatar + Name
        Center(
          child: Column(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
                child: Text(
                  (user?.fullName ?? 'D').substring(0, 1).toUpperCase(),
                  style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary),
                ),
              ),
              const SizedBox(height: 12),
              Text(user?.fullName ?? 'Driver',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w600)),
              Text(user?.role ?? 'driver',
                  style:
                      const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
            ],
          ),
        ),
        const SizedBox(height: 24),

        const SectionHeader(title: 'Personal Info'),
        _infoTile(Icons.person_outline, 'Username', user?.username ?? '-'),
        _infoTile(Icons.phone_outlined, 'Phone', user?.phone ?? '-'),
        _infoTile(Icons.email_outlined, 'Email', user?.email ?? '-'),
        _infoTile(Icons.badge_outlined, 'Status',
            user?.isActive == true ? 'Active' : 'Inactive'),

        const SizedBox(height: 24),
        const SectionHeader(title: 'App'),
        _actionTile(Icons.help_outline, 'Help & Support', () {}),
        _actionTile(Icons.info_outline, 'About', () {
          showAboutDialog(
            context: context,
            applicationName: 'KT Driver App',
            applicationVersion: '1.0.0',
            applicationLegalese: '© 2025 Kavya Transports',
          );
        }),
        const SizedBox(height: 16),
        _actionTile(Icons.logout, 'Logout', () {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Logout'),
              content: const Text('Are you sure you want to logout?'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel')),
                TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    ref.read(authStateProvider.notifier).logout();
                  },
                  child: const Text('Logout',
                      style: TextStyle(color: AppTheme.error)),
                ),
              ],
            ),
          );
        }, color: AppTheme.error),
      ],
    );
  }

  Widget _infoTile(IconData icon, String label, String value) => Card(
        child: ListTile(
          leading: Icon(icon, color: AppTheme.primary, size: 22),
          title: Text(label,
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          subtitle: Text(value,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
        ),
      );

  Widget _actionTile(IconData icon, String label, VoidCallback onTap,
          {Color? color}) =>
      Card(
        child: ListTile(
          leading: Icon(icon, color: color ?? AppTheme.textSecondary, size: 22),
          title: Text(label,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: color ?? AppTheme.textPrimary)),
          trailing:
              Icon(Icons.chevron_right, color: color ?? AppTheme.textMuted),
          onTap: onTap,
        ),
      );
}
