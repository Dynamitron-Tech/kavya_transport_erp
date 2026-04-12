import 'package:flutter/foundation.dart' show LicenseRegistry;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/localization/locale_provider.dart';

class DriverProfileScreen extends ConsumerWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final s = ref.watch(sProvider);
    final name = user?.fullName ?? 'Driver';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'D';
    final avatarUrl = user?.avatarUrl;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // ── Gradient Header ──────────────────────────────────────────────
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [KTColors.driverAccentDark, KTColors.driverAccent],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 36),
          child: Column(
            children: [
              Stack(
                alignment: Alignment.bottomRight,
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: avatarUrl == null
                          ? const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFFFF8C00), Color(0xFFFFB347)],
                            )
                          : null,
                      boxShadow: [
                        BoxShadow(
                          color: KTColors.driverAccent.withValues(alpha: 0.45),
                          blurRadius: 18,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: avatarUrl != null
                        ? ClipOval(
                            child: Image.network(
                              avatarUrl,
                              width: 88,
                              height: 88,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Center(
                                child: Text(
                                  initial,
                                  style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Colors.white),
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              initial,
                              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                          ),
                  ),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      border: Border.all(color: KTColors.driverAccentDark, width: 2),
                    ),
                    child: const Icon(Icons.check, size: 12, color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                name,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: KTColors.driverAccent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: KTColors.driverAccent.withValues(alpha: 0.35)),
                ),
                child: Text(
                  (user?.role ?? 'driver').toUpperCase(),
                  style: const TextStyle(
                    color: KTColors.driverAccent,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.3,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // ── Personal Info ────────────────────────────────────────────────
        _SectionGroup(
          title: s.personalInfo,
          children: [
            _InfoTile(Icons.person_outline, s.fullName, user?.fullName ?? '-'),
            _InfoTile(Icons.email_outlined, s.email, user?.email.isNotEmpty == true ? user!.email : '-'),
            _InfoTile(Icons.phone_outlined, s.phone, user?.phone?.isNotEmpty == true ? user!.phone! : '-'),
            _InfoTile(
              Icons.badge_outlined,
              s.statusLabel,
              user == null ? '-' : (user.isActive ? s.active : s.inactive),
              valueColor: user == null ? null : (user.isActive ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // ── App ──────────────────────────────────────────────────────────
        _SectionGroup(
          title: s.app,
          children: [
            _ActionTile(
              icon: Icons.help_outline,
              label: s.helpAndSupport,
              subtitle: s.contactUsForAssistance,
              onTap: () {},
            ),
            _ActionTile(
              icon: Icons.info_outline,
              label: s.about,
              subtitle: s.appInfoAndLicenses,
              onTap: () => _showAboutSheet(context),
            ),
          ],
        ),

        const SizedBox(height: 20),

        // ── Logout ───────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _LogoutButton(ref: ref),
        ),

        const SizedBox(height: 32),
      ],
    );
  }

  void _showAboutSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _AboutSheet(),
    );
  }
}

// ── Reusable Section Group ────────────────────────────────────────────────────

class _SectionGroup extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SectionGroup({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 10),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: KTColors.textMuted,
                letterSpacing: 1.4,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: KTColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: Column(
              children: List.generate(children.length, (i) => Column(
                children: [
                  children[i],
                  if (i < children.length - 1)
                    Divider(height: 1, indent: 56, color: KTColors.borderColor),
                ],
              )),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info Tile ─────────────────────────────────────────────────────────────────

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoTile(this.icon, this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: KTColors.driverAccent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: KTColors.driverAccent, size: 18),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: KTColors.textMuted, fontWeight: FontWeight.w500)),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: valueColor ?? KTColors.textHeading),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Action Tile ───────────────────────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  const _ActionTile({required this.icon, required this.label, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: KTColors.driverAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: KTColors.driverAccent, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: KTColors.textHeading)),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: KTColors.textMuted)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: KTColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}

// ── Logout Button ─────────────────────────────────────────────────────────────

class _LogoutButton extends ConsumerWidget {
  const _LogoutButton({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef _) {
    final s = ref.watch(sProvider);
    return GestureDetector(
      onTap: () => showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: KTColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(s.logout, style: const TextStyle(color: KTColors.textHeading, fontWeight: FontWeight.w700)),
          content: Text(
            s.logoutConfirm,
            style: const TextStyle(color: KTColors.textMuted),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(s.cancel, style: const TextStyle(color: KTColors.textMuted)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                ref.read(authProvider.notifier).logout();
              },
              child: Text(s.logout, style: const TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: KTColors.dangerBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.danger.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 20),
            const SizedBox(width: 10),
            Text(s.logout, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 15, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

// ── About Bottom Sheet ────────────────────────────────────────────────────────

class _AboutSheet extends StatelessWidget {
  const _AboutSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // drag handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 4),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: KTColors.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
              child: Column(
                children: [
                  // App icon
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [KTColors.driverAccent, KTColors.driverAccentDark],
                      ),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: KTColors.driverAccent.withValues(alpha: 0.35),
                          blurRadius: 22,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 42),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'KT Driver App',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: KTColors.textHeading),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                    decoration: BoxDecoration(
                      color: KTColors.driverAccentBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: KTColors.driverAccent.withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'Version 1.0.0',
                      style: TextStyle(color: KTColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(height: 24),
                  _AboutInfoRow(icon: Icons.business_outlined, label: 'Company', value: 'Kavya Transports'),
                  const SizedBox(height: 10),
                  _AboutInfoRow(icon: Icons.copyright_outlined, label: 'Copyright', value: '© 2025 Kavya Transports'),
                  const SizedBox(height: 10),
                  _AboutInfoRow(icon: Icons.code_outlined, label: 'Built with', value: 'Flutter & FastAPI'),
                  const SizedBox(height: 24),
                  // View licenses
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const _CustomLicensesScreen()),
                        );
                      },
                      icon: const Icon(Icons.article_outlined, size: 16),
                      label: const Text('View Open Source Licenses'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: KTColors.textMuted,
                        side: const BorderSide(color: KTColors.borderColor),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: KTColors.driverAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: const Text('Close', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── About Info Row ────────────────────────────────────────────────────────────

class _AboutInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _AboutInfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        color: KTColors.lightBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          Icon(icon, color: KTColors.driverAccent, size: 18),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: KTColors.textMuted, fontSize: 13, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(value, style: const TextStyle(color: KTColors.textHeading, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ── Custom Licenses Screen ────────────────────────────────────────────────────

/// Packages/patterns that are internal, low-level C/C++ native, or build-tool
/// artifacts that are not relevant to end users.
const _kHiddenPackages = {
  // Dart/Flutter internal build tools
  '_fe_analyzer_shared',
  '_flutterfire_internals',
  'analyzer',
  'analyzer_plugin',
  'csslib',
  'source_span',
  'source_map_stack_trace',
  'stack_trace',
  'watcher',
  'args',
  'glob',
  // C/C++ native graphics & crypto libs
  'abseil-cpp',
  'angle',
  'boringssl',
  'harfbuzz',
  'icu',
  'libjpeg',
  'libpng',
  'libwebp',
  'libgifcodec',
  'skia',
  'vulkan-deps',
  'spirv-cross',
  'dawn',
  'tonic',
  'zlib',
  'brotli',
  'crc32c',
  'expat',
  // Android system packages
  'aFileChooser',
  'accessibility',
  'archive',
};

bool _isVisible(String packageName) {
  if (packageName.startsWith('_')) return false;
  if (_kHiddenPackages.contains(packageName)) return false;
  return true;
}

class _PackageLicense {
  final String name;
  final List<String> paragraphs;
  const _PackageLicense({required this.name, required this.paragraphs});
}

class _CustomLicensesScreen extends StatefulWidget {
  const _CustomLicensesScreen();

  @override
  State<_CustomLicensesScreen> createState() => _CustomLicensesScreenState();
}

class _CustomLicensesScreenState extends State<_CustomLicensesScreen> {
  List<_PackageLicense>? _licenses;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadLicenses();
  }

  Future<void> _loadLicenses() async {
    final Map<String, List<String>> byPackage = {};

    await for (final entry in LicenseRegistry.licenses) {
      for (final pkg in entry.packages) {
        if (!_isVisible(pkg)) continue;
        final paragraphs = entry.paragraphs
            .map((p) => p.text.trim())
            .where((t) => t.isNotEmpty)
            .toList();
        byPackage.putIfAbsent(pkg, () => []).addAll(paragraphs);
      }
    }

    final sorted = byPackage.entries
        .map((e) => _PackageLicense(name: e.key, paragraphs: e.value))
        .toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    if (mounted) setState(() => _licenses = sorted);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _licenses == null
        ? null
        : _search.isEmpty
            ? _licenses!
            : _licenses!
                .where((l) => l.name.toLowerCase().contains(_search.toLowerCase()))
                .toList();

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.driverAccentDark,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Open Source Licenses',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: 0.2),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search packages…',
                hintStyle: const TextStyle(color: KTColors.textMuted, fontSize: 14),
                prefixIcon: const Icon(Icons.search_rounded, color: KTColors.textMuted, size: 18),
                filled: true,
                fillColor: const Color(0xFF111827),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF1E2D45)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF1E2D45)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFFF8C00)),
                ),
              ),
            ),
          ),
        ),
      ),
      body: filtered == null
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Color(0xFFFF8C00)),
                  SizedBox(height: 16),
                  Text('Loading licenses…', style: TextStyle(color: KTColors.textMuted, fontSize: 14)),
                ],
              ),
            )
          : filtered.isEmpty
              ? Center(
                  child: Text(
                    'No packages match "$_search"',
                    style: const TextStyle(color: KTColors.textMuted, fontSize: 14),
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Row(
                        children: [
                          Text(
                            '${filtered.length} package${filtered.length == 1 ? '' : 's'}',
                            style: const TextStyle(
                              color: KTColors.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const Spacer(),
                          const Text(
                            'Tap a package to view its license',
                            style: TextStyle(color: Color(0xFF475569), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, i) {
                          final pkg = filtered[i];
                          return _LicenseCard(pkg: pkg);
                        },
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _LicenseCard extends StatefulWidget {
  final _PackageLicense pkg;
  const _LicenseCard({required this.pkg});

  @override
  State<_LicenseCard> createState() => _LicenseCardState();
}

class _LicenseCardState extends State<_LicenseCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final paragraphs = widget.pkg.paragraphs;
    final preview = paragraphs.isNotEmpty ? paragraphs.first : '';
    final licenseType = _detectLicenseType(preview);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _expanded ? const Color(0xFFFF8C00).withValues(alpha: 0.3) : const Color(0xFF1E2D45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF8C00).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Center(
                      child: Icon(Icons.code_rounded, size: 16, color: Color(0xFFFF8C00)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.pkg.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.1,
                          ),
                        ),
                        if (licenseType != null) ...[  
                          const SizedBox(height: 3),
                          Text(
                            licenseType,
                            style: const TextStyle(
                              color: KTColors.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: KTColors.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          // Expanded license text
          if (_expanded) ...[  
            const Divider(height: 1, color: Color(0xFF1E2D45)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: paragraphs
                    .map((p) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text(
                            p,
                            style: const TextStyle(
                              color: KTColors.textMuted,
                              fontSize: 12,
                              height: 1.7,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String? _detectLicenseType(String text) {
    final t = text.toLowerCase();
    if (t.contains('mit license') || t.contains('permission is hereby granted')) return 'MIT License';
    if (t.contains('apache license') || t.contains('apache-2')) return 'Apache 2.0 License';
    if (t.contains('bsd 3-clause') || t.contains('redistribution and use in source and binary')) {
      return t.contains('3-clause') || t.contains('neither the name') ? 'BSD 3-Clause License' : 'BSD 2-Clause License';
    }
    if (t.contains('mozilla public license') || t.contains('mpl')) return 'Mozilla Public License';
    if (t.contains('gnu general public') || t.contains('gpl')) return 'GPL License';
    if (t.contains('lgpl') || t.contains('lesser general public')) return 'LGPL License';
    if (t.contains('isc license') || t.contains('permission to use, copy, modify')) return 'ISC License';
    if (t.contains('public domain') || t.contains('unlicense')) return 'Public Domain';
    if (t.contains('zlib') || t.contains('zlib/libpng')) return 'zlib License';
    if (t.contains('boost software license')) return 'Boost License';
    return null;
  }
}
