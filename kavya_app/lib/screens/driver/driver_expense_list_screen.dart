import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/expense.dart';
import '../../providers/expense_provider.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';

class DriverExpenseListScreen extends ConsumerStatefulWidget {
  const DriverExpenseListScreen({super.key});

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
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(expensesProvider(null));
    final expenses = expensesAsync.valueOrNull ?? [];
    
    final filtered = _filterExpenses(expenses);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expenses'),
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
                hintText: 'Search expenses...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),

          // Filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _filterChip('all', 'All', _filterStatus == 'all', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('pending', 'Pending', _filterStatus == 'pending', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('submitted', 'Submitted', _filterStatus == 'submitted', (v) => setState(() => _filterStatus = v)),
                const SizedBox(width: 8),
                _filterChip('approved', 'Approved', _filterStatus == 'approved', (v) => setState(() => _filterStatus = v)),
              ],
            ),
          ),

          // Category Filter
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _filterChip('all', 'All Cat.', _filterCategory == 'all', (v) => setState(() => _filterCategory = v)),
                ...categories.map((cat) => Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: _filterChip(cat, cat.replaceAll('_', ' '), _filterCategory == cat, (v) => setState(() => _filterCategory = v)),
                )),
              ],
            ),
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
                        Text('No expenses found', style: KTTextStyles.h3),
                        const SizedBox(height: 24),
                        KtButton(
                          label: 'Add Expense',
                          icon: Icons.add,
                          onPressed: () => context.push('/driver/add-expense'),
                        ),
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
                      child: const Shimmer.fromColors(
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
                    Text('Error loading expenses', style: KTTextStyles.h3),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/driver/add-expense'),
        child: const Icon(Icons.add),
      ),
    );
  }

  List<Expense> _filterExpenses(List<Expense> expenses) {
    var result = expenses;

    // Filter by status
    if (_filterStatus != 'all') {
      result = result.where((e) => e.status == _filterStatus).toList();
    }

    // Filter by category
    if (_filterCategory != 'all') {
      result = result.where((e) => e.category == _filterCategory).toList();
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

  Widget _filterChip(String value, String label, bool selected, Function(String) onSelected) {
    return GestureDetector(
      onTap: () => onSelected(value),
      child: Chip(
        label: Text(label, style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : KTColors.textPrimary,
        )),
        backgroundColor: selected ? KTColors.primary : KTColors.cardSurface,
        side: selected ? BorderSide.none : const BorderSide(color: KTColors.textMuted),
      ),
    );
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
                      expense.date ?? 'N/A',
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
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: KTColors.primary),
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
      'fuel': KTColors.primary,
      'toll': KTColors.info,
      'food': KTColors.warning,
      'maintenance': KTColors.danger,
      'loading': KTColors.success,
      'unloading': KTColors.info,
      'parking': KTColors.warning,
      'police': KTColors.danger,
    };
    return colors[category] ?? KTColors.textMuted;
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
    return icons[category] ?? Icons.receipt_long;
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return KTColors.warning;
      case 'submitted': return KTColors.info;
      case 'approved': return KTColors.success;
      default: return KTColors.textMuted;
    }
  }
}
