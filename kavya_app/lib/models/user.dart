class User {
  final String id;
  final String name;
  final String email;
  final List<String> roles; // [cite: 5]
  final String? phone;
  final bool isActive;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.roles,
    this.phone,
    this.isActive = true,
  });

  // Convenience aliases for driver screens
  String get fullName => name;
  String get username => email;
  String get role => primaryRole;

  // Primary role = roles[0]. Never read user.role (singular) — it does not exist. [cite: 6]
  String get primaryRole {
    if (roles.isNotEmpty) {
      return roles.first; // [cite: 6]
    }
    return 'unknown'; 
  }

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? json['full_name'] ?? '',
      email: json['email'] ?? '',
      roles: List<String>.from(json['roles'] ?? []), // [cite: 5]
      phone: json['phone'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'roles': roles, // [cite: 5]
      'phone': phone,
      'is_active': isActive,
    };
  }
}