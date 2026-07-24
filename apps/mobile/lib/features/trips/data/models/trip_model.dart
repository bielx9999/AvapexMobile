import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum TripStatus {
  pending('pending'),
  inProgress('in_progress'),
  completed('completed'),
  cancelled('cancelled');

  const TripStatus(this.value);

  final String value;

  static TripStatus fromFirestore(String value) {
    return TripStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => throw FormatException('Invalid trip status: $value'),
    );
  }
}

final class Trip {
  const Trip({
    required this.id,
    required this.driverId,
    required this.vehicleId,
    required this.origin,
    required this.destination,
    required this.status,
    required this.scheduledAt,
    required this.deliveryDocs,
    this.startedAt,
    this.completedAt,
  });

  final String id;
  final String driverId;
  final String vehicleId;
  final String origin;
  final String destination;
  final TripStatus status;
  final DateTime scheduledAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final List<String> deliveryDocs;

  factory Trip.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Trip document ${doc.id} has no data.');
    }
    return Trip.fromFirestore(data, documentId: doc.id);
  }

  factory Trip.fromFirestore(Map<String, dynamic> json, {String? documentId}) {
    return Trip(
      id: (json['id'] as String?) ?? documentId ?? '',
      driverId: json['driverId'] as String,
      vehicleId: json['vehicleId'] as String,
      origin: json['origin'] as String,
      destination: json['destination'] as String,
      status: TripStatus.fromFirestore(json['status'] as String),
      scheduledAt: readDateTime(json, 'scheduledAt'),
      startedAt: readNullableDateTime(json, 'startedAt'),
      completedAt: readNullableDateTime(json, 'completedAt'),
      deliveryDocs: readStringList(json, 'deliveryDocs'),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'driverId': driverId,
      'vehicleId': vehicleId,
      'origin': origin,
      'destination': destination,
      'status': status.value,
      'scheduledAt': writeTimestamp(scheduledAt),
      'startedAt': writeNullableTimestamp(startedAt),
      'completedAt': writeNullableTimestamp(completedAt),
      'deliveryDocs': deliveryDocs,
    };
  }
}
