import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../manager/screens/manager_client_detail_screen.dart';

/// Admin Client Detail — delegates to the Manager client-detail screen.
class AdminClientDetailScreen extends ConsumerWidget {
  final String clientId;
  const AdminClientDetailScreen({super.key, required this.clientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ManagerClientDetailScreen(clientId: clientId);
  }
}
