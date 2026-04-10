import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetCreateLRScreen extends ConsumerStatefulWidget {
  const FleetCreateLRScreen({super.key});

  @override
  ConsumerState<FleetCreateLRScreen> createState() =>
      _FleetCreateLRScreenState();
}

class _FleetCreateLRScreenState extends ConsumerState<FleetCreateLRScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;
  bool _loading = true;
  int _currentStep = 0;

  // ── Job selection ──
  List<Map<String, dynamic>> _jobs = [];
  int? _selectedJobId;
  Map<String, dynamic>? _selectedJob;

  // ── Consignor / Consignee ──
  final _consignorNameCtrl = TextEditingController();
  final _consignorGstinCtrl = TextEditingController();
  final _consignorAddressCtrl = TextEditingController();
  final _consignorPhoneCtrl = TextEditingController();
  final _consigneeNameCtrl = TextEditingController();
  final _consigneeGstinCtrl = TextEditingController();
  final _consigneeAddressCtrl = TextEditingController();
  final _consigneePhoneCtrl = TextEditingController();

  // ── Route ──
  final _originCtrl = TextEditingController();
  final _destinationCtrl = TextEditingController();

  // ── Cargo items ──
  final List<_CargoItem> _items = [_CargoItem()];

  // ── Charges ──
  String _paymentMode = 'to_be_billed';
  String _gstRate = '0';
  final _freightCtrl = TextEditingController();
  final _loadingChargesCtrl = TextEditingController();
  final _unloadingChargesCtrl = TextEditingController();
  final _detentionChargesCtrl = TextEditingController();
  final _otherChargesCtrl = TextEditingController();
  final _declaredValueCtrl = TextEditingController();

  // ── Vehicle & Driver assignment ──
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _drivers = [];
  int? _selectedVehicleId;
  int? _selectedDriverId;

  // ── Optional ──
  final _insuranceCompanyCtrl = TextEditingController();
  final _insurancePolicyCtrl = TextEditingController();
  final _insuranceAmountCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  final _specialInstructionsCtrl = TextEditingController();
  bool _autoCreateTrip = true;

  DateTime _lrDate = DateTime.now();

  static const _paymentModes = ['to_pay', 'paid', 'to_be_billed', 'fod'];
  static const _gstRates = ['0', '5', '12', '18', '28'];

  static final _gstinRegex =
      RegExp(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$');

  @override
  void initState() {
    super.initState();
    _loadLookups();
  }

  Future<void> _loadLookups() async {
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.get('/jobs'),
        api.get('/vehicles', queryParameters: {'status': 'available', 'limit': 100}),
        api.get('/drivers', queryParameters: {'status': 'available', 'limit': 100}),
      ]);

      final jPayload = results[0];
      final vPayload =
          (results[1] is Map && results[1]['data'] != null) ? results[1]['data'] : results[1];
      final dPayload =
          (results[2] is Map && results[2]['data'] != null) ? results[2]['data'] : results[2];

      if (mounted) {
        setState(() {
          _jobs = (jPayload is List)
              ? List<Map<String, dynamic>>.from(jPayload)
              : [];
          _vehicles = (vPayload is List)
              ? List<Map<String, dynamic>>.from(vPayload)
              : [];
          _drivers = (dPayload is List)
              ? List<Map<String, dynamic>>.from(dPayload)
              : [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not load form data: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    for (final c in [
      _consignorNameCtrl, _consignorGstinCtrl, _consignorAddressCtrl,
      _consignorPhoneCtrl, _consigneeNameCtrl, _consigneeGstinCtrl,
      _consigneeAddressCtrl, _consigneePhoneCtrl, _originCtrl,
      _destinationCtrl, _freightCtrl, _loadingChargesCtrl,
      _unloadingChargesCtrl, _detentionChargesCtrl, _otherChargesCtrl,
      _declaredValueCtrl, _insuranceCompanyCtrl, _insurancePolicyCtrl,
      _insuranceAmountCtrl, _remarksCtrl, _specialInstructionsCtrl,
    ]) {
      c.dispose();
    }
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _onJobSelected(int? jobId) {
    setState(() {
      _selectedJobId = jobId;
      _selectedJob = _jobs.firstWhere(
        (j) => j['id'] == jobId,
        orElse: () => <String, dynamic>{},
      );
      // Auto-fill from job
      if (_selectedJob != null) {
        _originCtrl.text = _selectedJob!['origin']?.toString() ?? '';
        _destinationCtrl.text = _selectedJob!['destination']?.toString() ?? '';
        final clientName = _selectedJob!['client_name']?.toString() ?? '';
        if (clientName.isNotEmpty && _consigneeNameCtrl.text.isEmpty) {
          _consigneeNameCtrl.text = clientName;
        }
      }
    });
  }

  double get _subtotal {
    final freight = double.tryParse(_freightCtrl.text) ?? 0;
    final loading = double.tryParse(_loadingChargesCtrl.text) ?? 0;
    final unloading = double.tryParse(_unloadingChargesCtrl.text) ?? 0;
    final detention = double.tryParse(_detentionChargesCtrl.text) ?? 0;
    final other = double.tryParse(_otherChargesCtrl.text) ?? 0;
    return freight + loading + unloading + detention + other;
  }

  double get _gstAmount {
    final rate = double.tryParse(_gstRate) ?? 0;
    return _subtotal * rate / 100;
  }

  double get _grandTotal => _subtotal + _gstAmount;

  String? _validateGstin(String? v) {
    if (v == null || v.trim().isEmpty) return null; // optional
    if (!_gstinRegex.hasMatch(v.trim().toUpperCase())) return 'Invalid GSTIN';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedJobId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a job')),
      );
      return;
    }

    if (_autoCreateTrip && (_selectedVehicleId == null || _selectedDriverId == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select vehicle and driver for trip creation')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final api = ref.read(apiServiceProvider);

      // Build LR items
      final lrItems = _items
          .where((item) => item.descriptionCtrl.text.trim().isNotEmpty)
          .map((item) => {
                'description': item.descriptionCtrl.text.trim(),
                'hsn_code': item.hsnCtrl.text.trim(),
                'no_of_packages': int.tryParse(item.packagesCtrl.text) ?? 0,
                'package_type': item.packageType,
                'quantity': double.tryParse(item.quantityCtrl.text) ?? 0,
                'unit': item.unit,
                'actual_weight_kg': double.tryParse(item.actualWeightCtrl.text) ?? 0,
                'charged_weight_kg': double.tryParse(item.chargedWeightCtrl.text) ?? 0,
                'rate': double.tryParse(item.rateCtrl.text) ?? 0,
              })
          .toList();

      // Create LR
      final lrData = {
        'lr_date': _lrDate.toIso8601String().split('T').first,
        'job_id': _selectedJobId,
        'consignor_name': _consignorNameCtrl.text.trim(),
        'consignor_gstin': _consignorGstinCtrl.text.trim().toUpperCase(),
        'consignor_address': _consignorAddressCtrl.text.trim(),
        'consignor_phone': _consignorPhoneCtrl.text.trim(),
        'consignee_name': _consigneeNameCtrl.text.trim(),
        'consignee_gstin': _consigneeGstinCtrl.text.trim().toUpperCase(),
        'consignee_address': _consigneeAddressCtrl.text.trim(),
        'consignee_phone': _consigneePhoneCtrl.text.trim(),
        'origin': _originCtrl.text.trim(),
        'destination': _destinationCtrl.text.trim(),
        'payment_mode': _paymentMode,
        'freight_amount': double.tryParse(_freightCtrl.text) ?? 0,
        'loading_charges': double.tryParse(_loadingChargesCtrl.text) ?? 0,
        'unloading_charges': double.tryParse(_unloadingChargesCtrl.text) ?? 0,
        'detention_charges': double.tryParse(_detentionChargesCtrl.text) ?? 0,
        'other_charges': double.tryParse(_otherChargesCtrl.text) ?? 0,
        'declared_value': double.tryParse(_declaredValueCtrl.text),
        'insurance_company': _insuranceCompanyCtrl.text.trim(),
        'insurance_policy_number': _insurancePolicyCtrl.text.trim(),
        'insurance_amount': double.tryParse(_insuranceAmountCtrl.text),
        'remarks': _remarksCtrl.text.trim(),
        'special_instructions': _specialInstructionsCtrl.text.trim(),
        'items': lrItems,
      };

      final lrResp = await api.post('/lr', data: lrData);
      final lrId = lrResp?['data']?['id'] ?? lrResp?['id'];

      // Auto-create trip linked to this LR
      if (_autoCreateTrip && lrId != null && _selectedVehicleId != null && _selectedDriverId != null) {
        await api.post('/trips', data: {
          'vehicle_id': _selectedVehicleId,
          'driver_id': _selectedDriverId,
          'origin': _originCtrl.text.trim(),
          'destination': _destinationCtrl.text.trim(),
          'trip_date': _lrDate.toIso8601String().split('T').first,
          'lr_ids': [lrId],
          'job_id': _selectedJobId,
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_autoCreateTrip
                ? 'LR created and trip assigned to driver'
                : 'LR created successfully'),
            backgroundColor: KTColors.success,
          ),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.lightBg,
      appBar: AppBar(
        backgroundColor: KTColors.surface,
        foregroundColor: KTColors.textHeading,
        elevation: 0,
        title: Text('Create LR',
            style: KTTextStyles.h2
                .copyWith(color: KTColors.textHeading, decoration: TextDecoration.none)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: Column(
                children: [
                  // ─── Step Indicator ──
                  _stepIndicator(),
                  // ─── Step Content ──
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: _buildCurrentStep(),
                    ),
                  ),
                  // ─── Navigation Buttons ──
                  _navigationButtons(),
                ],
              ),
            ),
    );
  }

  Widget _stepIndicator() {
    const steps = ['Parties', 'Route & Cargo', 'Charges', 'Assignment', 'Notes'];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      color: KTColors.surface,
      child: Row(
        children: List.generate(steps.length, (i) {
          final active = i == _currentStep;
          final completed = i < _currentStep;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                if (i < _currentStep) setState(() => _currentStep = i);
              },
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: completed
                        ? KTColors.success
                        : active
                            ? KTColors.fleetAccent
                            : KTColors.borderColor,
                    child: completed
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : Text('${i + 1}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: active ? Colors.white : KTColors.textMuted,
                            )),
                  ),
                  const SizedBox(height: 4),
                  Text(steps[i],
                      style: KTTextStyles.labelSmall.copyWith(
                        color: active ? KTColors.fleetAccent : KTColors.textMuted,
                        fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                      ),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case 0:
        return _stepParties();
      case 1:
        return _stepRouteCargo();
      case 2:
        return _stepCharges();
      case 3:
        return _stepAssignment();
      case 4:
        return _stepNotes();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _navigationButtons() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: KTColors.surface,
        border: Border(top: BorderSide(color: KTColors.borderColor)),
      ),
      child: Row(
        children: [
          if (_currentStep > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _currentStep--),
                style: OutlinedButton.styleFrom(
                  foregroundColor: KTColors.fleetAccent,
                  side: const BorderSide(color: KTColors.fleetAccent),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Back'),
              ),
            ),
          if (_currentStep > 0) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _saving
                  ? null
                  : () {
                      if (_currentStep < 4) {
                        setState(() => _currentStep++);
                      } else {
                        _submit();
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: KTColors.fleetAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(
                      _currentStep < 4 ? 'Next' : 'Create LR & Assign Trip',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Parties (Job, Consignor, Consignee)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _stepParties() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Select Job'),
        const SizedBox(height: 8),
        DropdownButtonFormField<int>(
          value: _selectedJobId,
          dropdownColor: KTColors.surface,
          style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
          hint: Text('Choose a job', style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
          decoration: _dropDecor('Job *'),
          isExpanded: true,
          items: _jobs.map((j) {
            final jobNum = j['job_number'] ?? '#${j['id']}';
            final client = j['client_name'] ?? '';
            final route = '${j['origin'] ?? ''} → ${j['destination'] ?? ''}';
            return DropdownMenuItem<int>(
              value: j['id'] as int?,
              child: Text('$jobNum${client.isNotEmpty ? ' · $client' : ''}\n$route',
                  style: const TextStyle(fontSize: 13)),
            );
          }).toList(),
          onChanged: _onJobSelected,
          validator: (v) => v == null ? 'Select a job' : null,
        ),
        const SizedBox(height: 8),
        // LR Date
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _lrDate,
              firstDate: DateTime.now().subtract(const Duration(days: 7)),
              lastDate: DateTime.now().add(const Duration(days: 30)),
            );
            if (picked != null) setState(() => _lrDate = picked);
          },
          child: _readonlyField(
            'LR Date',
            '${_lrDate.year}-${_lrDate.month.toString().padLeft(2, '0')}-${_lrDate.day.toString().padLeft(2, '0')}',
            Icons.calendar_today,
          ),
        ),
        const SizedBox(height: 16),

        _sectionLabel('Consignor (Sender)'),
        const SizedBox(height: 8),
        _textField('Consignor Name *', _consignorNameCtrl,
            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null),
        _textField('GSTIN', _consignorGstinCtrl,
            hint: '22AAAAA0000A1Z5',
            capitalization: TextCapitalization.characters,
            validator: _validateGstin),
        _textField('Address', _consignorAddressCtrl),
        _textField('Phone', _consignorPhoneCtrl, keyboard: TextInputType.phone),
        const SizedBox(height: 16),

        _sectionLabel('Consignee (Receiver)'),
        const SizedBox(height: 8),
        _textField('Consignee Name *', _consigneeNameCtrl,
            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null),
        _textField('GSTIN', _consigneeGstinCtrl,
            hint: '22AAAAA0000A1Z5',
            capitalization: TextCapitalization.characters,
            validator: _validateGstin),
        _textField('Address', _consigneeAddressCtrl),
        _textField('Phone', _consigneePhoneCtrl, keyboard: TextInputType.phone),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Route & Cargo Items
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _stepRouteCargo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Route'),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: _textField('Origin *', _originCtrl,
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _textField('Destination *', _destinationCtrl,
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null),
          ),
        ]),
        const SizedBox(height: 16),

        _sectionLabel('Cargo Items'),
        const SizedBox(height: 8),
        ..._items.asMap().entries.map((entry) => _cargoItemCard(entry.key)),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => setState(() => _items.add(_CargoItem())),
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Add Item'),
          style: OutlinedButton.styleFrom(
            foregroundColor: KTColors.fleetAccent,
            side: const BorderSide(color: KTColors.fleetAccent),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ],
    );
  }

  Widget _cargoItemCard(int index) {
    final item = _items[index];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Item ${index + 1}',
                  style: KTTextStyles.label.copyWith(
                      color: KTColors.fleetAccent, fontWeight: FontWeight.w600)),
              if (_items.length > 1)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: KTColors.danger, size: 20),
                  onPressed: () => setState(() {
                    _items[index].dispose();
                    _items.removeAt(index);
                  }),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
            ],
          ),
          const SizedBox(height: 8),
          _textField('Description', item.descriptionCtrl),
          Row(children: [
            Expanded(child: _textField('HSN Code', item.hsnCtrl)),
            const SizedBox(width: 8),
            Expanded(
              child: _textField('No. of Packages', item.packagesCtrl,
                  keyboard: TextInputType.number),
            ),
          ]),
          Row(children: [
            Expanded(
              child: _textField('Actual Weight (kg)', item.actualWeightCtrl,
                  keyboard: TextInputType.number),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _textField('Charged Weight (kg)', item.chargedWeightCtrl,
                  keyboard: TextInputType.number),
            ),
          ]),
          Row(children: [
            Expanded(
              child: _textField('Rate (₹)', item.rateCtrl,
                  keyboard: TextInputType.number),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _textField('Quantity', item.quantityCtrl,
                  keyboard: TextInputType.number),
            ),
          ]),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Charges & Pricing
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _stepCharges() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Payment & GST'),
        const SizedBox(height: 8),
        _dropdown('Payment Mode', _paymentMode, _paymentModes,
            (v) => setState(() => _paymentMode = v!)),
        _dropdown('GST Rate (%)', _gstRate, _gstRates,
            (v) => setState(() => _gstRate = v!)),
        const SizedBox(height: 16),

        _sectionLabel('Charges'),
        const SizedBox(height: 8),
        _textField('Freight Amount (₹) *', _freightCtrl,
            keyboard: TextInputType.number,
            onChanged: (_) => setState(() {}),
            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null),
        Row(children: [
          Expanded(
            child: _textField('Loading (₹)', _loadingChargesCtrl,
                keyboard: TextInputType.number, onChanged: (_) => setState(() {})),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _textField('Unloading (₹)', _unloadingChargesCtrl,
                keyboard: TextInputType.number, onChanged: (_) => setState(() {})),
          ),
        ]),
        Row(children: [
          Expanded(
            child: _textField('Detention (₹)', _detentionChargesCtrl,
                keyboard: TextInputType.number, onChanged: (_) => setState(() {})),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _textField('Other (₹)', _otherChargesCtrl,
                keyboard: TextInputType.number, onChanged: (_) => setState(() {})),
          ),
        ]),
        _textField('Declared Value (₹)', _declaredValueCtrl,
            keyboard: TextInputType.number),
        const SizedBox(height: 16),

        // Price summary
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: KTColors.fleetAccent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: KTColors.fleetAccent.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              _summaryRow('Subtotal', '₹${_subtotal.toStringAsFixed(2)}'),
              if (_gstAmount > 0)
                _summaryRow('GST ($_gstRate%)', '₹${_gstAmount.toStringAsFixed(2)}'),
              const Divider(color: KTColors.borderColor),
              _summaryRow('Grand Total', '₹${_grandTotal.toStringAsFixed(2)}',
                  bold: true, color: KTColors.fleetAccent),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: KTTextStyles.body.copyWith(
                  color: color ?? KTColors.textHeading,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
          Text(value,
              style: KTTextStyles.body.copyWith(
                  color: color ?? KTColors.textHeading,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                  fontSize: bold ? 18 : 14)),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Vehicle & Driver Assignment
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _stepAssignment() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Auto-create trip toggle
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: KTColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: KTColors.borderColor),
          ),
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Create Trip & Assign Driver',
                style: KTTextStyles.body.copyWith(color: KTColors.textHeading)),
            subtitle: Text('Auto-creates a trip from this LR and assigns to selected driver',
                style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted)),
            value: _autoCreateTrip,
            activeThumbColor: KTColors.fleetAccent,
            onChanged: (v) => setState(() => _autoCreateTrip = v),
          ),
        ),
        const SizedBox(height: 16),

        if (_autoCreateTrip) ...[
          _sectionLabel('Vehicle'),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            value: _selectedVehicleId,
            dropdownColor: KTColors.surface,
            style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
            hint: Text('Select Vehicle',
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            decoration: _dropDecor('Vehicle *'),
            isExpanded: true,
            items: _vehicles.map((v) {
              final reg = v['registration_number'] ?? v['reg_number'] ?? '#${v['id']}';
              final make = v['make'] ?? '';
              final cap = v['capacity_tons'];
              return DropdownMenuItem<int>(
                value: v['id'] as int?,
                child: Text(
                    '$reg${make.isNotEmpty ? ' ($make)' : ''}${cap != null ? ' · ${cap}T' : ''}'),
              );
            }).toList(),
            onChanged: (v) => setState(() => _selectedVehicleId = v),
            validator: _autoCreateTrip ? (v) => v == null ? 'Select a vehicle' : null : null,
          ),
          const SizedBox(height: 12),

          _sectionLabel('Driver'),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            value: _selectedDriverId,
            dropdownColor: KTColors.surface,
            style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
            hint: Text('Select Driver',
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            decoration: _dropDecor('Driver *'),
            isExpanded: true,
            items: _drivers.map((d) {
              final name = '${d['first_name'] ?? ''} ${d['last_name'] ?? ''}'.trim();
              final phone = d['phone'] ?? '';
              return DropdownMenuItem<int>(
                value: d['id'] as int?,
                child: Text(
                    '${name.isNotEmpty ? name : 'Driver #${d['id']}'}${phone.isNotEmpty ? ' · $phone' : ''}'),
              );
            }).toList(),
            onChanged: (v) => setState(() => _selectedDriverId = v),
            validator: _autoCreateTrip ? (v) => v == null ? 'Select a driver' : null : null,
          ),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: KTColors.info.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: KTColors.info.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: KTColors.info, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'LR will be saved as draft. You can assign a vehicle and driver later via the website.',
                    style: KTTextStyles.body.copyWith(color: KTColors.info, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Insurance & Notes
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _stepNotes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Insurance (Optional)'),
        const SizedBox(height: 8),
        _textField('Insurance Company', _insuranceCompanyCtrl),
        _textField('Policy Number', _insurancePolicyCtrl),
        _textField('Insured Amount (₹)', _insuranceAmountCtrl,
            keyboard: TextInputType.number),
        const SizedBox(height: 16),
        _sectionLabel('Notes (Optional)'),
        const SizedBox(height: 8),
        _textField('Remarks', _remarksCtrl, maxLines: 3),
        _textField('Special Instructions', _specialInstructionsCtrl, maxLines: 3),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Shared widgets
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _sectionLabel(String text) {
    return Text(text,
        style: KTTextStyles.h3.copyWith(color: KTColors.fleetAccent, decoration: TextDecoration.none));
  }

  Widget _readonlyField(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: KTTextStyles.label.copyWith(color: KTColors.textMuted, fontSize: 11)),
                const SizedBox(height: 2),
                Text(value, style: KTTextStyles.body.copyWith(color: KTColors.textHeading, fontWeight: FontWeight.w600)),
              ],
            ),
            Icon(icon, size: 18, color: KTColors.fleetAccent),
          ],
        ),
      ),
    );
  }

  Widget _textField(String label, TextEditingController ctrl,
      {TextInputType keyboard = TextInputType.text,
      String? hint,
      TextCapitalization capitalization = TextCapitalization.none,
      String? Function(String?)? validator,
      int maxLines = 1,
      ValueChanged<String>? onChanged}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        textCapitalization: capitalization,
        maxLines: maxLines,
        validator: validator,
        onChanged: onChanged,
        style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          hintStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted, fontSize: 12),
          labelStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
          filled: true,
          fillColor: KTColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.fleetAccent),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: KTColors.danger),
          ),
        ),
      ),
    );
  }

  Widget _dropdown(String label, String current, List<String> options,
      ValueChanged<String?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        value: current,
        dropdownColor: KTColors.surface,
        style: KTTextStyles.body.copyWith(color: KTColors.textHeading),
        decoration: _dropDecor(label),
        items: options
            .map((o) => DropdownMenuItem(
                value: o,
                child: Text(o.replaceAll('_', ' ').toUpperCase())))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

  InputDecoration _dropDecor(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: KTTextStyles.label.copyWith(color: KTColors.textMuted),
      filled: true,
      fillColor: KTColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: KTColors.borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: KTColors.borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: KTColors.fleetAccent),
      ),
    );
  }
}

// ── Cargo item model ──────────────────────────────────────────────────────────
class _CargoItem {
  final descriptionCtrl = TextEditingController();
  final hsnCtrl = TextEditingController();
  final packagesCtrl = TextEditingController();
  final quantityCtrl = TextEditingController();
  final actualWeightCtrl = TextEditingController();
  final chargedWeightCtrl = TextEditingController();
  final rateCtrl = TextEditingController();
  String packageType = 'boxes';
  String unit = 'kgs';

  void dispose() {
    descriptionCtrl.dispose();
    hsnCtrl.dispose();
    packagesCtrl.dispose();
    quantityCtrl.dispose();
    actualWeightCtrl.dispose();
    chargedWeightCtrl.dispose();
    rateCtrl.dispose();
  }
}
