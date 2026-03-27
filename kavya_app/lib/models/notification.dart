class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String? type;
  final String? createdAt;
  final bool read;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    this.type,
    this.createdAt,
    this.read = false,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) =>
      NotificationModel(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        type: json['type'] as String?,
        createdAt: json['created_at'] as String?,
        read: json['read'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'type': type,
        'created_at': createdAt,
        'read': read,
      };

  NotificationModel copyWith({
    String? id,
    String? title,
    String? body,
    String? type,
    String? createdAt,
    bool? read,
  }) =>
      NotificationModel(
        id: id ?? this.id,
        title: title ?? this.title,
        body: body ?? this.body,
        type: type ?? this.type,
        createdAt: createdAt ?? this.createdAt,
        read: read ?? this.read,
      );
}
