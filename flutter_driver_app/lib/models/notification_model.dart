class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String? type;
  final String? referenceId;
  final String createdAt;
  final bool read;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    this.type,
    this.referenceId,
    required this.createdAt,
    this.read = false,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) =>
      NotificationModel(
        id: json['id']?.toString() ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        type: json['type'] as String?,
        referenceId: json['reference_id']?.toString(),
        createdAt: json['created_at'] as String? ?? '',
        read: json['read'] as bool? ?? false,
      );
}
