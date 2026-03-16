import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/error_state.dart';
import '../../widgets/loading_skeleton.dart';
import '../../widgets/empty_state.dart';

final _documentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ApiService();
  final data = await api.get<Map<String, dynamic>>('/documents/my');
  return (data['items'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ??
      [];
});

class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsState = ref.watch(_documentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Documents')),
      body: docsState.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeletonWidget(itemCount: 4, variant: LoadingVariant.list),
        ),
        error: (e, _) => ErrorStateWidget(
          error: e,
          onRetry: () => ref.invalidate(_documentsProvider),
        ),
        data: (docs) {
          if (docs.isEmpty) {
            return const EmptyStateWidget(
              icon: Icons.description_outlined,
              title: 'No documents',
              message: 'Your uploaded documents will appear here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final doc = docs[index];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppTheme.info.withValues(alpha: 0.1),
                    child: const Icon(Icons.description,
                        color: AppTheme.info, size: 20),
                  ),
                  title: Text(doc['title'] ?? 'Document',
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  subtitle: Text(
                    '${doc['document_type'] ?? ''} • ${doc['created_at'] ?? ''}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: const Icon(Icons.chevron_right,
                      color: AppTheme.textMuted),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
