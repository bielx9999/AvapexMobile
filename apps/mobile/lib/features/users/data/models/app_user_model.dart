import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum UserRole {
  driver('driver'),
  admin('admin');

  const UserRole(this.value);

  final String value;

  static UserRole fromFirestore(String value) {
    return UserRole.values.firstWhere(
      (role) => role.value == value,
      orElse: () => throw FormatException('Invalid user role: $value'),
    );
  }
}

enum UserStatus {
  active('active'),
  inactive('inactive');

  const UserStatus(this.value);

  final String value;

  static UserStatus fromFirestore(String value) {
    return UserStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => throw FormatException('Invalid user status: $value'),
    );
  }
}

final class DriverLicense {
  const DriverLicense({
    required this.number,
    required this.category,
    required this.expirationDate,
  });

  final String number;
  final String category;
  final DateTime expirationDate;

  factory DriverLicense.fromFirestore(Map<String, dynamic> json) {
    return DriverLicense(
      number: json['number'] as String,
      category: json['category'] as String,
      expirationDate: readDateTime(json, 'expirationDate'),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'number': number,
      'category': category,
      'expirationDate': writeTimestamp(expirationDate),
    };
  }
}

final class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.status,
    required this.createdAt,
    this.cnh,
    this.photoUrl,
  });

  final String uid;
  final String name;
  final String email;
  final String phone;
  final UserRole role;
  final DriverLicense? cnh;
  final UserStatus status;
  final DateTime createdAt;
  final String? photoUrl;

  factory AppUser.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('User document ${doc.id} has no data.');
    }
    return AppUser.fromFirestore(data, documentId: doc.id);
  }

  factory AppUser.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    final role = UserRole.fromFirestore(json['role'] as String);
    final cnhValue = json['cnh'];

    if (role == UserRole.driver && cnhValue == null) {
      throw const FormatException('Driver user requires cnh data.');
    }

    return AppUser(
      uid: (json['uid'] as String?) ?? documentId ?? '',
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String,
      role: role,
      cnh: cnhValue == null
          ? null
          : DriverLicense.fromFirestore(Map<String, dynamic>.from(cnhValue)),
      status: UserStatus.fromFirestore(json['status'] as String),
      createdAt: readDateTime(json, 'createdAt'),
      photoUrl: json['photoUrl'] as String?,
    );
  }

  Map<String, dynamic> toFirestore() {
    if (role == UserRole.driver && cnh == null) {
      throw StateError('Driver user requires cnh data.');
    }

    return {
      'uid': uid,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role.value,
      'cnh': cnh?.toFirestore(),
      'status': status.value,
      'createdAt': writeTimestamp(createdAt),
      if (photoUrl != null) 'photoUrl': photoUrl,
    };
  }
}
