import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/expense_provider.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/empty_state.dart';
import '../../config/app_theme.dart';

class ExpenseListScreen extends ConsumerWidget {
  const ExpenseListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesState = ref.watch(expensesProvider(null));

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.primary,
        onPressed: () => context.push('/expenses/add'),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(expensesProvider(null)),
        child: expensesState.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child:
                LoadingSkeletonWidget(itemCount: 5, variant: LoadingVariant.list),
          ),
          error: (e, _) => ErrorStateWidget(
            error: e,
            onRetry: () => ref.invalidate(expensesProvider(null)),
          ),
          data: (expenses) {
            if (expenses.isEmpty) {
              return EmptyStateWidget(
                icon: Icons.receipt_long_outlined,
                title: 'No expenses yet',
                message: 'Add fuel, toll, or other trip expenses here.',
                actionLabel: 'Add Expense',
                onAction: () => context.push('/expenses/add'),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: expenses.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final exp = expenses[index];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                      child: Icon(_categoryIcon(exp.category),
                          color: AppTheme.primary, size: 20),
                    ),
                    title: Text(exp.category.replaceAll('_', ' ').toUpperCase(),
                        style: const TextStyle(
                            fontWeight: FontWeight.w500, fontSize: 14)),
                    subtitle: Text(
                        exp.description ?? exp.date ?? '',
                        style: const TextStyle(fontSize: 12)),
                    trailing: Text('₹${exp.amount.toStringAsFixed(0)}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15)),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'fuel':
      case 'diesel':
        return Icons.local_gas_station;
      case 'toll':
        return Icons.toll;
      case 'food':
      case 'meals':
        return Icons.restaurant;
      case 'maintenance':
      case 'repair':
        return Icons.build;
      case 'loading':
      case 'unloading':
        return Icons.inventory;
      default:
        return Icons.receipt;
    }
  }
}
