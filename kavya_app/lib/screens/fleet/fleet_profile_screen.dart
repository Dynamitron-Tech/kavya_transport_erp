import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/auth_provider.dart';

class FleetProfileScreen extends ConsumerWidget {
  const FleetProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final accent = KTColors.getRoleColor('fleet_manager');

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('My Profile',
            style: KTTextStyles.h2
                .copyWith(color: KTColors.textHeading, decoration: TextDecoration.none)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const SizedBox(height: 12),
            // ─── Avatar ─────────────────────────────────────────────
            CircleAvatar(
              radius: 44,
              backgroundColor: accent.withValues(alpha: 0.2),
              child: Text(
                _initials(user?.fullName ?? ''),
                style: KTTextStyles.displayMedium.copyWith(
                  color: accent,
                  decoration: TextDecoration.none,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              user?.fullName ?? 'Fleet Manager',
              style: KTTextStyles.h2.copyWith(
                color: KTColors.textHeading,
                decoration: TextDecoration.none,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: accent.withValues(alpha: 0.4)),
              ),
              child: Text(
                'Fleet Manager',
                style: KTTextStyles.label.copyWith(
                  color: accent,
                  decoration: TextDecoration.none,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ─── Info Card ──────────────────────────────────────────
            _infoCard([
              _InfoRow(icon: Icons.email_outlined, label: 'Email', value: user?.email ?? '—'),
              _InfoRow(icon: Icons.phone_outlined, label: 'Phone', value: user?.phone ?? '—'),
              _InfoRow(icon: Icons.badge_outlined, label: 'User ID', value: user?.id ?? '—'),
              _InfoRow(
                icon: Icons.circle,
                label: 'Status',
                value: (user?.isActive ?? false) ? 'Active' : 'Inactive',
                valueColor: (user?.isActive ?? false) ? KTColors.success : KTColors.danger,
              ),
            ]),
            const SizedBox(height: 16),

            // ─── Quick Actions ──────────────────────────────────────
            _infoCard([
              _InfoRow(
                icon: Icons.directions_car_outlined,
                label: 'Manage Vehicles',
                value: '',
                trailing: const Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
                onTap: () => context.push('/fleet/vehicles'),
              ),
              _InfoRow(
                icon: Icons.people_outline,
                label: 'Manage Drivers',
                value: '',
                trailing: const Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
                onTap: () => context.push('/fleet/drivers'),
              ),
              _InfoRow(
                icon: Icons.analytics_outlined,
                label: 'View Analytics',
                value: '',
                trailing: const Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
                onTap: () => context.push('/fleet/analytics'),
              ),
            ]),
            const SizedBox(height: 24),

            // ─── Logout ─────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.logout_rounded, color: KTColors.danger),
                label: Text('Logout',
                    style: KTTextStyles.body.copyWith(color: KTColors.danger)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: KTColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (_) => AlertDialog(
                      backgroundColor: KTColors.surface,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      title: Text('Logout',
                          style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                      content: Text('Are you sure you want to logout?',
                          style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text('Cancel',
                              style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pop(context);
                            ref.read(authProvider.notifier).logout();
                          },
                          child: Text('Logout',
                              style: KTTextStyles.body.copyWith(color: KTColors.danger)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  Widget _infoCard(List<_InfoRow> rows) {
    return Container(
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(color: KTColors.borderColor, height: 1),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final child = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: KTColors.textMuted, size: 18),
          const SizedBox(width: 12),
          Text(label,
              style: KTTextStyles.body
                  .copyWith(color: KTColors.textMuted, decoration: TextDecoration.none)),
          const Spacer(),
          if (trailing != null)
            trailing!
          else
            Text(
              value,
              style: KTTextStyles.body.copyWith(
                color: valueColor ?? KTColors.textHeading,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.none,
              ),
            ),
        ],
      ),
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: child);
    }
    return child;
  }
}
