class User {
  final String id;
  final String name;
  final String email;
  final List<String> roles; // [cite: 5]

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.roles,
  });

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
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      roles: List<String>.from(json['roles'] ?? []), // [cite: 5]
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'roles': roles, // [cite: 5]
    };
  }
}