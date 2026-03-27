import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../manager/screens/manager_job_detail_screen.dart';

/// Admin Job Detail — delegates to the Manager job-detail screen.
class AdminJobDetailScreen extends ConsumerWidget {
  final String jobId;
  const AdminJobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ManagerJobDetailScreen(jobId: jobId);
  }
}
