import 'dart:convert';
import 'dart:io';

class ChecklistItem {
  final String id;
  final String label;
  final bool checked;
  final String? note;
  final String? photoPath; // local file path of the captured photo

  const ChecklistItem({
    required this.id,
    required this.label,
    this.checked = false,
    this.note,
    this.photoPath,
  });

  factory ChecklistItem.fromJson(Map<String, dynamic> json) => ChecklistItem(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        checked: json['checked'] as bool? ?? false,
        note: json['note'] as String?,
      );

  Map<String, dynamic> toJson() {
    String? photoBase64;
    if (photoPath != null) {
      try {
        final bytes = File(photoPath!).readAsBytesSync();
        photoBase64 = base64Encode(bytes);
      } catch (_) {
        // skip if file unreadable
      }
    }
    return {
      'id': id,
      'label': label,
      'checked': checked,
      if (note != null) 'note': note,
      if (photoBase64 != null) 'photo': photoBase64,
    };
  }

  ChecklistItem copyWith({bool? checked, String? note, String? photoPath}) => ChecklistItem(
        id: id,
        label: label,
        checked: checked ?? this.checked,
        note: note ?? this.note,
        photoPath: photoPath ?? this.photoPath,
      );
}

class Checklist {
  final int? tripId;
  final String type; // checklist type
  final List<ChecklistItem> items;
  final String? completedAt;
  final String? notes;
  final double? latitude;
  final double? longitude;

  const Checklist({
    this.tripId,
    required this.type,
    required this.items,
    this.completedAt,
    this.notes,
    this.latitude,
    this.longitude,
  });

  factory Checklist.fromJson(Map<String, dynamic> json) => Checklist(
        tripId: json['trip_id'] as int?,
        type: json['type'] as String? ?? 'checklist',
        items: (json['items'] as List<dynamic>?)
                ?.map((e) => ChecklistItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        completedAt: json['completed_at'] as String?,
        notes: json['notes'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
      );

  Map<String, dynamic> toJson() => {
        if (tripId != null) 'trip_id': tripId,
        'type': type,
        'items': items.map((e) => e.toJson()).toList(),
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      };

  bool get isComplete => items.isNotEmpty && items.every((i) => i.checked);

  Checklist copyWith({
    int? tripId,
    String? type,
    List<ChecklistItem>? items,
    String? completedAt,
    String? notes,
    double? latitude,
    double? longitude,
  }) =>
      Checklist(
        tripId: tripId ?? this.tripId,
        type: type ?? this.type,
        items: items ?? this.items,
        completedAt: completedAt ?? this.completedAt,
        notes: notes ?? this.notes,
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
      );
}

List<ChecklistItem> defaultPreTripItems() => const [
      ChecklistItem(id: 'engine_oil', label: 'Engine Oil Level'),
      ChecklistItem(id: 'coolant', label: 'Coolant Level'),
      ChecklistItem(id: 'grease', label: 'Grease'),
      ChecklistItem(id: 'battery', label: 'Battery Level'),
      ChecklistItem(id: 'deep_cleaned_cabin', label: 'Deep-Cleaned Cabin'),
    ];
