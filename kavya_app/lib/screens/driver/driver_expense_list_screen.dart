import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/expense.dart';
import '../../providers/expense_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/localization/locale_provider.dart';

class DriverExpenseListScreen extends ConsumerStatefulWidget {
  final int? tripId;
  final String? tripNumber;

  const DriverExpenseListScreen({super.key, this.tripId, this.tripNumber});

  @override
  ConsumerState<DriverExpenseListScreen> createState() => _DriverExpenseListScreenState();
}

class _DriverExpenseListScreenState extends ConsumerState<DriverExpenseListScreen> {
  String _filterStatus = 'all';
  String _filterCategory = 'all';
  late TextEditingController _searchCtrl;

  static const categories = ['fuel', 'toll', 'food', 'maintenance', 'loading', 'unloading', 'parking', 'police', 'other'];

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expensesAsync = ref.watch(expensesProvider(widget.tripId));
    final expenses = expensesAsync.valueOrNull ?? [];
    final s = ref.watch(sProvider);
    
    final filtered = _filterExpenses(expenses);
    final title = widget.tripNumber != null ? '${s.expenses} — ${widget.tripNumber}' : s.expenses;

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: Text(
                '₹${filtered.fold<double>(0, (sum, e) => sum + e.amount).toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: s.searchExpenses,
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),

          // Status Filters
          _SegmentedFilter(
            filters: [
              ('all', s.all),
              ('pending', s.pending),
              ('approved', s.approved),
              ('paid', s.paid),
              ('rejected', s.rejected),
            ],
            selected: _filterStatus,
            onSelect: (v) => setState(() => _filterStatus = v),
          ),
          const SizedBox(height: 2),
          // Category Filters
          _ChipFilter(
            filters: [
              const ('all', 'All'),
              ...categories.map((c) => (c, c[0].toUpperCase() + c.substring(1))),
            ],
            selected: _filterCategory,
            onSelect: (v) => setState(() => _filterCategory = v),
          ),
          const SizedBox(height: 8),

          // Expenses List
          Expanded(
            child: expensesAsync.when(
              data: (_) {
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(s.noExpensesFound, style: KTTextStyles.h3),
                        const SizedBox(height: 8),
                        Text(s.tapPlusToAddExpense, style: const TextStyle(color: KTColors.textMuted, fontSize: 13)),
                      ],
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, index) => _expenseCard(filtered[index]),
                );
              },
              loading: () => Column(
                children: List.generate(
                  5,
                  (index) => Padding(
                    padding: EdgeInsets.only(
                      left: 16,
                      right: 16,
                      bottom: index == 4 ? 0 : 8,
                      top: index == 0 ? 8 : 0,
                    ),
                    child: Container(
                      height: 80,
                      decoration: BoxDecoration(
                        color: KTColors.cardSurface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Shimmer.fromColors(
                        baseColor: Colors.grey,
                        highlightColor: Colors.white,
                        child: SizedBox.expand(),
                      ),
                    ),
                  ),
                ),
              ),
              error: (e, st) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.error_outline, size: 56, color: KTColors.danger),
                    const SizedBox(height: 16),
                    Text(s.errorLoadingExpenses, style: KTTextStyles.h3),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await context.push('/driver/add-expense');
          if (result == true && mounted) {
            ref.read(expensesProvider(widget.tripId).notifier).refresh();
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  List<Expense> _filterExpenses(List<Expense> expenses) {
    var result = expenses;

    // Filter by status
    if (_filterStatus != 'all') {
      result = result.where((e) => (e.status ?? 'pending').toLowerCase() == _filterStatus).toList();
    }

    // Filter by category
    if (_filterCategory != 'all') {
      result = result.where((e) => e.category.toLowerCase() == _filterCategory).toList();
    }

    // Filter by search
    final query = _searchCtrl.text.toLowerCase();
    if (query.isNotEmpty) {
      result = result.where((e) {
        return e.category.toLowerCase().contains(query) ||
            (e.description?.toLowerCase().contains(query) ?? false);
      }).toList();
    }

    return result;
  }



  Widget _expenseCard(Expense expense) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _getCategoryColor(expense.category).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(_getCategoryIcon(expense.category), color: _getCategoryColor(expense.category)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    expense.category.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if (expense.description != null && expense.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        expense.description!,
                        style: const TextStyle(fontSize: 11, color: KTColors.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _formatDate(expense.date),
                      style: const TextStyle(fontSize: 10, color: KTColors.textMuted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${expense.amount.toStringAsFixed(2)}',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: KTColors.driverAccent),
                ),
                const SizedBox(height: 4),
                if (expense.status != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _getStatusColor(expense.status!).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: Text(
                      expense.status!.replaceAll('_', ' '),
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(expense.status!),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getCategoryColor(String category) {
    const colors = {
      'fuel': KTColors.driverAccent,
      'toll': KTColors.info,
      'food': KTColors.warning,
      'maintenance': KTColors.danger,
      'loading': KTColors.success,
      'unloading': KTColors.info,
      'parking': KTColors.warning,
      'police': KTColors.danger,
    };
    return colors[category.toLowerCase()] ?? KTColors.textMuted;
  }

  IconData _getCategoryIcon(String category) {
    const icons = {
      'fuel': Icons.local_gas_station,
      'toll': Icons.toll,
      'food': Icons.restaurant,
      'maintenance': Icons.build,
      'loading': Icons.upload,
      'unloading': Icons.download,
      'parking': Icons.local_parking,
      'police': Icons.security,
    };
    return icons[category.toLowerCase()] ?? Icons.receipt_long;
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return KTColors.warning;
      case 'submitted': return KTColors.info;
      case 'approved': return KTColors.success;
      case 'paid': return KTColors.driverAccent;
      case 'rejected': return KTColors.danger;
      default: return KTColors.textMuted;
    }
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return 'N/A';
    try {
      final dt = DateTime.parse(raw);
      final day = dt.day.toString().padLeft(2, '0');
      final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      final mon = months[dt.month - 1];
      final year = dt.year;
      // Only show time if it's not midnight (i.e. the expense has a real timestamp)
      if (dt.hour == 0 && dt.minute == 0 && dt.second == 0) {
        return '$day $mon $year';
      }
      final hh = dt.hour.toString().padLeft(2, '0');
      final mm = dt.minute.toString().padLeft(2, '0');
      return '$day $mon $year, $hh:$mm';
    } catch (_) {
      return raw.split('T').first;
    }
  }
}

/// Tab-style status filter with underline indicator
class _SegmentedFilter extends StatelessWidget {
  final List<(String, String)> filters;
  final String selected;
  final ValueChanged<String> onSelect;

  const _SegmentedFilter({
    required this.filters,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF131D2F),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: filters.map((entry) {
          final (value, label) = entry;
          final isSelected = selected == value;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: isSelected ? KTColors.driverAccent : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                    color: isSelected ? Colors.white : KTColors.textMuted,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// Minimal text-chip category filter
class _ChipFilter extends StatelessWidget {
  final List<(String, String)> filters;
  final String selected;
  final ValueChanged<String> onSelect;

  const _ChipFilter({
    required this.filters,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: filters.asMap().entries.map((entry) {
          final (value, label) = entry.value;
          final isSelected = selected == value;
          return Padding(
            padding: EdgeInsets.only(right: entry.key < filters.length - 1 ? 6 : 0),
            child: GestureDetector(
              onTap: () => onSelect(value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected
                      ? KTColors.driverAccent.withValues(alpha: 0.15)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected
                        ? KTColors.driverAccent.withValues(alpha: 0.5)
                        : KTColors.surface,
                    width: 1,
                  ),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                    color: isSelected ? KTColors.driverAccent : KTColors.textMuted,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
