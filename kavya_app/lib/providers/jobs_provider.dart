import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'fleet_dashboard_provider.dart';

class JobsFilter {
  final String? status;
  final bool? noLr;
  JobsFilter({this.status, this.noLr});
}

final jobsFilterProvider = StateProvider<JobsFilter>((ref) => JobsFilter());

final jobsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async { //
  final filter = ref.watch(jobsFilterProvider); // Watch filter params 
  final api = ref.read(apiServiceProvider);
  return await api.getJobs(status: filter.status, noLr: filter.noLr); //
});

// ... existing jobsProvider ...

final tripsReadyToCloseProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return await api.getTrips(status: 'trips_ready_to_close'); // Data: GET /api/v1/trips?status=trips_ready_to_close
});