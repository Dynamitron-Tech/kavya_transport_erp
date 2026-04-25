import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../core/theme/kt_colors.dart';
import '../../services/api_service.dart';

// ═══════════════════════════════════════════════════════════════════
//  MARKET DRIVER TRIP DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════════

class MarketDriverTripDetailScreen extends ConsumerStatefulWidget {
  final int tripId;
  final Map<String, dynamic>? initialData;

  const MarketDriverTripDetailScreen({
    super.key,
    required this.tripId,
    this.initialData,
  });

  @override
  ConsumerState<MarketDriverTripDetailScreen> createState() =>
      _MarketDriverTripDetailState();
}

class _MarketDriverTripDetailState
    extends ConsumerState<MarketDriverTripDetailScreen> {
  Map<String, dynamic>? _trip;
  bool _loading = true;
  bool _updating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialData != null) {
      _trip = widget.initialData;
      _loading = false;
    } else {
      _fetchTrip();
    }
  }

  Future<void> _fetchTrip() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ApiService();
      final resp = await api.get('/market-trips/${widget.tripId}');
      setState(() {
        _trip = (resp['data'] ?? resp) as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  // ── STATUS UPDATE ─────────────────────────────────────────────

  Future<void> _updateStatus(String newStatus) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: KTColors.darkSurface,
        title: const Text('Confirm', style: TextStyle(color: Colors.white)),
        content: Text(
          'Set status to "${newStatus.replaceAll("_", " ")}"?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _updating = true);
    try {
      final api = ApiService();
      await api.put('/market-trips/${widget.tripId}/driver-status', data: {
        'status': newStatus,
      });
      await _fetchTrip();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Status updated to ${newStatus.replaceAll("_", " ")}'),
          backgroundColor: KTColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractError(e)),
          backgroundColor: KTColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  // ── POD UPLOAD ────────────────────────────────────────────────

  Future<void> _uploadPod() async {
    final picker = ImagePicker();
    final choice = await showModalBottomSheet<ImageSource>(
      context: context,
        backgroundColor: KTColors.darkSurface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          _SheetTile(Icons.camera_alt_outlined, 'Camera', ImageSource.camera),
          _SheetTile(Icons.photo_library_outlined, 'Gallery', ImageSource.gallery),
          const SizedBox(height: 8),
        ],
      ),
    );
    if (choice == null) return;

    final xfile = await picker.pickImage(
      source: choice,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (xfile == null) return;

    setState(() => _updating = true);
    try {
      final api = ApiService();
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          xfile.path,
          filename: xfile.name,
        ),
      });
      await api.postMultipart('/market-trips/${widget.tripId}/pod', formData);
      await _fetchTrip();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('POD uploaded'), backgroundColor: KTColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Upload failed: ${_extractError(e)}'),
          backgroundColor: KTColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  String _extractError(Object e) {
    final s = e.toString();
    final m = RegExp(r'"detail":"([^"]+)"').firstMatch(s);
    return m != null ? m.group(1)! : 'Operation failed. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KTColors.darkBg,
      appBar: AppBar(
        backgroundColor: KTColors.darkSurface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Trip #${widget.tripId}',
          style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorBody(error: _error!, onRetry: _fetchTrip)
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final trip   = _trip!;
    final status = (trip['status'] as String? ?? 'PENDING').toUpperCase();

    // Determine what the next status action should be
    final nextStatus = switch (status) {
      'PENDING'  || 'ASSIGNED' => 'IN_TRANSIT',
      'IN_TRANSIT'             => 'DELIVERED',
      _                        => null,
    };

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status banner
              _StatusBanner(status: status),
              const SizedBox(height: 16),

              // Vehicle section
              _SectionCard(
                title: 'Vehicle',
                icon: Icons.local_shipping_outlined,
                children: [
                  _Row('Registration', trip['vehicle_registration']),
                  _Row('Type',         trip['vehicle_type']),
                  _Row('Owner',        trip['owner_name']),
                ],
              ),
              const SizedBox(height: 12),

              // Rates section
              _SectionCard(
                title: 'Payment',
                icon: Icons.currency_rupee_rounded,
                children: [
                  _Row('Client rate',      _rupee(trip['client_rate'])),
                  _Row('Your rate',        _rupee(trip['contractor_rate'])),
                  _Row('Advance received', _rupee(trip['advance_amount'])),
                ],
              ),
              const SizedBox(height: 12),

              // Dates section
              _SectionCard(
                title: 'Timeline',
                icon: Icons.timeline_rounded,
                children: [
                  _Row('Created',   _formatDt(trip['created_at'])),
                  _Row('Started',   _formatDt(trip['assigned_at'])),
                  _Row('Delivered', _formatDt(trip['delivered_at'])),
                ],
              ),

              // POD upload button (shown after in-transit)
              if (status == 'IN_TRANSIT' || status == 'DELIVERED') ...[
                const SizedBox(height: 16),
                _OutlineButton(
                  icon: Icons.upload_file_rounded,
                  label: 'Upload POD / Delivery Proof',
                  onTap: _updating ? null : _uploadPod,
                ),
              ],
            ],
          ),
        ),

        // Bottom action button
        if (nextStatus != null)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _BottomAction(
              nextStatus: nextStatus,
              loading: _updating,
              onTap: () => _updateStatus(nextStatus),
            ),
          ),
      ],
    );
  }

  String _rupee(dynamic v) {
    if (v == null) return '—';
    final n = double.tryParse(v.toString()) ?? 0.0;
    return '₹${NumberFormat('#,##,###.##').format(n)}';
  }

  String? _formatDt(dynamic v) {
    if (v == null) return null;
    try {
      return DateFormat('dd MMM yyyy, hh:mm a').format(
        DateTime.parse(v.toString()).toLocal(),
      );
    } catch (_) {
      return v.toString();
    }
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────

class _StatusBanner extends StatelessWidget {
  final String status;
  const _StatusBanner({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (status) {
      'IN_TRANSIT'  => (KTColors.warning,  'Trip in progress',    Icons.directions_car_rounded),
      'DELIVERED'   => (KTColors.success,  'Delivered',           Icons.check_circle_rounded),
      'SETTLED'     => (KTColors.info,     'Settled',             Icons.done_all_rounded),
      'CANCELLED'   => (KTColors.danger,   'Cancelled',           Icons.cancel_outlined),
      'ASSIGNED'    => (KTColors.primary,  'Assigned to you',     Icons.assignment_rounded),
      _             => (const Color(0xFF64748B), 'Pending',        Icons.hourglass_top_rounded),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status.replaceAll('_', ' '),
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: KTColors.darkSurface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
              child: Row(
                children: [
                  Icon(icon, size: 14, color: KTColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
              child: Column(children: children),
            ),
          ],
        ),
      );
}

class _Row extends StatelessWidget {
  final String label;
  final String? value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value!,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const _OutlineButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: KTColors.primary.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: KTColors.primary, size: 18),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  color: KTColors.primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
}

class _BottomAction extends StatelessWidget {
  final String nextStatus;
  final bool loading;
  final VoidCallback onTap;
  const _BottomAction({
    required this.nextStatus,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDelivered = nextStatus == 'DELIVERED';
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: BoxDecoration(
        color: KTColors.darkSurface,
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.07)),
        ),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: isDelivered ? KTColors.success : KTColors.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: loading ? null : onTap,
          icon: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : Icon(
                  isDelivered ? Icons.check_circle_rounded : Icons.directions_car_rounded,
                  size: 18,
                ),
          label: Text(
            loading
                ? 'Updating...'
                : isDelivered
                    ? 'Mark as Delivered'
                    : 'Start Trip',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ),
      ),
    );
  }
}

class _SheetTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final ImageSource value;
  const _SheetTile(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: Colors.white70),
        title: Text(label, style: const TextStyle(color: Colors.white)),
        onTap: () => Navigator.pop(context, value),
      );
}

class _ErrorBody extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorBody({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: KTColors.danger.withValues(alpha: 0.6)),
            const SizedBox(height: 14),
            const Text('Could not load trip', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary),
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
}
