import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/fleet_dashboard_provider.dart'; // For apiServiceProvider

class AssociateLRCreateScreen extends ConsumerStatefulWidget {
  final String? jobId; // Query param: ?job_id=
  const AssociateLRCreateScreen({super.key, this.jobId});

  @override
  ConsumerState<AssociateLRCreateScreen> createState() => _AssociateLRCreateScreenState();
}

class _AssociateLRCreateScreenState extends ConsumerState<AssociateLRCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  String? _generatedLrNumber; // Used to toggle success screen

  // Form Controllers
  final _consignorName = TextEditingController();
  final _consignorAddress = TextEditingController();
  final _consignorGst = TextEditingController();
  
  final _consigneeName = TextEditingController();
  final _consigneeAddress = TextEditingController();
  final _consigneeGst = TextEditingController();
  
  final _goodsDesc = TextEditingController();
  final _packagesCount = TextEditingController();
  final _weight = TextEditingController();
  final _goodsValue = TextEditingController();
  
  final _freightAmount = TextEditingController();
  String _paymentMode = 'To Pay';
  String _riskType = "Carrier's";
  final _notes = TextEditingController();

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return; //

    setState(() => _isLoading = true);

    try {
      final payload = { //
        "job_id": widget.jobId ?? "UNKNOWN_JOB",
        "consignor": {"name": _consignorName.text, "address": _consignorAddress.text, "gst": _consignorGst.text},
        "consignee": {"name": _consigneeName.text, "address": _consigneeAddress.text, "gst": _consigneeGst.text},
        "goods": {"description": _goodsDesc.text, "packages": int.parse(_packagesCount.text), "weight": double.parse(_weight.text), "value": double.parse(_goodsValue.text)},
        "freight_amount": double.parse(_freightAmount.text),
        "payment_mode": _paymentMode,
        "risk_type": _riskType,
        "notes": _notes.text,
      };

      // Mocking API call: POST /api/v1/lr
      await Future.delayed(const Duration(seconds: 2));
      final lrNumber = "KT-LR-2026-0899"; // Normally returned from API
      
      if (mounted) {
        setState(() => _generatedLrNumber = lrNumber); // Switch to success screen
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); //
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show success screen if LR is generated
    if (_generatedLrNumber != null) {
      return _buildSuccessScreen();
    }

    return Scaffold(
      appBar: AppBar(title: const Text("Create lorry receipt")), //
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSectionHeader("Job details"), //
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Job: ${widget.jobId ?? 'KT-2026-0042'}", style: KTTextStyles.h3),
                    const Text("Client: Acme Corp\nRoute: Chennai → Coimbatore\nVehicle: TN01AB1234"), // auto-filled, read-only
                  ],
                ),
              ),
            ),
            
            _buildSectionHeader("Consignor"), //
            TextFormField(controller: _consignorName, decoration: const InputDecoration(labelText: "Name"), validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _consignorAddress, decoration: const InputDecoration(labelText: "Address"), maxLines: 2, validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _consignorGst, decoration: const InputDecoration(labelText: "GSTIN"), validator: (val) => val!.length != 15 ? 'Invalid GSTIN' : null),

            _buildSectionHeader("Consignee"), //
            TextFormField(controller: _consigneeName, decoration: const InputDecoration(labelText: "Name"), validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _consigneeAddress, decoration: const InputDecoration(labelText: "Address"), maxLines: 2, validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _consigneeGst, decoration: const InputDecoration(labelText: "GSTIN"), validator: (val) => val!.length != 15 ? 'Invalid GSTIN' : null),

            _buildSectionHeader("Goods details"), //
            TextFormField(controller: _goodsDesc, decoration: const InputDecoration(labelText: "Description"), validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextFormField(controller: _packagesCount, decoration: const InputDecoration(labelText: "No. of packages"), keyboardType: TextInputType.number, validator: (val) => val!.isEmpty ? 'Required' : null)),
                const SizedBox(width: 12),
                Expanded(child: TextFormField(controller: _weight, decoration: const InputDecoration(labelText: "Weight (kg)"), keyboardType: TextInputType.number, validator: (val) => val!.isEmpty ? 'Required' : null)),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _goodsValue, decoration: const InputDecoration(labelText: "Value (₹)"), keyboardType: TextInputType.number, validator: (val) => val!.isEmpty ? 'Required' : null),

            _buildSectionHeader("Freight"), //
            TextFormField(controller: _freightAmount, decoration: const InputDecoration(labelText: "Freight amount (₹)"), keyboardType: TextInputType.number, validator: (val) => val!.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _paymentMode,
              decoration: const InputDecoration(labelText: "Payment mode"),
              items: ['Paid', 'To Pay', 'To Be Billed'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (val) => setState(() => _paymentMode = val!),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _riskType,
              decoration: const InputDecoration(labelText: "Risk"),
              items: ["Owner's", "Consignee's", "Carrier's"].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: (val) => setState(() => _riskType = val!),
            ),

            _buildSectionHeader("Notes"), //
            TextFormField(controller: _notes, decoration: const InputDecoration(labelText: "Additional notes (optional)"), maxLines: 2),

            const SizedBox(height: 32),
            ElevatedButton( //
              onPressed: _isLoading ? null : _submitForm, //
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary, padding: const EdgeInsets.symmetric(vertical: 16)),
              child: _isLoading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text("Generate LR", style: TextStyle(fontSize: 16)),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 12),
      child: Text(title.toUpperCase(), style: KTTextStyles.label.copyWith(color: KTColors.primaryDark, letterSpacing: 1.2)),
    );
  }

  Widget _buildSuccessScreen() { //
    return Scaffold(
      backgroundColor: KTColors.cardSurface,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle, color: KTColors.success, size: 80),
              const SizedBox(height: 24),
              Text("LR Generated Successfully", style: KTTextStyles.h2),
              const SizedBox(height: 16),
              Container( // LR number (large, colored box)
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(color: KTColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                child: SelectableText(_generatedLrNumber!, style: KTTextStyles.h1.copyWith(color: KTColors.primaryDark)),
              ),
              const SizedBox(height: 48),
              ElevatedButton.icon( // "Share LR" button (generates PDF → share_plus)
                onPressed: () => Share.share('Lorry Receipt: $_generatedLrNumber'), // Mock share
                icon: const Icon(Icons.share),
                label: const Text("Share LR PDF"),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon( // "Generate EWB for this LR" button → /associate/ewb/create?lr_id=X
                onPressed: () => context.pushReplacement('/associate/ewb/create?lr_id=$_generatedLrNumber'),
                icon: const Icon(Icons.fire_truck),
                label: const Text("Generate EWB for this LR"),
              ),
              const SizedBox(height: 32),
              TextButton( // "Back to home" button
                onPressed: () => context.go('/associate/home'),
                child: const Text("Back to home"),
              )
            ],
          ),
        ),
      ),
    );
  }
}