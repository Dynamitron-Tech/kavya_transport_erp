import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/offline_sync_status_provider.dart';
import '../core/theme/kt_colors.dart';

/// Displays offline sync status (queued items, syncing, etc.)
class OfflineSyncStatusWidget extends ConsumerWidget {
  final bool compact;
  final VoidCallback? onTapSync;

  const OfflineSyncStatusWidget({
    super.key,
    this.compact = false,
    this.onTapSync,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncStatus = ref.watch(offlineSyncStatusProvider);

    return syncStatus.when(
      data: (status) {
        // Hide widget if idle (no pending items and not syncing)
        if (status.isIdle) {
          return const SizedBox.shrink();
        }

        if (compact) {
          return _buildCompactStatus(context, ref, status);
        } else {
          return _buildFullStatus(context, ref, status);
        }
      },
      loading: () => const Padding(
        padding: EdgeInsets.all(8.0),
        child: SizedBox(
          height: 24,
          width: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      error: (error, stack) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: KTColors.danger.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: KTColors.danger),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: KTColors.danger, size: 16),
            const SizedBox(width: 8),
            Text(
              'Sync Error',
              style: TextStyle(color: KTColors.danger, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactStatus(
    BuildContext context,
    WidgetRef ref,
    OfflineSyncStatus status,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.isSyncing ? KTColors.info : KTColors.warning,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status.isSyncing) ...[
            SizedBox(
              height: 14,
              width: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            const SizedBox(width: 6),
            const Text('Syncing...', style: TextStyle(color: Colors.white, fontSize: 11)),
          ] else ...[
            Icon(Icons.cloud_upload_outlined, color: Colors.white, size: 12),
            const SizedBox(width: 4),
            Text(
              '${status.queuedCount} pending',
              style: const TextStyle(color: Colors.white, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFullStatus(
    BuildContext context,
    WidgetRef ref,
    OfflineSyncStatus status,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: status.isSyncing
            ? KTColors.info.withValues(alpha: 0.1)
            : KTColors.warning.withValues(alpha: 0.1),
        border: Border.all(
          color: status.isSyncing ? KTColors.info : KTColors.warning,
          width: 1,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (status.isSyncing) ...[
                SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      status.isSyncing ? KTColors.info : KTColors.warning,
                    ),
                  ),
                ),
              ] else ...[
                Icon(
                  Icons.cloud_upload_outlined,
                  color: KTColors.warning,
                  size: 20,
                ),
              ],
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status.isSyncing ? 'Syncing offline data...' : 'Pending uploads',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: status.isSyncing ? KTColors.info : KTColors.warning,
                      ),
                    ),
                    Text(
                      '${status.queuedCount} item${status.queuedCount == 1 ? '' : 's'} queued',
                      style: const TextStyle(fontSize: 12, color: KTColors.textSecondary),
                    ),
                  ],
                ),
              ),
              if (!status.isSyncing && onTapSync != null)
                TextButton.icon(
                  onPressed: onTapSync,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Sync now'),
                ),
            ],
          ),
          if (status.lastError != null) ...[
            const SizedBox(height: 8),
            Text(
              'Last error: ${status.lastError}',
              style: const TextStyle(color: KTColors.danger, fontSize: 11),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (status.lastSyncTime != null) ...[
            const SizedBox(height: 4),
            Text(
              'Last synced: ${_formatTime(status.lastSyncTime!)}',
              style: const TextStyle(color: KTColors.textSecondary, fontSize: 10),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inSeconds < 60) {
      return 'just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}

/// Sync status indicator for AppBar
class SyncStatusChip extends ConsumerWidget {
  const SyncStatusChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncStatus = ref.watch(offlineSyncStatusProvider);

    return syncStatus.when(
      data: (status) {
        if (status.isIdle) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.only(right: 8.0),
          child: OfflineSyncStatusWidget(compact: true),
        );
      },
      loading: () => const Padding(
        padding: EdgeInsets.only(right: 8.0),
        child: SizedBox(
          height: 24,
          width: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
