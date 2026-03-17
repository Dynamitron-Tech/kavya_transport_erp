import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/trip.dart';
import '../../providers/trip_provider.dart';
import '../../services/location_service.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';

final locationServiceProvider = Provider((ref) => LocationService());

final currentPositionProvider = StreamProvider.autoDispose((ref) async* {
  final locationService = ref.watch(locationServiceProvider);
  
  // Get initial position
  final position = await locationService.getCurrentPosition();
  if (position != null) {
    yield position;
  }

  // Stream position updates
  await for (final position in Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10, // Update on 10m movement
    ),
  )) {
    yield position;
  }
});

final isTrackingProvider = StateProvider<bool>((ref) => false);

class DriverGpsTrackingScreen extends ConsumerStatefulWidget {
  final int tripId;

  const DriverGpsTrackingScreen({super.key, required this.tripId});

  @override
  ConsumerState<DriverGpsTrackingScreen> createState() => _DriverGpsTrackingScreenState();
}

class _DriverGpsTrackingScreenState extends ConsumerState<DriverGpsTrackingScreen> {
  late GoogleMapController _mapController;
  double _distanceTraveled = 0;
  double _currentSpeed = 0;

  @override
  void initState() {
    super.initState();
    _initializeTracking();
  }

  void _initializeTracking() async {
    final locationService = ref.read(locationServiceProvider);
    final hasPermission = await locationService.requestPermission();
    
    if (hasPermission) {
      ref.read(isTrackingProvider.notifier).state = true;
      locationService.startTracking(vehicleId: 'vehicle_${widget.tripId}');
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission denied')),
        );
      }
    }
  }

  @override
  void dispose() {
    final locationService = ref.read(locationServiceProvider);
    locationService.stopTracking();
    super.dispose();
  }

  void _toggleTracking() {
    final isTracking = ref.read(isTrackingProvider);
    final locationService = ref.read(locationServiceProvider);

    if (isTracking) {
      locationService.stopTracking();
    } else {
      locationService.startTracking(vehicleId: 'vehicle_${widget.tripId}');
    }

    ref.read(isTrackingProvider.notifier).state = !isTracking;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripAsync = ref.watch(tripDetailProvider(widget.tripId));
    final positionAsync = ref.watch(currentPositionProvider);
    final isTracking = ref.watch(isTrackingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Trip - Live Tracking'),
        elevation: 2,
      ),
      body: tripAsync.when(
        data: (trip) => positionAsync.when(
          data: (position) => _buildMap(context, ref, trip, position, isTracking),
          loading: () => _buildLoadingMap(context, trip),
          error: (e, st) => _buildMapError(context, trip, e),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => _buildTripError(context, e),
      ),
    );
  }

  Widget _buildMap(
    BuildContext context,
    WidgetRef ref,
    Trip trip,
    Position position,
    bool isTracking,
  ) {
    // Parse origin and destination coordinates (format: "lat,lng")
    final originCoords = _parseCoordinates(trip.origin);
    final destCoords = _parseCoordinates(trip.destination);

    final currentLocation = LatLng(position.latitude, position.longitude);
    final originLocation = LatLng(originCoords['lat']!, originCoords['lng']!);
    final destLocation = LatLng(destCoords['lat']!, destCoords['lng']!);

    return Column(
      children: [
        // Map
        Expanded(
          flex: 2,
          child: GoogleMap(
            initialCameraPosition: CameraPosition(
              target: currentLocation,
              zoom: 15,
            ),
            onMapCreated: (controller) {
              _mapController = controller;
              _fitBounds(controller, [originLocation, currentLocation, destLocation]);
            },
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            compassEnabled: true,
            markers: {
              Marker(
                markerId: const MarkerId('origin'),
                position: originLocation,
                infoWindow: InfoWindow(title: trip.origin),
                icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
              ),
              Marker(
                markerId: const MarkerId('current'),
                position: currentLocation,
                infoWindow: const InfoWindow(title: 'Current Location'),
                icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
              ),
              Marker(
                markerId: const MarkerId('destination'),
                position: destLocation,
                infoWindow: InfoWindow(title: trip.destination),
                icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
              ),
            },
            polylines: {
              Polyline(
                polylineId: const PolylineId('route'),
                points: [originLocation, currentLocation, destLocation],
                color: KTColors.primary,
                width: 3,
              ),
            },
          ),
        ),
        // Trip Info
        Expanded(
          flex: 1,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Trip Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Trip: ${trip.tripNumber}',
                          style: KTTextStyles.h3,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Status: ${trip.status.toUpperCase()}',
                          style: TextStyle(
                            fontSize: 12,
                            color: _getStatusColor(trip.status),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isTracking ? KTColors.success : KTColors.warning,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isTracking ? '● Tracking' : '⊘ Paused',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Location Info
                _buildInfoRow('From:', trip.origin),
                _buildInfoRow('To:', trip.destination),
                const SizedBox(height: 12),
                // Speed & Distance
                Row(
                  children: [
                    Expanded(
                      child: _buildMetricCard(
                        'Speed',
                        '${position.speed.toStringAsFixed(1)} m/s',
                        Icons.speed,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildMetricCard(
                        'Heading',
                        '${position.heading.toStringAsFixed(0)}°',
                        Icons.navigation,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Control Buttons
                Row(
                  children: [
                    Expanded(
                      child: KTButton(
                        label: isTracking ? 'Pause Tracking' : 'Resume Tracking',
                        onPressed: _toggleTracking,
                        backgroundColor: isTracking ? KTColors.warning : KTColors.success,
                        icon: Icons.gps_fixed,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: KTButton(
                        label: 'Complete Trip',
                        onPressed: trip.status == 'in_transit'
                            ? () => _showCompleteConfirmation(context, ref, trip)
                            : null,
                        backgroundColor: KTColors.success,
                        icon: Icons.check_circle,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingMap(BuildContext context, Trip trip) {
    return Column(
      children: [
        Expanded(
          flex: 2,
          child: Container(
            color: Colors.grey[200],
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Getting location...'),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          flex: 1,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow('From:', trip.origin),
                _buildInfoRow('To:', trip.destination),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMapError(BuildContext context, Trip trip, Object error) {
    return Column(
      children: [
        Expanded(
          flex: 2,
          child: Container(
            color: Colors.grey[200],
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_off, size: 48, color: KTColors.danger),
                  const SizedBox(height: 16),
                  const Text('Could not get location'),
                  const SizedBox(height: 8),
                  Text(
                    error.toString(),
                    style: const TextStyle(fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => setState(() {}),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          flex: 1,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow('From:', trip.origin),
                _buildInfoRow('To:', trip.destination),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTripError(BuildContext context, Object error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 56, color: KTColors.danger),
          const SizedBox(height: 16),
          const Text('Error loading trip'),
          const SizedBox(height: 8),
          Text(error.toString(), style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 50,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: KTColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KTColors.backgroundSecondary,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: KTColors.primary),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: KTColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Map<String, double> _parseCoordinates(String location) {
    // Parse "lat,lng" format or return default coordinates (center of India)
    final parts = location.split(',');
    if (parts.length == 2) {
      return {
        'lat': double.tryParse(parts[0]) ?? 20.5937,
        'lng': double.tryParse(parts[1]) ?? 78.9629,
      };
    }
    return {'lat': 20.5937, 'lng': 78.9629}; // Default to India center
  }

  void _fitBounds(
    GoogleMapController controller,
    List<LatLng> locations,
  ) {
    if (locations.isEmpty) return;

    double minLat = locations[0].latitude;
    double maxLat = locations[0].latitude;
    double minLng = locations[0].longitude;
    double maxLng = locations[0].longitude;

    for (final location in locations) {
      minLat = minLat > location.latitude ? location.latitude : minLat;
      maxLat = maxLat < location.latitude ? location.latitude : maxLat;
      minLng = minLng > location.longitude ? location.longitude : minLng;
      maxLng = maxLng < location.longitude ? location.longitude : maxLng;
    }

    controller.animateCamera(
      CameraUpdateOptions(
        bounds: LatLngBounds(
          southwest: LatLng(minLat, minLng),
          northeast: LatLng(maxLat, maxLng),
        ),
        padding: const EdgeInsets.all(100),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'in_transit':
        return KTColors.success;
      case 'completed':
        return KTColors.success;
      case 'pending':
        return KTColors.warning;
      default:
        return KTColors.textSecondary;
    }
  }

  void _showCompleteConfirmation(BuildContext context, WidgetRef ref, Trip trip) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete Trip?'),
        content: Text('Mark trip ${trip.tripNumber} as completed?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Call API to mark trip as completed
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Trip completed!')),
              );
            },
            child: const Text('Complete'),
          ),
        ],
      ),
    );
  }
}
