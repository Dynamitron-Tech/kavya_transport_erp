import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_role_badge.dart';
import '../../providers/auth_provider.dart';
import '../../services/auth_service.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _notificationsEnabled = true;
  bool _darkModeEnabled = false;
  String _appVersion = 'Loading...';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final info = await PackageInfo.fromPlatform(); // shows current version (from package_info_plus)
    if (mounted) {
      setState(() => _appVersion = '${info.version} (${info.buildNumber})');
    }
  }

  void _changePassword() async {
    final url = Uri.parse('https://erp.kavyatransports.com/profile/security'); // opens web URL
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open browser')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(title: const Text("My profile")), //
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // User Info Header
            CircleAvatar(
              radius: 40,
              backgroundColor: KTColors.primaryLight,
              child: Text(
                user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : 'U',
                style: KTTextStyles.h1.copyWith(color: KTColors.primaryDark),
              ),
            ),
            const SizedBox(height: 16),
            Text(user?.name ?? 'User Name', style: KTTextStyles.h2),
            const SizedBox(height: 8),
            KTRoleBadge(role: user?.primaryRole ?? 'unknown'),
            const SizedBox(height: 16),
            Text(user?.email ?? 'user@kavyatransports.com', style: KTTextStyles.body),
            const SizedBox(height: 4),
            Text("+91 98765 43210", style: KTTextStyles.bodySmall.copyWith(color: Colors.grey[600])), // phone number

            const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Divider()), // Divider

            // Settings Section
            Align(
              alignment: Alignment.centerLeft,
              child: Text("Settings", style: KTTextStyles.h3),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              title: const Text("Notifications"), // toggle push notifications
              value: _notificationsEnabled,
              onChanged: (val) => setState(() => _notificationsEnabled = val),
              secondary: const Icon(Icons.notifications_active),
              activeThumbColor: KTColors.primary,
            ),
            SwitchListTile(
              title: const Text("Dark mode"), // toggle app theme
              value: _darkModeEnabled,
              onChanged: (val) => setState(() => _darkModeEnabled = val),
              secondary: const Icon(Icons.dark_mode),
              activeThumbColor: KTColors.primary,
            ),
            ListTile(
              title: const Text("Change password"),
              leading: const Icon(Icons.lock_outline),
              trailing: const Icon(Icons.open_in_new, size: 16),
              onTap: _changePassword,
            ),
            ListTile(
              title: const Text("App version"),
              leading: const Icon(Icons.info_outline),
              trailing: Text(_appVersion, style: KTTextStyles.bodySmall),
            ),

            const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Divider()), // Divider

            // Log Out Button
            OutlinedButton.icon(
              onPressed: () => ref.read(authServiceProvider).logout(), // calls auth_service.logout()
              style: OutlinedButton.styleFrom(
                foregroundColor: KTColors.danger,
                side: const BorderSide(color: KTColors.danger),
                minimumSize: const Size(double.infinity, 48), // full width
              ),
              icon: const Icon(Icons.logout),
              label: const Text("Log out"),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}