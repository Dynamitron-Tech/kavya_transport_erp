import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../providers/admin_providers.dart';
import '../widgets/admin_shell_screen.dart';

class AdminEmployeesScreen extends ConsumerStatefulWidget {
  const AdminEmployeesScreen({super.key});

  @override
  ConsumerState<AdminEmployeesScreen> createState() =>
      _AdminEmployeesScreenState();
}

class _AdminEmployeesScreenState
    extends ConsumerState<AdminEmployeesScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  static const _roles = [null, 'MANAGER', 'PROJECT_ASSOCIATE', 'FLEET_MANAGER', 'ACCOUNTANT', 'DRIVER'];
  static const _labels = ['All', 'Manager', 'PA', 'Fleet', 'Accountant', 'Driver'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearch(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(adminEmployeeSearchProvider.notifier).state = query;
    });
  }

  @override
  Widget build(BuildContext context) {
    final employees = ref.watch(adminEmployeesProvider);
    final activeRole = ref.watch(adminEmployeeRoleFilter);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: KTColors.surface,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: KTColors.borderColor, width: 1)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.go('/admin/dashboard'),
                  ),
                  Expanded(
                    child: Row(children: [
                      Text('Employees', style: KTTextStyles.h1.copyWith(color: KTColors.textHeading)),
                      const SizedBox(width: 8),
                      employees.when(
                        data: (list) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: KTColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text('${list.length}',
                              style: KTTextStyles.caption.copyWith(color: KTColors.primary, fontWeight: FontWeight.w600)),
                        ),
                        loading: () => const SizedBox.shrink(),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                    ]),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_rounded, color: KTColors.textHeading, size: 22),
                    onPressed: () => context.push('/admin/employees/create'),
                  ),
                  const ComplianceBellButton(),
                ],
              ),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: KTColors.primary,
        onRefresh: () async => ref.invalidate(adminEmployeesProvider),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Search ──
            TextField(
              controller: _searchCtrl,
              onChanged: _onSearch,
              style: KTTextStyles.body.copyWith(color: KTColors.textBody),
              decoration: InputDecoration(
                hintText: 'Search employees…',
                hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                prefixIcon: const Icon(Icons.search_rounded, color: KTColors.textMuted, size: 18),
                fillColor: KTColors.lightBg,
                filled: true,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: KTColors.borderColor)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: KTColors.borderColor)),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: KTColors.primary, width: 1.5)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 12),

            // ── Role filter chips ──
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: List.generate(_roles.length, (i) {
                final active = activeRole == _roles[i];
                return GestureDetector(
                  onTap: () => ref.read(adminEmployeeRoleFilter.notifier).state = _roles[i],
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? KTColors.primary : KTColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? KTColors.primary : KTColors.borderColor),
                    ),
                    child: Text(_labels[i],
                        style: KTTextStyles.caption.copyWith(
                            color: active ? KTColors.white : KTColors.textBody,
                            fontWeight: FontWeight.w500)),
                  ),
                );
              }),
            ),
            const SizedBox(height: 14),

            // ── Employee list ──
            employees.when(
              data: (list) {
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 48),
                    child: Center(
                      child: Column(children: [
                        Icon(Icons.people_outline_rounded, size: 48, color: KTColors.borderColor),
                        const SizedBox(height: 12),
                        Text('No employees found',
                            style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                      ]),
                    ),
                  );
                }
                return Column(
                  children: list.map<Widget>((e) {
                    final m = e as Map<String, dynamic>;
                    return _employeeTile(context, m);
                  }).toList(),
                );
              },
              loading: () => const SizedBox(
                  height: 120,
                  child: Center(child: CircularProgressIndicator(color: KTColors.primary))),
              error: (e, _) => Text('Error: $e',
                  style: KTTextStyles.body.copyWith(color: KTColors.danger)),
            ),

            // ── Add employee button ──
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () => context.push('/admin/employees/create'),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: KTColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text('+ Add employee',
                      style: KTTextStyles.label.copyWith(
                          color: KTColors.white, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _employeeTile(BuildContext context, Map<String, dynamic> m) {
    final name = '${m['first_name'] ?? ''} ${(m['last_name'] ?? '').toString().isNotEmpty ? '${(m['last_name'] as String).substring(0, 1)}.' : ''}'.trim();
    final role = m['role'] as String? ?? m['primary_role'] as String? ?? '';
    final roleDisplay = _roleLabel(role);
    final isActive = m['is_active'] == true;
    final roleColor = _roleColor(role);
    final initials = name.isNotEmpty
        ? name.substring(0, name.length.clamp(0, 2)).toUpperCase()
        : '?';

    return GestureDetector(
      onTap: () => context.push('/admin/employees/${m['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KTColors.borderColor),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1))],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: roleColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(initials,
                    style: TextStyle(
                        color: roleColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 13)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name.isNotEmpty ? name : 'Unknown',
                      style: KTTextStyles.h3.copyWith(color: KTColors.textHeading)),
                  Text(roleDisplay,
                      style: KTTextStyles.caption.copyWith(color: KTColors.textMuted)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: (isActive ? KTColors.success : KTColors.gray400).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isActive ? 'Active' : 'Inactive',
                style: KTTextStyles.labelCaps.copyWith(
                    color: isActive ? KTColors.success : KTColors.gray400),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String role) {
    switch (role.toUpperCase()) {
      case 'MANAGER':
        return 'Manager';
      case 'PROJECT_ASSOCIATE':
        return 'Project Associate';
      case 'FLEET_MANAGER':
        return 'Fleet Manager';
      case 'ACCOUNTANT':
        return 'Accountant';
      case 'DRIVER':
        return 'Driver';
      case 'ADMIN':
        return 'Admin';
      default:
        return role;
    }
  }

  Color _roleColor(String role) {
    switch (role.toUpperCase()) {
      case 'MANAGER':
        return KTColors.info;
      case 'PROJECT_ASSOCIATE':
        return KTColors.amber600;
      case 'FLEET_MANAGER':
        return KTColors.success;
      case 'ACCOUNTANT':
        return const Color(0xFF7C3AED);
      case 'DRIVER':
        return const Color(0xFF0D9488);
      default:
        return KTColors.info;
    }
  }
}
