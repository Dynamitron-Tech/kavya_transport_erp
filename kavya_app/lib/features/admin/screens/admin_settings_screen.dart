import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/auth_provider.dart';
import '../providers/admin_providers.dart';

class AdminSettingsScreen extends ConsumerWidget {
  const AdminSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final branches = ref.watch(adminBranchesProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: KTColors.surface,
      ),
      child: Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: KTColors.borderColor, width: 1)),
              ),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Settings',
                    style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Company Info ──
          _sectionLabel('COMPANY'),
          const SizedBox(height: 8),
          _tile(Icons.business_outlined, 'Kavya Transports', subtitle: 'Company Name'),
          _tile(Icons.pin_outlined, 'GSTIN', subtitle: 'Company GST Number'),
          _tile(Icons.phone_outlined, 'Phone'),
          _tile(Icons.email_outlined, 'Email'),
          _tile(Icons.location_on_outlined, 'State'),
          const SizedBox(height: 20),

          // ── Branches ──
          _sectionLabel('BRANCHES'),
          const SizedBox(height: 8),
          branches.when(
            data: (list) {
              if (list.isEmpty) {
                return _emptyTile('No branches');
              }
              return Column(
                children: list.map<Widget>((b) {
                  final name = b['name'] ?? '—';
                  final city = b['city'] ?? '';
                  final active = b['is_active'] == true;
                  return _tile(
                    Icons.store_outlined,
                    name,
                    subtitle: city,
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (active ? KTColors.success : KTColors.danger).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(active ? 'Active' : 'Inactive',
                          style: KTTextStyles.labelCaps.copyWith(
                              color: active ? KTColors.success : KTColors.danger)),
                    ),
                    onTap: () => context.push('/admin/branches'),
                  );
                }).toList(),
              );
            },
            loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator(color: KTColors.primary))),
            error: (_, __) => _emptyTile('Could not load branches'),
          ),
          const SizedBox(height: 20),

          // ── Profile ──
          _sectionLabel('PROFILE'),
          const SizedBox(height: 8),
          _tile(Icons.person_outline_rounded, user?.name ?? '—'),
          _tile(Icons.email_outlined, user?.email ?? '—'),
          _tile(Icons.badge_outlined, 'Admin', subtitle: 'Role'),
          const SizedBox(height: 28),

          // ── Logout ──
          GestureDetector(
            onTap: () => _logout(context, ref),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: KTColors.dangerBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: KTColors.danger.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.logout_rounded, color: KTColors.danger, size: 18),
                  const SizedBox(width: 8),
                  Text('Log out',
                      style: KTTextStyles.label.copyWith(
                          color: KTColors.danger, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(text,
            style: KTTextStyles.labelCaps.copyWith(color: KTColors.textMuted)),
      );

  Widget _tile(IconData icon, String title,
      {String? subtitle, Widget? trailing, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          children: [
            Icon(icon, color: KTColors.textMuted, size: 18),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: KTTextStyles.body.copyWith(
                          color: KTColors.textHeading,
                          fontWeight: FontWeight.w500)),
                  if (subtitle != null)
                    Text(subtitle,
                        style: KTTextStyles.caption.copyWith(
                            color: KTColors.textMuted)),
                ],
              ),
            ),
            if (trailing != null) trailing,
            if (onTap != null)
              const Icon(Icons.chevron_right_rounded,
                  color: KTColors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _emptyTile(String text) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Center(
            child: Text(text,
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted))),
      );

  void _logout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KTColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Log out',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
        content: Text('Are you sure you want to log out?',
            style: KTTextStyles.body.copyWith(color: KTColors.textBody)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel',
                  style: KTTextStyles.label.copyWith(color: KTColors.textMuted))),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).logout();
              context.go('/login');
            },
            child: Text('Log out',
                style: KTTextStyles.label.copyWith(
                    color: KTColors.danger, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
