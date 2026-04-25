import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

const Color _accent = Color(0xFF0F766E);

// ─── Providers ────────────────────────────────────────────────────────────────

final _stockTypeProvider = StateProvider.autoDispose<String>((ref) => 'new');

final _tyreStockProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final type = ref.watch(_stockTypeProvider);
  final api = ref.read(apiServiceProvider);
  final res =
      await api.get('/tyre/stock', queryParameters: {'type': type});
  final data = (res is Map) ? (res['data'] ?? res) : res;
  return (data is Map<String, dynamic>) ? data : <String, dynamic>{};
});

// ─── Screen ───────────────────────────────────────────────────────────────────

class TyreInventoryScreen extends ConsumerStatefulWidget {
  const TyreInventoryScreen({super.key});

  @override
  ConsumerState<TyreInventoryScreen> createState() =>
      _TyreInventoryScreenState();
}

class _TyreInventoryScreenState extends ConsumerState<TyreInventoryScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final stockAsync = ref.watch(_tyreStockProvider);
    final currentType = ref.watch(_stockTypeProvider);

    return Scaffold(
      backgroundColor: KTColors.lightBg,
      floatingActionButton: FloatingActionButton(
        backgroundColor: _accent,
        onPressed: () => _showAddTyreSheet(context),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: KTColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: KTColors.borderColor),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search, color: KTColors.textMuted, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      onChanged: (v) =>
                          setState(() => _search = v.toLowerCase()),
                      style: KTTextStyles.body.copyWith(
                        color: KTColors.textHeading,
                        decoration: TextDecoration.none,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Search tyre…',
                        hintStyle: KTTextStyles.body.copyWith(
                          color: KTColors.textMuted,
                          decoration: TextDecoration.none,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Filter chips
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _FilterChip(
                  label: 'New',
                  selected: currentType == 'new',
                  onTap: () =>
                      ref.read(_stockTypeProvider.notifier).state = 'new',
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Retreaded',
                  selected: currentType == 'retreaded',
                  onTap: () =>
                      ref.read(_stockTypeProvider.notifier).state =
                          'retreaded',
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Removed',
                  selected: currentType == 'removed',
                  onTap: () =>
                      ref.read(_stockTypeProvider.notifier).state = 'removed',
                ),
              ],
            ),
          ),

          // Content
          Expanded(
            child: stockAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: _accent),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: KTColors.danger, size: 36),
                    const SizedBox(height: 8),
                    Text('Failed to load stock',
                        style: KTTextStyles.body.copyWith(
                            color: KTColors.textMuted,
                            decoration: TextDecoration.none)),
                    TextButton(
                      onPressed: () => ref.invalidate(_tyreStockProvider),
                      child: const Text('Retry',
                          style: TextStyle(color: _accent)),
                    ),
                  ],
                ),
              ),
              data: (data) {
                final counts =
                    (data['counts'] as Map<String, dynamic>?) ?? {};
                final items = (data['items'] as List?) ?? [];

                final filtered = _search.isEmpty
                    ? items
                    : items.where((t) {
                        final serial =
                            (t['serial_number'] ?? '').toString().toLowerCase();
                        final brand =
                            (t['brand'] ?? '').toString().toLowerCase();
                        final vehicle =
                            (t['vehicle_number'] ?? '').toString().toLowerCase();
                        return serial.contains(_search) ||
                            brand.contains(_search) ||
                            vehicle.contains(_search);
                      }).toList();

                // Group by brand
                final grouped = <String, List<Map<String, dynamic>>>{};
                for (final t in filtered) {
                  final brand = (t['brand'] ?? 'Other').toString();
                  grouped.putIfAbsent(brand, () => []).add(
                      t as Map<String, dynamic>);
                }
                // Sort tyres within each brand by tread depth descending (100% on top)
                for (final tyres in grouped.values) {
                  tyres.sort((a, b) {
                    final aDepth = (a['tread_depth_mm'] as num?)?.toDouble() ?? 0;
                    final bDepth = (b['tread_depth_mm'] as num?)?.toDouble() ?? 0;
                    return bDepth.compareTo(aDepth);
                  });
                }
                final brands = grouped.keys.toList()..sort();

                return RefreshIndicator(
                  color: _accent,
                  onRefresh: () async =>
                      ref.invalidate(_tyreStockProvider),
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 4),
                    children: [
                      _StockSummaryRow(counts: counts),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 40),
                          child: Center(
                            child: Column(
                              children: [
                                Icon(Icons.inventory_2_outlined,
                                    size: 40, color: KTColors.textMuted),
                                const SizedBox(height: 8),
                                Text(
                                  _search.isEmpty
                                      ? 'No tyres in stock'
                                      : 'No results for "$_search"',
                                  style: KTTextStyles.body.copyWith(
                                      color: KTColors.textMuted,
                                      decoration: TextDecoration.none),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        ...brands.map((brand) => _BrandGroup(
                              brand: brand,
                              tyres: grouped[brand]!,
                            )),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showAddTyreSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddTyreSheet(
        onAdded: () => ref.invalidate(_tyreStockProvider),
      ),
    );
  }
}

// ─── Add Tyre Bottom Sheet ────────────────────────────────────────────────────

class _AddTyreSheet extends ConsumerStatefulWidget {
  final VoidCallback onAdded;
  const _AddTyreSheet({required this.onAdded});

  @override
  ConsumerState<_AddTyreSheet> createState() => _AddTyreSheetState();
}

class _AddTyreSheetState extends ConsumerState<_AddTyreSheet> {
  final _formKey = GlobalKey<FormState>();
  final _brandCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _sizeCtrl = TextEditingController();
  final _plyCtrl = TextEditingController();
  final _treadCtrl = TextEditingController();
  final _pressureCtrl = TextEditingController();
  final _qualityCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController(text: '1');
  final _serialCtrl = TextEditingController();
  String _condition = 'new';
  bool _submitting = false;
  String _nextTyreNumber = '...';

  @override
  void initState() {
    super.initState();
    _fetchNextNumber();
  }

  Future<void> _fetchNextNumber() async {
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get('/tyre/next-number');
      final data = (res is Map) ? (res['data'] ?? res) : res;
      if (mounted) {
        setState(() => _nextTyreNumber = data['next'] ?? '...');
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _brandCtrl.dispose();
    _modelCtrl.dispose();
    _sizeCtrl.dispose();
    _plyCtrl.dispose();
    _treadCtrl.dispose();
    _pressureCtrl.dispose();
    _qualityCtrl.dispose();
    _qtyCtrl.dispose();
    _serialCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      final qty = int.tryParse(_qtyCtrl.text) ?? 1;
      final brand = _brandCtrl.text.trim();
      final model = _modelCtrl.text.trim();
      final size = _sizeCtrl.text.trim();

      final qualityPct = double.tryParse(_qualityCtrl.text.trim());
      final treadFromQuality = qualityPct != null ? (qualityPct * 18.0 / 100.0) : null;
      final treadRaw = double.tryParse(_treadCtrl.text.trim());
      final tread = treadRaw ?? treadFromQuality;

      await api.post('/tyre', data: {
        'serial_number': _nextTyreNumber,
        'manufacturer_serial': _serialCtrl.text.trim().isNotEmpty ? _serialCtrl.text.trim() : null,
        'brand': brand,
        'model': model.isNotEmpty ? model : null,
        'size': size,
        'ply_rating': _plyCtrl.text.trim().isNotEmpty
            ? _plyCtrl.text.trim()
            : null,
        'tread_depth_mm': tread,
        'initial_tread_depth_mm': tread,
        'pressure_psi': double.tryParse(_pressureCtrl.text.trim()),
        'status': _condition,
        'quantity': qty,
      });
      widget.onAdded();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$qty tyre${qty > 1 ? 's' : ''} added to stock'),
            backgroundColor: _accent,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: $e'),
            backgroundColor: KTColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: EdgeInsets.only(bottom: bottom),
      decoration: const BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            decoration: BoxDecoration(
              color: KTColors.borderColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _accent.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.add_circle_outline,
                      color: _accent, size: 20),
                ),
                const SizedBox(width: 12),
                Text(
                  'Add Tyre to Stock',
                  style: KTTextStyles.body.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: KTColors.textHeading,
                    decoration: TextDecoration.none,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Form
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    // Tyre Number (auto-generated, read-only)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: _accent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: _accent.withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.tag, color: _accent, size: 18),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Tyre Number',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: _accent,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _nextTyreNumber,
                                style: KTTextStyles.body.copyWith(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: KTColors.textHeading,
                                  decoration: TextDecoration.none,
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Auto',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: _accent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    _FormField(
                      label: 'Serial Number',
                      controller: _serialCtrl,
                      hint: 'Manufacturer serial (optional)',
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: _FormField(
                            label: 'Brand *',
                            controller: _brandCtrl,
                            hint: 'e.g. MRF, Apollo',
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _FormField(
                            label: 'Model',
                            controller: _modelCtrl,
                            hint: 'e.g. Zapper',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: _FormField(
                            label: 'Tyre Size *',
                            controller: _sizeCtrl,
                            hint: '295/90 R20',
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _FormField(
                            label: 'Ply Rating',
                            controller: _plyCtrl,
                            hint: 'e.g. 16PR',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Tyre Condition *',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: _accent,
                                ),
                              ),
                              const SizedBox(height: 6),
                              DropdownButtonFormField<String>(
                                initialValue: _condition,
                                decoration: InputDecoration(
                                  filled: true,
                                  fillColor: KTColors.lightBg,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide.none,
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 14),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'new', child: Text('New')),
                                  DropdownMenuItem(value: 'retreaded', child: Text('Retreaded')),
                                  DropdownMenuItem(value: 'removed', child: Text('Removed')),
                                ],
                                onChanged: (v) {
                                  if (v != null) setState(() => _condition = v);
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _FormField(
                            label: 'Tyre Quality (%)',
                            controller: _qualityCtrl,
                            hint: 'e.g. 100',
                            keyboard: TextInputType.number,
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return null;
                              final n = double.tryParse(v.trim());
                              if (n == null || n < 0 || n > 100) return '0-100';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: _FormField(
                            label: 'Tread Depth (mm)',
                            controller: _treadCtrl,
                            hint: 'e.g. 18',
                            keyboard: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _FormField(
                            label: 'Pressure (PSI)',
                            controller: _pressureCtrl,
                            hint: 'e.g. 110',
                            keyboard: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _FormField(
                      label: 'Quantity *',
                      controller: _qtyCtrl,
                      hint: '1',
                      keyboard: TextInputType.number,
                      validator: (v) {
                        final n = int.tryParse(v ?? '');
                        if (n == null || n < 1) return 'Min 1';
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _accent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Add to Stock',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Form field helper ────────────────────────────────────────────────────────

class _FormField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? hint;
  final TextInputType? keyboard;
  final String? Function(String?)? validator;

  const _FormField({
    required this.label,
    required this.controller,
    this.hint,
    this.keyboard,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: KTColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboard,
          validator: validator,
          style: KTTextStyles.body.copyWith(
            color: KTColors.textHeading,
            fontSize: 14,
            decoration: TextDecoration.none,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: KTColors.textMuted,
              fontSize: 13,
            ),
            filled: true,
            fillColor: KTColors.lightBg,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: KTColors.borderColor),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: KTColors.borderColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: _accent, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: KTColors.danger),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Brand Group (collapsible) ────────────────────────────────────────────────

class _BrandGroup extends StatefulWidget {
  final String brand;
  final List<Map<String, dynamic>> tyres;
  const _BrandGroup({required this.brand, required this.tyres});

  @override
  State<_BrandGroup> createState() => _BrandGroupState();
}

class _BrandGroupState extends State<_BrandGroup> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    // Sub-group by model+size for a compact summary
    final models = <String, int>{};
    for (final t in widget.tyres) {
      final model = (t['model'] ?? '').toString();
      final size = (t['size'] ?? '').toString();
      final key = model.isNotEmpty ? '$model · $size' : size;
      models[key] = (models[key] ?? 0) + 1;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        children: [
          // Header — tap to expand/collapse
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: _accent.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        widget.brand.isNotEmpty ? widget.brand[0] : '?',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: _accent,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.brand,
                          style: KTTextStyles.body.copyWith(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: KTColors.textHeading,
                            decoration: TextDecoration.none,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${widget.tyres.length} tyre${widget.tyres.length != 1 ? 's' : ''} · ${models.length} variant${models.length != 1 ? 's' : ''}',
                          style: TextStyle(
                            fontSize: 11,
                            color: KTColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${widget.tyres.length}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down,
                        size: 22, color: KTColors.textMuted),
                  ),
                ],
              ),
            ),
          ),

          // Model summary chips (always visible)
          if (!_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: models.entries
                    .map((e) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: KTColors.lightBg,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: KTColors.borderColor),
                          ),
                          child: Text(
                            '${e.key} (${e.value})',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: KTColors.textSecondary,
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),

          // Expanded tyre list
          if (_expanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
              child: Column(
                children: widget.tyres
                    .map((t) => _StockTyreCard(data: t))
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Stock summary row ────────────────────────────────────────────────────────

class _StockSummaryRow extends StatelessWidget {
  final Map<String, dynamic> counts;
  const _StockSummaryRow({required this.counts});

  @override
  Widget build(BuildContext context) {
    final newCount = counts['new'] ?? 0;
    final retreadCount = counts['retreaded'] ?? 0;
    final removedCount = counts['removed'] ?? 0;
    final total = newCount + retreadCount + removedCount;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _accent.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          _SummaryCell(value: '$total', label: 'Total', color: _accent),
          _vDivider(),
          _SummaryCell(
              value: '$newCount',
              label: 'New',
              color: const Color(0xFF16A34A)),
          _vDivider(),
          _SummaryCell(
              value: '$retreadCount',
              label: 'Retreaded',
              color: const Color(0xFFEAB308)),
          _vDivider(),
          _SummaryCell(
              value: '$removedCount',
              label: 'Removed',
              color: const Color(0xFFDC2626)),
        ],
      ),
    );
  }

  Widget _vDivider() => Container(
        width: 1,
        height: 28,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        color: KTColors.borderColor,
      );
}

class _SummaryCell extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _SummaryCell(
      {required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: KTColors.textMuted)),
        ],
      ),
    );
  }
}

// ─── Stock tyre card ──────────────────────────────────────────────────────────

class _StockTyreCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const _StockTyreCard({required this.data});

  @override
  ConsumerState<_StockTyreCard> createState() => _StockTyreCardState();
}

class _StockTyreCardState extends ConsumerState<_StockTyreCard> {
  bool _flagging = false;

  Future<void> _flagForRetreading() async {
    final tyreId = widget.data['id'] as int?;
    if (tyreId == null) return;
    setState(() => _flagging = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.post('/tyre/flag-retreading', data: {'tyre_id': tyreId});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tyre flagged for retreading'),
            backgroundColor: Color(0xFF7C3AED),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _flagging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stockType = ref.watch(_stockTypeProvider);
    final data = widget.data;
    final serial = data['serial_number'] ?? '—';
    final manufacturerSerial = (data['manufacturer_serial'] ?? '').toString();
    final model = (data['model'] ?? '').toString();
    final brand = data['brand'] ?? '—';
    final size = data['size'] ?? '';
    final condition = (data['condition'] ?? '').toString();
    final position = (data['position'] ?? '').toString().toUpperCase();
    final vehicle = (data['vehicle_number'] ?? '').toString();
    final kmRun = (data['km_run'] as num?)?.toDouble() ?? 0;
    final retreadCount = data['retread_count'] ?? 0;
    final cost = (data['purchase_cost'] as num?)?.toDouble() ?? 0;
    final tread = (data['tread_depth_mm'] as num?)?.toDouble();
    final lifePct = tread != null ? ((tread / 18.0) * 100.0).clamp(0.0, 100.0) : null;

    Color lifeColor(double pct) {
      if (pct >= 90) return const Color(0xFF16A34A);
      if (pct >= 70) return const Color(0xFF4ADE80);
      if (pct >= 50) return const Color(0xFF84CC16);
      if (pct >= 30) return const Color(0xFFEAB308);
      if (pct >= 10) return const Color(0xFFF97316);
      return const Color(0xFFDC2626);
    }

    Color condColor;
    switch (condition.toLowerCase()) {
      case 'new':
      case 'good':
        condColor = const Color(0xFF16A34A);
        break;
      case 'average':
        condColor = const Color(0xFFEAB308);
        break;
      case 'worn':
      case 'removed':
        condColor = const Color(0xFFF97316);
        break;
      default:
        condColor = const Color(0xFFDC2626);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: condColor.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child:
                  Icon(Icons.tire_repair_rounded, size: 20, color: condColor),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(
                              model.isNotEmpty ? model : serial.toString(),
                              style: KTTextStyles.body.copyWith(
                                fontWeight: FontWeight.w700,
                                color: KTColors.textHeading,
                                decoration: TextDecoration.none,
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (model.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              serial.toString(),
                              style: KTTextStyles.labelSmall.copyWith(
                                color: KTColors.textSecondary,
                                fontWeight: FontWeight.w600,
                                fontSize: 11,
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: condColor.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                            color: condColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        condition.isNotEmpty
                            ? condition[0].toUpperCase() +
                                condition.substring(1)
                            : '—',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: condColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '$brand${size.toString().isNotEmpty ? ' · $size' : ''}',
                  style: KTTextStyles.labelSmall.copyWith(
                      color: KTColors.textSecondary,
                      decoration: TextDecoration.none),
                ),
                if (lifePct != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: lifePct / 100.0,
                            minHeight: 5,
                            backgroundColor: lifeColor(lifePct).withValues(alpha: 0.15),
                            valueColor: AlwaysStoppedAnimation<Color>(lifeColor(lifePct)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${lifePct.toStringAsFixed(0)}%',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: lifeColor(lifePct),
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 4),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    if (manufacturerSerial.isNotEmpty)
                      _InfoTag(
                          icon: Icons.numbers_rounded,
                          text: manufacturerSerial),
                    if (vehicle.isNotEmpty)
                      _InfoTag(
                          icon: Icons.local_shipping_outlined,
                          text: vehicle),
                    if (position.isNotEmpty)
                      _InfoTag(
                          icon: Icons.pin_drop_outlined, text: position),
                    if (kmRun > 0)
                      _InfoTag(
                          icon: Icons.speed_outlined,
                          text: '${kmRun.toStringAsFixed(0)} km'),
                    if (retreadCount > 0)
                      _InfoTag(
                          icon: Icons.autorenew_rounded,
                          text:
                              '$retreadCount retread${retreadCount > 1 ? 's' : ''}'),
                    if (cost > 0)
                      _InfoTag(
                          icon: Icons.currency_rupee_outlined,
                          text: cost.toStringAsFixed(0)),
                  ],
                ),
                if (stockType == 'removed') ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _flagging ? null : _flagForRetreading,
                      icon: _flagging
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF7C3AED),
                              ),
                            )
                          : const Icon(Icons.autorenew_rounded, size: 16),
                      label: Text(_flagging ? 'Flagging...' : 'Flag for Retreading'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF7C3AED),
                        side: const BorderSide(color: Color(0xFF7C3AED)),
                        minimumSize: Size.zero,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        textStyle: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoTag extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoTag({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: KTColors.textMuted),
        const SizedBox(width: 3),
        Text(text,
            style: TextStyle(
                fontSize: 11,
                color: KTColors.textMuted,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? _accent : KTColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? _accent : KTColors.borderColor),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : KTColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
