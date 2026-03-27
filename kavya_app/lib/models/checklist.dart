class ChecklistItem {
  final String id;
  final String label;
  final bool checked;
  final String? note;

  const ChecklistItem({
    required this.id,
    required this.label,
    this.checked = false,
    this.note,
  });

  factory ChecklistItem.fromJson(Map<String, dynamic> json) => ChecklistItem(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        checked: json['checked'] as bool? ?? false,
        note: json['note'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'checked': checked,
        if (note != null) 'note': note,
      };

  ChecklistItem copyWith({bool? checked, String? note}) => ChecklistItem(
        id: id,
        label: label,
        checked: checked ?? this.checked,
        note: note ?? this.note,
      );
}

class Checklist {
  final int? tripId;
  final String type; // pre_trip or post_trip
  final List<ChecklistItem> items;
  final String? completedAt;
  final String? notes;

  const Checklist({
    this.tripId,
    required this.type,
    required this.items,
    this.completedAt,
    this.notes,
  });

  factory Checklist.fromJson(Map<String, dynamic> json) => Checklist(
        tripId: json['trip_id'] as int?,
        type: json['type'] as String? ?? 'pre_trip',
        items: (json['items'] as List<dynamic>?)
                ?.map((e) => ChecklistItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        completedAt: json['completed_at'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if (tripId != null) 'trip_id': tripId,
        'type': type,
        'items': items.map((e) => e.toJson()).toList(),
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };

  bool get isComplete => items.isNotEmpty && items.every((i) => i.checked);

  Checklist copyWith({
    int? tripId,
    String? type,
    List<ChecklistItem>? items,
    String? completedAt,
    String? notes,
  }) =>
      Checklist(
        tripId: tripId ?? this.tripId,
        type: type ?? this.type,
        items: items ?? this.items,
        completedAt: completedAt ?? this.completedAt,
        notes: notes ?? this.notes,
      );
}

List<ChecklistItem> defaultPreTripItems() => const [
      ChecklistItem(id: 'engine_oil', label: 'Engine Oil Level'),
      ChecklistItem(id: 'coolant', label: 'Coolant Level'),
      ChecklistItem(id: 'tyre_pressure', label: 'Tyre Pressure'),
      ChecklistItem(id: 'tyre_condition', label: 'Tyre Condition'),
      ChecklistItem(id: 'brakes', label: 'Brake Functionality'),
      ChecklistItem(id: 'lights', label: 'Lights & Indicators'),
      ChecklistItem(id: 'horn', label: 'Horn'),
      ChecklistItem(id: 'mirrors', label: 'Mirrors & Wipers'),
      ChecklistItem(id: 'documents', label: 'RC, Insurance, Permit'),
      ChecklistItem(id: 'first_aid', label: 'First Aid Kit'),
      ChecklistItem(id: 'fire_extinguisher', label: 'Fire Extinguisher'),
      ChecklistItem(id: 'tool_kit', label: 'Tool Kit'),
    ];
