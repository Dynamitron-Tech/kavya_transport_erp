import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/expense.dart';

// Track recently added expenses with timestamp for UI feedback
class RecentExpenseNotifier extends StateNotifier<Expense?> {
  RecentExpenseNotifier() : super(null);

  void setRecentExpense(Expense expense) {
    state = expense;
    // Auto-hide after 5 minutes
    Future.delayed(const Duration(minutes: 5), () {
      state = null;
    });
  }

  void clearRecentExpense() {
    state = null;
  }
}

final recentExpenseProvider = StateNotifierProvider<RecentExpenseNotifier, Expense?>((ref) {
  return RecentExpenseNotifier();
});
