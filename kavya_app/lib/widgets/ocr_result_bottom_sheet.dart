import 'package:flutter/material.dart';
import '../../core/theme/kt_colors.dart';
import '../../services/ocr_service.dart';

/// A bottom sheet that shows extracted OCR fields and lets the user
/// apply or edit them before confirming.
///
/// Returns a [Map<String, String>] of key→value pairs accepted by the user,
/// or null if dismissed.
class OcrResultBottomSheet extends StatefulWidget {
  final OcrResult result;

  const OcrResultBottomSheet({super.key, required this.result});

  /// Helper: push the bottom sheet and await the accepted fields.
  static Future<Map<String, String>?> show(
    BuildContext context,
    OcrResult result,
  ) {
    return showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: KTColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => OcrResultBottomSheet(result: result),
    );
  }

  @override
  State<OcrResultBottomSheet> createState() => _OcrResultBottomSheetState();
}

class _OcrResultBottomSheetState extends State<OcrResultBottomSheet> {
  late Map<String, TextEditingController> _controllers;
  late Map<String, bool> _accepted;
  bool _showRaw = false;

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final e in widget.result.fields.entries)
        e.key: TextEditingController(text: e.value.value)
    };
    // Auto-accept high confidence fields (≥ 0.8)
    _accepted = {
      for (final e in widget.result.fields.entries)
        e.key: e.value.confidence >= 0.8
    };
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _acceptAll() => setState(() {
        for (final k in _accepted.keys) {
          _accepted[k] = true;
        }
      });

  void _confirm() {
    final accepted = <String, String>{
      for (final e in _accepted.entries)
        if (e.value) e.key: _controllers[e.key]!.text.trim()
    };
    Navigator.of(context).pop(accepted);
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final pct = (result.overallConfidence * 100).round();
    final confidenceColor = pct >= 75
        ? KTColors.success
        : pct >= 50
            ? KTColors.warning
            : KTColors.danger;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      builder: (_, scrollCtrl) => Column(
        children: [
          // Handle
          _SheetHandle(),
          // Fixed header
          _buildHeader(result, pct, confidenceColor),
          const Divider(height: 1, color: KTColors.borderColor),
          // Scrollable body
          Expanded(
            child: ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              children: [
                // Error banner
                if (result.error != null)
                  _ErrorBanner(message: result.error!),
                // Field rows
                if (result.fields.isEmpty)
                  _EmptyState()
                else ...[
                  _SectionLabel('Extracted Fields'),
                  ...result.fields.entries.map(_buildFieldRow),
                ],
                // Raw text
                const SizedBox(height: 16),
                InkWell(
                  onTap: () => setState(() => _showRaw = !_showRaw),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        const Text(
                          'Raw OCR Text',
                          style: TextStyle(
                            fontSize: 13,
                            color: KTColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const Spacer(),
                        Icon(
                          _showRaw
                              ? Icons.keyboard_arrow_up
                              : Icons.keyboard_arrow_down,
                          size: 18,
                          color: KTColors.textMuted,
                        ),
                      ],
                    ),
                  ),
                ),
                if (_showRaw) _RawTextBox(text: result.rawText),
                const SizedBox(height: 100), // space for bottom bar
              ],
            ),
          ),
          // Bottom action bar
          _buildActionBar(),
        ],
      ),
    );
  }

  Widget _buildHeader(OcrResult result, int pct, Color confidenceColor) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  OcrService.docTypeName(result.docType),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${result.fields.length} field${result.fields.length == 1 ? '' : 's'} detected',
                  style: const TextStyle(fontSize: 13, color: KTColors.textMuted),
                ),
              ],
            ),
          ),
          // Confidence badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: confidenceColor.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: confidenceColor.withAlpha(60)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome, size: 14, color: confidenceColor),
                const SizedBox(width: 5),
                Text(
                  '$pct%',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: confidenceColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldRow(MapEntry<String, OcrField> entry) {
    final key = entry.key;
    final field = entry.value;
    final ctrl = _controllers[key]!;
    final isAccepted = _accepted[key] ?? false;
    final confPct = (field.confidence * 100).round();

    Color chipColor;
    String chipLabel;
    if (confPct >= 80) {
      chipColor = KTColors.success;
      chipLabel = 'HIGH';
    } else if (confPct >= 55) {
      chipColor = KTColors.warning;
      chipLabel = 'CHECK';
    } else {
      chipColor = KTColors.danger;
      chipLabel = 'LOW';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isAccepted
            ? KTColors.success.withAlpha(10)
            : KTColors.lightBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isAccepted
              ? KTColors.success.withAlpha(60)
              : KTColors.borderColor.withAlpha(120),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label row
          Row(
            children: [
              Text(
                OcrService.labelFor(key),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isAccepted
                      ? KTColors.success
                      : KTColors.textMuted,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: chipColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  chipLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: chipColor,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const Spacer(),
              // Accept toggle
              GestureDetector(
                onTap: () => setState(() => _accepted[key] = !isAccepted),
                child: Icon(
                  isAccepted
                      ? Icons.check_box
                      : Icons.check_box_outline_blank,
                  size: 22,
                  color: isAccepted
                      ? KTColors.success
                      : KTColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Editable value
          TextField(
            controller: ctrl,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: KTColors.textHeading,
            ),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: KTColors.surface,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(7),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(7),
                borderSide: BorderSide(
                    color: KTColors.borderColor.withAlpha(160)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(7),
                borderSide:
                    const BorderSide(color: KTColors.driverAccent),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar() {
    final acceptedCount = _accepted.values.where((v) => v).length;
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.of(context).viewInsets.bottom +
            MediaQuery.of(context).padding.bottom +
            12,
      ),
      decoration: BoxDecoration(
        color: KTColors.surface,
        border: const Border(
          top: BorderSide(color: KTColors.borderColor),
        ),
      ),
      child: Row(
        children: [
          // Accept all
          TextButton.icon(
            onPressed: _acceptAll,
            icon: const Icon(Icons.select_all, size: 16),
            label: const Text('Accept All'),
            style: TextButton.styleFrom(
              foregroundColor: KTColors.driverAccent,
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const Spacer(),
          // Confirm button
          ElevatedButton.icon(
            onPressed: acceptedCount > 0 ? _confirm : null,
            icon: const Icon(Icons.check, size: 16),
            label: Text(
              acceptedCount > 0
                  ? 'Apply $acceptedCount Field${acceptedCount == 1 ? '' : 's'}'
                  : 'No Fields Selected',
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: KTColors.driverAccent,
              disabledBackgroundColor: KTColors.driverAccent.withAlpha(60),
              foregroundColor: Colors.white,
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Helper sub-widgets ───────────────────────────────────────────────────────

class _SheetHandle extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
        child: Container(
          margin: const EdgeInsets.only(top: 10, bottom: 4),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: KTColors.borderColor,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: KTColors.textMuted,
            letterSpacing: 0.8,
          ),
        ),
      );
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Column(
            children: [
              Icon(Icons.document_scanner_outlined,
                  size: 48, color: KTColors.textMuted.withAlpha(120)),
              const SizedBox(height: 12),
              const Text(
                'No fields detected.\nTry scanning with better lighting.',
                textAlign: TextAlign.center,
                style: TextStyle(color: KTColors.textMuted, fontSize: 14, height: 1.5),
              ),
            ],
          ),
        ),
      );
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: KTColors.dangerBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: KTColors.danger.withAlpha(60)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, size: 18, color: KTColors.danger.withAlpha(200)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                    color: KTColors.danger, fontSize: 13, height: 1.4),
              ),
            ),
          ],
        ),
      );
}

class _RawTextBox extends StatelessWidget {
  final String text;
  const _RawTextBox({required this.text});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: KTColors.lightBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: KTColors.borderColor.withAlpha(120)),
        ),
        child: SelectableText(
          text.isEmpty ? '(empty)' : text,
          style: const TextStyle(
            fontSize: 11.5,
            color: KTColors.textBody,
            height: 1.6,
            fontFamily: 'monospace',
          ),
        ),
      );
}
