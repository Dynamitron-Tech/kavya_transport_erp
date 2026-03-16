import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_role_badge.dart';
import '../../providers/auth_provider.dart';
import '../../services/auth_service.dart';

class WebOnlyScreen extends ConsumerWidget {
  const WebOnlyScreen({super.key});

  final String webUrl = 'https://erp.kavyatransports.com'; // [cite: 54]

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final role = user?.primaryRole ?? 'unknown';
    final name = user?.name ?? 'User';

    return Scaffold(
      backgroundColor: Colors.white, // White screen [cite: 54]
      body: SafeArea(
        child: Center( // centered content [cite: 54]
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.local_shipping, size: 48, color: KTColors.primary), // KT logo top center
                const SizedBox(height: 16),
                KTRoleBadge(role: role), // KTRoleBadge showing their role [cite: 54]
                const SizedBox(height: 24),
                Text("Hello, $name", style: KTTextStyles.h1), // Heading [cite: 54]
                const SizedBox(height: 8),
                Text(
                  "The ${role.replaceAll('_', ' ')} portal is on desktop. Open the ERP on your computer to continue.", // Subtext [cite: 54]
                  style: KTTextStyles.body.copyWith(color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                
                // QR Code [cite: 54]
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
                  ),
                  child: QrImageView(
                    data: webUrl,
                    version: QrVersions.auto,
                    size: 200.0, // 200x200 [cite: 54]
                  ),
                ),
                const SizedBox(height: 24),
                
                SelectableText(webUrl, style: KTTextStyles.label.copyWith(color: KTColors.info)), // Selectable text URL [cite: 54]
                const SizedBox(height: 16),
                
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: webUrl)); // "Copy URL" button → clipboard [cite: 54]
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('URL copied to clipboard'), backgroundColor: KTColors.success),
                    );
                  },
                  icon: const Icon(Icons.copy),
                  label: const Text("Copy URL"),
                ),
                
                const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Divider()), // Divider [cite: 54]
                
                OutlinedButton.icon(
                  onPressed: () => ref.read(authServiceProvider).logout(), // calls auth_service.logout() [cite: 101]
                  icon: const Icon(Icons.logout, color: KTColors.danger),
                  label: Text("Log out", style: TextStyle(color: KTColors.danger)),
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: KTColors.danger)), // outlined, danger color [cite: 54]
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}