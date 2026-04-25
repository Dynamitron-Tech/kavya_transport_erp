import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetTyreEventScreen extends ConsumerStatefulWidget {
  const FleetTyreEventScreen({super.key});

  @override
  ConsumerState<FleetTyreEventScreen> createState() => _FleetTyreEventScreenState();
}

class _FleetTyreEventScreenState extends ConsumerState<FleetTyreEventScreen> {
  final _formKey = GlobalKey<FormState>(); // [cite: 116]
  bool _isLoading = false; // [cite: 116]

  String? _selectedVehicle;
  String? _selectedPosition;
  String? _selectedEvent;
  
  final _psiController = TextEditingController();
  final _odoController = TextEditingController();
  final _notesController = TextEditingController();

  final List<String> _positions = ['FL', 'FR', 'RL', 'RR', 'Spare']; // 
  final List<String> _events = ['PSI check', 'Rotation', 'Replacement', 'Puncture']; // 

  bool get _requiresPsi => _selectedEvent == 'PSI check' || _selectedEvent == 'Puncture'; // 

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate() || _selectedVehicle == null || _selectedPosition == null || _selectedEvent == null) {
      return; // Validation caught [cite: 116]
    }

    setState(() => _isLoading = true); // [cite: 116]

    try {
      final payload = { // 
        "tyre_id": "${_selectedVehicle}_$_selectedPosition", // Mock ID creation
        "event_type": _selectedEvent,
        "psi": _requiresPsi ? int.parse(_psiController.text) : null,
        "odometer_km": int.parse(_odoController.text),
        "notes": _notesController.text,
      };

      await ref.read(apiServiceProvider).recordTyreEvent(payload); // [cite: 33, 71]
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tyre event recorded'), backgroundColor: KTColors.success)); // [cite: 117]
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Record tyre event")), // 
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Vehicle"), // 
              items: ['TN01AB1234'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
              onChanged: (val) => setState(() => _selectedVehicle = val),
              validator: (val) => val == null ? 'Required' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Position"), // 
                    items: _positions.map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
                    onChanged: (val) => setState(() => _selectedPosition = val),
                    validator: (val) => val == null ? 'Required' : null, // [cite: 116]
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Event type"), // 
                    items: _events.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                    onChanged: (val) => setState(() => _selectedEvent = val),
                    validator: (val) => val == null ? 'Required' : null, // [cite: 116]
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_requiresPsi) ...[ // 
              TextFormField(
                controller: _psiController,
                decoration: const InputDecoration(labelText: "Current PSI"), // 
                keyboardType: TextInputType.number,
                validator: (val) => val!.isEmpty ? 'Required' : null, // [cite: 116]
              ),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _odoController,
              decoration: const InputDecoration(labelText: "Odometer at event"), // 
              keyboardType: TextInputType.number,
              validator: (val) => val!.isEmpty ? 'Required' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: "Notes"), // 
              maxLines: 2,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isLoading ? null : _submitForm, // Disable submit button while loading [cite: 116]
              child: _isLoading 
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) // [cite: 110]
                : const Text("Submit"), // 
            )
          ],
        ),
      ),
    );
  }
}