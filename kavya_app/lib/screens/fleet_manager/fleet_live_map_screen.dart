import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../providers/live_tracking_provider.dart';

class FleetLiveMapScreen extends ConsumerStatefulWidget {
  const FleetLiveMapScreen({super.key});

  @override
  ConsumerState<FleetLiveMapScreen> createState() => _FleetLiveMapScreenState();
}

class _FleetLiveMapScreenState extends ConsumerState<FleetLiveMapScreen> {
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
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.read(trackingProvider.notifier).refresh()),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap( // Google Maps widget fills screen [cite: 60]
            onMapCreated: _onMapCreated,
            initialCameraPosition: CameraPosition(target: _center, zoom: 11.0),
            markers: ref.watch(trackingProvider).filteredTrucks.map((truck) => Marker(
              markerId: MarkerId('truck_${truck.vehicleId}'),
              position: LatLng(truck.lat, truck.lng),
              onTap: _showVehicleDetailsBottomSheet,
              icon: BitmapDescriptor.defaultMarkerWithHue(
                truck.speed > 80
                    ? BitmapDescriptor.hueRed
                    : truck.speed > 5
                        ? BitmapDescriptor.hueGreen
                        : BitmapDescriptor.hueOrange,
              ),
            )).toSet(),
          ),
        ],
      ),
    );
  }
}