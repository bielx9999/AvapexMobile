import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum IncidentType {
  mechanical('mechanical'),
  tire('tire'),
  accident('accident'),
  delay('delay'),
  expense('expense'),
  damage('damage'),
  cargo('cargo'),
  delivery('delivery'),
  documentation('documentation'),
  other('other');

  const IncidentType(this.value);

  final String value;

  static IncidentType fromFirestore(String value) {
    return IncidentType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => throw FormatException('Invalid incident type: $value'),
    );
  }
}

enum IncidentStatus {
  reported('reported'),
  underReview('under_review'),
  resolved('resolved');

  const IncidentStatus(this.value);

  final String value;

  static IncidentStatus fromFirestore(String value) {
    return IncidentStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => throw FormatException('Invalid incident status: $value'),
    );
  }
}

final class Incident {
  const Incident({
    required this.id,
    required this.tripId,
    required this.driverId,
    required this.type,
    required this.description,
    required this.status,
    required this.createdAt,
    this.cost,
    this.photoUrl,
    this.pendingPhotoLocalPath,
  });

  final String id;
  final String tripId;
  final String driverId;
  final IncidentType type;
  final String description;
  final num? cost;
  final String? photoUrl;
  final String? pendingPhotoLocalPath;
  final IncidentStatus status;
  final DateTime createdAt;

  factory Incident.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Incident document ${doc.id} has no data.');
    }
    return Incident.fromFirestore(data, documentId: doc.id);
  }

  factory Incident.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return Incident(
      id: (json['id'] as String?) ?? documentId ?? '',
      tripId: json['tripId'] as String,
      driverId: json['driverId'] as String,
      type: IncidentType.fromFirestore(json['type'] as String),
      description: json['description'] as String,
      cost: json['cost'] as num?,
      photoUrl: json['photoUrl'] as String?,
      pendingPhotoLocalPath: json['pendingPhotoLocalPath'] as String?,
      status: IncidentStatus.fromFirestore(json['status'] as String),
      createdAt: readDateTime(json, 'createdAt'),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'tripId': tripId,
      'driverId': driverId,
      'type': type.value,
      'description': description,
      'cost': cost,
      'photoUrl': photoUrl,
      if (pendingPhotoLocalPath != null)
        'pendingPhotoLocalPath': pendingPhotoLocalPath,
      'status': status.value,
      'createdAt': writeTimestamp(createdAt),
    };
  }
}
