import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_button.dart';
import '../../core/widgets/kt_loading_shimmer.dart';
import '../../core/widgets/section_header.dart';

// TODO: Create actual vehicle provider
class Vehicle {
  final int id;
  final String registrationNumber;
  final String model;
  final String status; // 'active', 'maintenance', 'inactive'
  final String? assignedDriver;
  final DateTime lastServiceDate;
  final int currentMileage;
  final String fuelType;

  Vehicle({
    required this.id,
    required this.registrationNumber,
    required this.model,
    required this.status,
    this.assignedDriver,
    required this.lastServiceDate,
    required this.currentMileage,
    required this.fuelType,
  });
}

class FleetVehiclesScreen extends ConsumerWidget {
  const FleetVehiclesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Mock data - TODO: Replace with actual provider
    final vehicles = [
      Vehicle(
        id: 1,
        registrationNumber: 'MH-01-AB-1234',
        model: 'TATA 407 (2020)',
        status: 'active',
        assignedDriver: 'Rajesh Kumar',
        lastServiceDate: DateTime(2025, 2, 15),
        currentMileage: 125420,
        fuelType: 'Diesel',
      ),
      Vehicle(
        id: 2,
        registrationNumber: 'MH-01-AB-5678',
        model: 'TATA ACE (2021)',
        status: 'active',
        assignedDriver: 'Amit Patel',
        lastServiceDate: DateTime(2025, 2, 20),
        currentMileage: 98760,
        fuelType: 'Diesel',
      ),
      Vehicle(
        id: 3,
        registrationNumber: 'MH-01-AB-9012',
        model: 'Mahindra Supro (2019)',
        status: 'maintenance',
        assignedDriver: null,
        lastServiceDate: DateTime(2024, 12, 10),
        currentMileage: 167890,
        fuelType: 'Diesel',
      ),
      Vehicle(
        id: 4,
        registrationNumber: 'MH-01-AB-3456',
        model: 'Force Traveller (2022)',
        status: 'active',
        assignedDriver: 'Vikram Singh',
        lastServiceDate: DateTime(2025, 1, 28),
        currentMileage: 76543,
        fuelType: 'Diesel',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fleet Vehicles'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              // TODO: Handle add vehicle
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Add vehicle - Coming soon')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Filter/Search
            SearchBar(
              hintText: 'Search by registration or driver...',
              leading: const Icon(Icons.search),
              onChanged: (value) {
                // TODO: Implement search
              },
            ),
            const SizedBox(height: 20),

            // Vehicle List
            const SectionHeader(title: 'All Vehicles'),
            const SizedBox(height: 12),
            ...vehicles.map((vehicle) => _vehicleCard(context, vehicle)).toList(),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _vehicleCard(BuildContext context, Vehicle vehicle) {
    return GestureDetector(
      onTap: () {
        // TODO: Navigate to vehicle detail
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('View ${vehicle.registrationNumber}')),
        );
      },
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vehicle.registrationNumber,
                          style: KTTextStyles.h3,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          vehicle.model,
                          style: const TextStyle(
                            fontSize: 12,
                            color: KTColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _getStatusColor(vehicle.status).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: _getStatusColor(vehicle.status).withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      vehicle.status.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(vehicle.status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _infoColumn('Driver', vehicle.assignedDriver ?? 'Unassigned'),
                  _infoColumn('Fuel Type', vehicle.fuelType),
                  _infoColumn('Mileage', '${vehicle.currentMileage} km'),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Last Service: ${vehicle.lastServiceDate.year}-${vehicle.lastServiceDate.month.toString().padLeft(2, '0')}-${vehicle.lastServiceDate.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: KTColors.textSecondary,
                    ),
                  ),
                  Row(
                    children: [
                      SizedBox(
                        height: 28,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.edit, size: 14),
                          label: const Text('Edit'),
                          onPressed: () {
                            // TODO: Edit vehicle
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        height: 28,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.location_on, size: 14),
                          label: const Text('Track'),
                          onPressed: () {
                            // TODO: View vehicle location on map
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            color: KTColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return KTColors.success;
      case 'maintenance':
        return KTColors.warning;
      case 'inactive':
        return KTColors.danger;
      default:
        return KTColors.textSecondary;
    }
  }
}
