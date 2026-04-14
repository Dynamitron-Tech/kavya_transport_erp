import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/theme/kt_text_styles.dart';

class FleetLiveMapScreen extends StatefulWidget {
  const FleetLiveMapScreen({super.key});

  @override
  State<FleetLiveMapScreen> createState() => _FleetLiveMapScreenState();
}

class _FleetLiveMapScreenState extends State<FleetLiveMapScreen> {
  final LatLng _center = const LatLng(13.0827, 80.2707); // Placeholder for Chennai
  GoogleMapController? mapController;

  void _onMapCreated(GoogleMapController controller) {
    mapController = controller;
  }

  void _showVehicleDetailsBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet( // uses DraggableScrollableSheet (min 10%, max 60%) [cite: 61]
        initialChildSize: 0.3,
        minChildSize: 0.1,
        maxChildSize: 0.6,
        builder: (_, controller) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: controller,
            children: [
              Text("TN01AB1234", style: KTTextStyles.h1), // Vehicle number (large) [cite: 60]
              const SizedBox(height: 8),
              Text("Driver: Kumar", style: KTTextStyles.body), // Driver name [cite: 60]
              const SizedBox(height: 4),
              Text("Speed: 45 km/h • Updated 2 min ago", style: KTTextStyles.bodySmall), // Speed + last update time [cite: 60]
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {}, // "View details" button → /fleet/vehicle/:id [cite: 60]
                child: const Text("View details"),
              )
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Live tracking"), // AppBar: "Live tracking" + refresh icon [cite: 60]
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () {}),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap( // Google Maps widget fills screen [cite: 60]
            onMapCreated: _onMapCreated,
            initialCameraPosition: CameraPosition(target: _center, zoom: 11.0),
            markers: {
              Marker(
                markerId: const MarkerId('truck_1'),
                position: _center,
                onTap: _showVehicleDetailsBottomSheet, // Tap marker → bottom sheet slides up [cite: 60]
                icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen), // Color: green = moving [cite: 60]
              )
            },
          ),
        ],
      ),
    );
  }
}