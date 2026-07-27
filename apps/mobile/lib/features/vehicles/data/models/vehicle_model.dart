import 'package:cloud_firestore/cloud_firestore.dart';

enum VehicleStatus {
  active('active'),
  inactive('inactive'),
  available('available'),
  inTransit('in_transit'),
  maintenance('maintenance');

  const VehicleStatus(this.value);

  final String value;

  static VehicleStatus fromFirestore(String value) {
    return VehicleStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => throw FormatException('Invalid vehicle status: $value'),
    );
  }
}

final class Vehicle {
  const Vehicle({
    required this.id,
    required this.plate,
    required this.model,
    required this.currentKm,
    required this.status,
    this.lastChecklistId,
  });

  final String id;
  final String plate;
  final String model;
  final num currentKm;
  final VehicleStatus status;
  final String? lastChecklistId;

  factory Vehicle.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Vehicle document ${doc.id} has no data.');
    }
    return Vehicle.fromFirestore(data, documentId: doc.id);
  }

  factory Vehicle.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return Vehicle(
      id: (json['id'] as String?) ?? documentId ?? '',
      plate: json['plate'] as String,
      model: json['model'] as String,
      currentKm: json['currentKm'] as num,
      status: VehicleStatus.fromFirestore(json['status'] as String),
      lastChecklistId: json['lastChecklistId'] as String?,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'plate': plate,
      'model': model,
      'currentKm': currentKm,
      'status': status.value,
      'lastChecklistId': lastChecklistId,
    };
  }
}
