import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../providers/fleet_dashboard_provider.dart';

class FleetServiceLogScreen extends ConsumerStatefulWidget {
  const FleetServiceLogScreen({super.key});

  @override
  ConsumerState<FleetServiceLogScreen> createState() => _FleetServiceLogScreenState();
}

class _FleetServiceLogScreenState extends ConsumerState<FleetServiceLogScreen> {
  final _formKey = GlobalKey<FormState>(); // [cite: 116]
  bool _isLoading = false; // [cite: 116]

  String? _selectedVehicle;
  String? _selectedServiceType;
  DateTime _selectedDate = DateTime.now(); // [cite: 70]
  
  final _odoController = TextEditingController();
  final _providerController = TextEditingController();
  final _costController = TextEditingController();
  final _notesController = TextEditingController();

  final List<String> _serviceTypes = ['Engine oil', 'Tyres', 'Brake', 'AC', 'Body', 'Other']; // [cite: 70]
  final DateFormat _dateFormat = DateFormat('dd MMM yyyy'); // [cite: 115]

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate() || _selectedVehicle == null || _selectedServiceType == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all required fields'), backgroundColor: KTColors.danger)); // [cite: 116-117]
      return;
    }

    setState(() => _isLoading = true); // [cite: 116]

    try {
      final payload = { // [cite: 70]
        "vehicle_id": _selectedVehicle,
        "service_type": _selectedServiceType,
        "date": _selectedDate.toIso8601String(),
        "odometer_km": int.parse(_odoController.text),
        "provider": _providerController.text,
        "cost": double.parse(_costController.text),
        "notes": _notesController.text,
      };

      await ref.read(apiServiceProvider).logService(payload); // [cite: 33, 70]
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Service logged successfully'), backgroundColor: KTColors.success)); // [cite: 70, 117]
        Navigator.pop(context); // pop back to vehicle detail [cite: 70-71]
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: KTColors.danger)); // [cite: 117]
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Log service")), // [cite: 70]
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Vehicle"), // [cite: 70]
              items: ['TN01AB1234', 'TN02CD5678'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(), // Placeholder for searchable dropdown
              onChanged: (val) => setState(() => _selectedVehicle = val),
              validator: (val) => val == null ? 'Select a vehicle' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Service type"), // [cite: 70]
              items: _serviceTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: (val) => setState(() => _selectedServiceType = val),
              validator: (val) => val == null ? 'Select a service type' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("Service Date"), // [cite: 70]
              subtitle: Text(_dateFormat.format(_selectedDate)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final date = await showDatePicker(context: context, initialDate: _selectedDate, firstDate: DateTime(2020), lastDate: DateTime.now());
                if (date != null) setState(() => _selectedDate = date);
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _odoController,
              decoration: const InputDecoration(labelText: "Odometer at service (km)"), // [cite: 70]
              keyboardType: TextInputType.number,
              validator: (val) => val!.isEmpty ? 'Required' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _providerController,
              decoration: const InputDecoration(labelText: "Service provider name"), // [cite: 70]
              validator: (val) => val!.isEmpty ? 'Required' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _costController,
              decoration: const InputDecoration(labelText: "Cost (₹)", prefixText: "₹ "), // [cite: 70]
              keyboardType: TextInputType.number,
              validator: (val) => val!.isEmpty ? 'Required' : null, // [cite: 116]
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: "Notes"), // [cite: 70]
              maxLines: 3,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isLoading ? null : _submitForm, // Disable submit button while loading [cite: 116]
              child: _isLoading 
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) // [cite: 110]
                : const Text("Submit"), // [cite: 70]
            )
          ],
        ),
      ),
    );
  }
}