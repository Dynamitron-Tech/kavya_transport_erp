import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

// ─── Provider ──────────────────────────────────────────────────────────────

final vehicleDocumentsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>(
  (ref, vehicleId) async {
    final api = ref.read(apiServiceProvider);
    final res = await api.get('/vehicles/$vehicleId/documents');
    if (res is Map<String, dynamic>) {
      final data = res['data'];
      if (data is List) return data.cast<Map<String, dynamic>>();
    }
    return [];
  },
);

// ─── Screen ────────────────────────────────────────────────────────────────

class FleetVehicleDocumentsScreen extends ConsumerWidget {
  final int vehicleId;
  final String registrationNumber;

  const FleetVehicleDocumentsScreen({
    super.key,
    required this.vehicleId,
    required this.registrationNumber,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(vehicleDocumentsProvider(vehicleId));

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: KTColors.textHeading,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Documents', style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
            Text(
              registrationNumber,
              style: KTTextStyles.label.copyWith(color: KTColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: KTColors.fleetAccent),
            onPressed: () => ref.invalidate(vehicleDocumentsProvider(vehicleId)),
          ),
        ],
      ),
      body: docsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: KTColors.fleetAccent),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: KTColors.danger, size: 48),
              const SizedBox(height: 12),
              Text('Failed to load documents',
                  style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(vehicleDocumentsProvider(vehicleId)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: KTColors.fleetAccent,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (docs) {
          // Build a map of present docs keyed by type, merge with all known types
          final Map<String, Map<String, dynamic>?> byType = {
            for (final t in _docTypes.keys) t: null,
          };
          for (final d in docs) {
            final type = (d['document_type'] ?? '').toString();
            byType[type] = d;
          }

          return RefreshIndicator(
            color: KTColors.fleetAccent,
            onRefresh: () async => ref.invalidate(vehicleDocumentsProvider(vehicleId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                // Summary strip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: KTColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: KTColors.borderColor),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _summaryItem(
                        docs.length.toString(),
                        'Uploaded',
                        KTColors.success,
                      ),
                      _divider(),
                      _summaryItem(
                        (_docTypes.length - docs.length).toString(),
                        'Missing',
                        KTColors.danger,
                      ),
                      _divider(),
                      _summaryItem(
                        docs.where((d) => d['is_verified'] == true).length.toString(),
                        'Verified',
                        KTColors.info,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Document cards
                ...byType.entries.map((entry) {
                  final typeName = entry.key;
                  final doc = entry.value;
                  return _DocCard(
                    typeName: typeName,
                    label: _docTypes[typeName] ?? typeName,
                    doc: doc,
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _summaryItem(String count, String label, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: KTTextStyles.h2.copyWith(color: color, fontWeight: FontWeight.w800),
        ),
        Text(label, style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
      ],
    );
  }

  Widget _divider() => Container(
        height: 32,
        width: 1,
        color: KTColors.borderColor,
      );
}

// ─── Document type display names ───────────────────────────────────────────

const _docTypes = {
  'rc_book': 'RC Book',
  'insurance': 'Insurance',
  'pollution_certificate': 'Pollution Certificate (PUC)',
  'fitness_certificate': 'Fitness Certificate',
  'permit': 'Permit',
};

// ─── Single doc card ───────────────────────────────────────────────────────

class _DocCard extends StatelessWidget {
  final String typeName;
  final String label;
  final Map<String, dynamic>? doc;

  const _DocCard({
    required this.typeName,
    required this.label,
    required this.doc,
  });

  @override
  Widget build(BuildContext context) {
    final uploaded = doc != null;
    final fileUrl = doc?['file_url']?.toString();
    final docNumber = doc?['document_number']?.toString();
    final expiryRaw = doc?['expiry_date']?.toString();
    final isVerified = doc?['is_verified'] == true;

    Color statusColor;
    String statusText;
    IconData statusIcon;

    if (!uploaded) {
      statusColor = KTColors.danger;
      statusText = 'Missing';
      statusIcon = Icons.cancel_outlined;
    } else if (isVerified) {
      statusColor = KTColors.success;
      statusText = 'Verified';
      statusIcon = Icons.verified_outlined;
    } else {
      statusColor = KTColors.warning;
      statusText = 'Pending';
      statusIcon = Icons.hourglass_top_outlined;
    }

    // Check expiry
    bool isExpired = false;
    bool expiresWithin30 = false;
    String expiryDisplay = '—';
    if (expiryRaw != null && expiryRaw != 'null' && expiryRaw.isNotEmpty) {
      try {
        final expiry = DateTime.parse(expiryRaw);
        final now = DateTime.now();
        final diff = expiry.difference(now).inDays;
        expiryDisplay = '${expiry.day.toString().padLeft(2, '0')}/'
            '${expiry.month.toString().padLeft(2, '0')}/${expiry.year}';
        if (diff < 0) {
          isExpired = true;
        } else if (diff <= 30) {
          expiresWithin30 = true;
        }
      } catch (_) {}
    }

    final Color borderColor = isExpired
        ? KTColors.danger
        : expiresWithin30
            ? KTColors.warning
            : KTColors.borderColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: isExpired || expiresWithin30 ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: uploaded ? KTColors.fleetAccentBg : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _docIcon(typeName),
                    color: uploaded ? KTColors.fleetAccent : KTColors.textMuted,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: KTTextStyles.body.copyWith(
                      color: KTColors.textHeading,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, color: statusColor, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        statusText,
                        style: KTTextStyles.label.copyWith(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            if (uploaded) ...[
              const SizedBox(height: 12),
              const Divider(color: KTColors.borderColor, height: 1),
              const SizedBox(height: 10),
              // Details grid
              Row(
                children: [
                  if (docNumber != null && docNumber.isNotEmpty)
                    Expanded(
                      child: _detailItem('Doc Number', docNumber),
                    ),
                  Expanded(
                    child: _detailItem(
                      'Expiry',
                      expiryDisplay,
                      valueColor: isExpired
                          ? KTColors.danger
                          : expiresWithin30
                              ? KTColors.warning
                              : null,
                    ),
                  ),
                ],
              ),
              if (isExpired || expiresWithin30) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isExpired
                        ? KTColors.danger.withValues(alpha: 0.08)
                        : KTColors.warningBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isExpired ? Icons.warning_amber_rounded : Icons.schedule,
                        color: isExpired ? KTColors.danger : KTColors.warning,
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isExpired ? 'Document expired' : 'Expires within 30 days',
                        style: KTTextStyles.label.copyWith(
                          color: isExpired ? KTColors.danger : KTColors.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (fileUrl != null && fileUrl.isNotEmpty) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final uri = Uri.parse(fileUrl);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      side: const BorderSide(color: KTColors.fleetAccent),
                      foregroundColor: KTColors.fleetAccent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: Text(
                      'View Document',
                      style: KTTextStyles.label.copyWith(
                        color: KTColors.fleetAccent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ] else ...[
              const SizedBox(height: 8),
              Text(
                'No document uploaded yet',
                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailItem(String label, String value, {Color? valueColor}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: KTTextStyles.label.copyWith(color: KTColors.textMuted)),
        const SizedBox(height: 2),
        Text(
          value,
          style: KTTextStyles.body.copyWith(
            color: valueColor ?? KTColors.textHeading,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  IconData _docIcon(String type) {
    switch (type) {
      case 'rc_book':
        return Icons.credit_card_outlined;
      case 'insurance':
        return Icons.health_and_safety_outlined;
      case 'pollution_certificate':
        return Icons.eco_outlined;
      case 'fitness_certificate':
        return Icons.fact_check_outlined;
      case 'permit':
        return Icons.approval_outlined;
      default:
        return Icons.description_outlined;
    }
  }
}
