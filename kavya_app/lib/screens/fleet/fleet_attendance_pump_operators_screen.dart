import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ───────────────────────────────────────────────────────────────

final _pumpOperatorsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.get('/users/pump-operators');
  final payload = res['data'] ?? res;
  if (payload is List) return payload.cast<Map<String, dynamic>>();
  return [];
});

// ─── Screen ─────────────────────────────────────────────────────────────────

class FleetAttendancePumpOperatorsScreen extends ConsumerStatefulWidget {
  const FleetAttendancePumpOperatorsScreen({super.key});

  @override
  ConsumerState<FleetAttendancePumpOperatorsScreen> createState() =>
      _FleetAttendancePumpOperatorsScreenState();
}

class _FleetAttendancePumpOperatorsScreenState
    extends ConsumerState<FleetAttendancePumpOperatorsScreen> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final operatorsAsync = ref.watch(_pumpOperatorsProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Pump Operator Attendance',
            style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
      ),
      body: Column(
        children: [
          // ─── Search ──────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search pump operators…',
                hintStyle: KTTextStyles.body.copyWith(color: KTColors.textMuted),
                prefixIcon: const Icon(Icons.search_rounded, color: KTColors.textMuted),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: KTColors.lightBg,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: KTColors.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: KTColors.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.primary, width: 1.5),
                ),
              ),
            ),
          ),

          // ─── List ─────────────────────────────────────────────────
          Expanded(
            child: operatorsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KTLoadingShimmer(type: ShimmerType.list),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 48, color: KTColors.danger),
                    const SizedBox(height: 12),
                    Text('Failed to load pump operators',
                        style:
                            KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => ref.invalidate(_pumpOperatorsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (operators) {
                final filtered = _searchQuery.isEmpty
                    ? operators
                    : operators.where((op) {
                        final firstName = (op['first_name'] ?? '').toString().toLowerCase();
                        final lastName = (op['last_name'] ?? '').toString().toLowerCase();
                        final email = (op['email'] ?? '').toString().toLowerCase();
                        final phone = (op['phone'] ?? '').toString();
                        return firstName.contains(_searchQuery) ||
                            lastName.contains(_searchQuery) ||
                            email.contains(_searchQuery) ||
                            phone.contains(_searchQuery);
                      }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text('No pump operators found',
                        style:
                            KTTextStyles.body.copyWith(color: KTColors.textMuted)),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(_pumpOperatorsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final op = filtered[i];
                      final firstName = (op['first_name'] ?? '').toString();
                      final lastName = (op['last_name'] ?? '').toString();
                      final name = '$firstName $lastName'.trim();
                      final email = (op['email'] ?? '—').toString();
                      final phone = (op['phone'] ?? '—').toString();
                      final isActive = op['is_active'] == true;
                      final userId = op['id'] as int? ?? 0;
                      final initials = name.trim().isNotEmpty
                          ? name
                              .trim()
                              .split(' ')
                              .map((e) => e.isNotEmpty ? e[0] : '')
                              .take(2)
                              .join()
                              .toUpperCase()
                          : '?';

                      return GestureDetector(
                        onTap: () => context.push(
                          '/fleet/attendance/pump-operator/$userId?name=${Uri.encodeComponent(name)}',
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: KTColors.borderColor),
                          ),
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              // Avatar
                              CircleAvatar(
                                radius: 24,
                                backgroundColor:
                                    const Color(0xFF00897B).withOpacity(0.12),
                                child: Text(
                                  initials,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF00897B),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Info
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name.isEmpty ? '—' : name,
                                      style: KTTextStyles.bodyMedium.copyWith(
                                          color: KTColors.textHeading,
                                          fontWeight: FontWeight.w600),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      phone,
                                      style: KTTextStyles.bodySmall
                                          .copyWith(color: KTColors.textMuted),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      email,
                                      style: KTTextStyles.labelSmall
                                          .copyWith(color: KTColors.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              // Status badge
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: (isActive
                                          ? KTColors.success
                                          : KTColors.textMuted)
                                      .withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  isActive ? 'Active' : 'Inactive',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isActive
                                        ? KTColors.success
                                        : KTColors.textMuted,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
