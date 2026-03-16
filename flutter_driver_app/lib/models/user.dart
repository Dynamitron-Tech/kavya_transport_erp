class User {
  final int id;
  final String username;
  final String fullName;
  final String role;
  final String? phone;
  final String? email;
  final bool isActive;

  const User({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    this.phone,
    this.email,
    this.isActive = true,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as int,
        username: json['username'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'driver',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        isActive: json['is_active'] as bool? ?? true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'full_name': fullName,
        'role': role,
        'phone': phone,
        'email': email,
        'is_active': isActive,
      };
}
