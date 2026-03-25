import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/kt_colors.dart';
import '../../../core/theme/kt_text_styles.dart';
import '../../../providers/fleet_dashboard_provider.dart'; // apiServiceProvider

// ─── Entity types ─────────────────────────────────────────────────────────────

enum _EntityType { driver, truck, employee, client }

extension _EntityTypeExt on _EntityType {
  String get label {
    switch (this) {
      case _EntityType.driver: return 'Drivers';
      case _EntityType.truck: return 'Trucks';
      case _EntityType.employee: return 'Employees';
      case _EntityType.client: return 'Clients';
    }
  }

  String get endpoint {
    switch (this) {
      case _EntityType.driver: return '/drivers';
      case _EntityType.truck: return '/vehicles';
      case _EntityType.employee: return '/users';
      case _EntityType.client: return '/clients';
    }
  }

  String get nameKey {
    switch (this) {
      case _EntityType.driver: return 'name';
      case _EntityType.truck: return 'registration_number';
      case _EntityType.employee: return 'name';
      case _EntityType.client: return 'name';
    }
  }

  String get apiEntityType {
    switch (this) {
      case _EntityType.driver: return 'driver';
      case _EntityType.truck: return 'vehicle';
      case _EntityType.employee: return 'user';
      case _EntityType.client: return 'client';
    }
  }

  IconData get icon {
    switch (this) {
      case _EntityType.driver: return Icons.person_rounded;
      case _EntityType.truck: return Icons.local_shipping_rounded;
      case _EntityType.employee: return Icons.badge_rounded;
      case _EntityType.client: return Icons.business_rounded;
    }
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

class AdminUploadDocScreen extends ConsumerStatefulWidget {
  const AdminUploadDocScreen({super.key});

  @override
  ConsumerState<AdminUploadDocScreen> createState() => _AdminUploadDocScreenState();
}

class _AdminUploadDocScreenState extends ConsumerState<AdminUploadDocScreen> {
  // Step 1: entity type selection
  _EntityType? _selectedType;

  // Step 2: member list & search
  List<dynamic> _members = [];
  bool _loadingMembers = false;
  String _searchQuery = '';
  dynamic _selectedMember;

  // Step 3: documents for member
  List<dynamic> _docs = [];
  bool _loadingDocs = false;
  bool _uploading = false;

  int get _step {
    if (_selectedType == null) return 1;
    if (_selectedMember == null) return 2;
    return 3;
  }

  // ── Step 1 → Step 2: load members ──────────────────────────────────────────

  Future<void> _selectType(_EntityType type) async {
    setState(() {
      _selectedType = type;
      _selectedMember = null;
      _members = [];
      _searchQuery = '';
      _loadingMembers = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get(type.endpoint, queryParameters: {'limit': 200});
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _members = list as List; _loadingMembers = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingMembers = false);
    }
  }

  // ── Step 2 → Step 3: load existing docs ────────────────────────────────────

  Future<void> _selectMember(dynamic member) async {
    setState(() {
      _selectedMember = member;
      _docs = [];
      _loadingDocs = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.get('/documents', queryParameters: {
        'entity_id': member['id'],
        'entity_type': _selectedType!.apiEntityType,
      });
      final list = res is Map ? (res['data'] ?? res['items'] ?? []) : (res is List ? res : []);
      if (mounted) setState(() { _docs = list as List; _loadingDocs = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingDocs = false);
    }
  }

  // ── Upload document ────────────────────────────────────────────────────────

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
                color: KTColors.borderColor, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.camera_alt_rounded, color: KTColors.primary),
            title: const Text('Camera'),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_rounded, color: KTColors.primary),
            title: const Text('Gallery'),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );

    if (source == null) return;
    final picked = await picker.pickImage(source: source, imageQuality: 80);
    if (picked == null || !mounted) return;

    // Ask for doc type label
    final docType = await _askDocType();
    if (docType == null || !mounted) return;

    setState(() => _uploading = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.uploadDocument(
        File(picked.path),
        docType,
        _selectedMember['id'].toString(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document uploaded'), backgroundColor: KTColors.success),
        );
        // Refresh docs list
        await _selectMember(_selectedMember);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: KTColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<String?> _askDocType() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Document Type'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'e.g. License, RC, Insurance'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: KTColors.primary),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  // ── Back navigation ────────────────────────────────────────────────────────

  void _goBack() {
    if (_step == 3) {
      setState(() { _selectedMember = null; _docs = []; });
    } else if (_step == 2) {
      setState(() { _selectedType = null; _members = []; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _step == 1,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _step > 1) _goBack();
      },
      child: Scaffold(
        backgroundColor: KTColors.lightBg,
        appBar: AppBar(
          backgroundColor: KTColors.surface,
          elevation: 0,
          leading: BackButton(
            color: KTColors.textHeading,
            onPressed: _step > 1 ? _goBack : () => Navigator.of(context).pop(),
          ),
          title: Text(_appBarTitle,
              style: KTTextStyles.h2.copyWith(color: KTColors.textHeading)),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(height: 1, color: KTColors.borderColor),
          ),
        ),
        body: _buildBody(),
        floatingActionButton: _step == 3
            ? FloatingActionButton.extended(
                backgroundColor: KTColors.primary,
                onPressed: _uploading ? null : _pickAndUpload,
                icon: const Icon(Icons.upload_file_rounded, color: Colors.white),
                label: const Text('Upload Doc',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              )
            : null,
      ),
    );
  }

  String get _appBarTitle {
    if (_step == 1) return 'Upload Document';
    if (_step == 2) return _selectedType!.label;
    final name = _selectedMember[_selectedType!.nameKey] ??
        _selectedMember['full_name'] ?? 'Member';
    return name.toString();
  }

  Widget _buildBody() {
    switch (_step) {
      case 1: return _buildStep1();
      case 2: return _buildStep2();
      default: return _buildStep3();
    }
  }

  // Step 1 — entity type grid
  Widget _buildStep1() {
    return GridView.count(
      padding: const EdgeInsets.all(20),
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.2,
      children: _EntityType.values.map((type) => _EntityTile(
        type: type,
        onTap: () => _selectType(type),
      )).toList(),
    );
  }

  // Step 2 — member list with search
  Widget _buildStep2() {
    if (_loadingMembers) {
      return const Center(child: CircularProgressIndicator());
    }
    final filtered = _members.where((m) {
      final name = (m[_selectedType!.nameKey] ?? m['full_name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (v) => setState(() => _searchQuery = v),
            decoration: InputDecoration(
              hintText: 'Search ${_selectedType!.label.toLowerCase()}...',
              prefixIcon: const Icon(Icons.search_rounded, color: KTColors.textMuted),
              filled: true,
              fillColor: KTColors.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.borderColor)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: KTColors.borderColor)),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('No members found', style: TextStyle(color: KTColors.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final m = filtered[i];
                    final name = m[_selectedType!.nameKey] ?? m['full_name'] ?? 'Unknown';
                    final subtitle = m['phone'] ?? m['mobile'] ?? m['email'] ?? '';
                    return ListTile(
                      tileColor: KTColors.surface,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: KTColors.borderColor)),
                      leading: CircleAvatar(
                        backgroundColor: KTColors.primary.withOpacity(0.12),
                        child: Icon(_selectedType!.icon, color: KTColors.primary, size: 20),
                      ),
                      title: Text(name.toString(),
                          style: KTTextStyles.body.copyWith(color: KTColors.textHeading,
                              fontWeight: FontWeight.w600)),
                      subtitle: subtitle.isNotEmpty
                          ? Text(subtitle.toString(),
                              style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted))
                          : null,
                      trailing: const Icon(Icons.chevron_right_rounded, color: KTColors.textMuted),
                      onTap: () => _selectMember(m),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // Step 3 — existing docs + upload FAB
  Widget _buildStep3() {
    if (_loadingDocs) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_uploading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Uploading document…', style: TextStyle(color: KTColors.textMuted)),
          ],
        ),
      );
    }
    if (_docs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.folder_open_rounded, color: KTColors.textMuted, size: 56),
            const SizedBox(height: 12),
            Text('No documents uploaded yet',
                style: KTTextStyles.body.copyWith(color: KTColors.textMuted)),
            const SizedBox(height: 80),
          ],
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: _docs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final doc = _docs[i];
        final type = doc['document_type'] ?? doc['doc_type'] ?? 'Document';
        final date = doc['created_at'] ?? doc['uploaded_at'] ?? '';
        final dateStr = date.isNotEmpty
            ? date.toString().substring(0, 10)
            : '';
        return ListTile(
          tileColor: KTColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: KTColors.borderColor),
          ),
          leading: Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: KTColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.description_rounded, color: KTColors.primary, size: 22),
          ),
          title: Text(type.toString(),
              style: KTTextStyles.body.copyWith(
                  color: KTColors.textHeading, fontWeight: FontWeight.w600)),
          subtitle: dateStr.isNotEmpty
              ? Text('Uploaded $dateStr',
                  style: KTTextStyles.bodySmall.copyWith(color: KTColors.textMuted))
              : null,
          trailing: const Icon(Icons.open_in_new_rounded, color: KTColors.textMuted, size: 18),
        );
      },
    );
  }
}

// ─── Entity tile widget ───────────────────────────────────────────────────────

class _EntityTile extends StatelessWidget {
  final _EntityType type;
  final VoidCallback onTap;

  const _EntityTile({required this.type, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: KTColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: KTColors.borderColor),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                color: KTColors.primary.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(type.icon, color: KTColors.primary, size: 26),
            ),
            const SizedBox(height: 10),
            Text(type.label,
                style: KTTextStyles.body.copyWith(
                    color: KTColors.textHeading, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
