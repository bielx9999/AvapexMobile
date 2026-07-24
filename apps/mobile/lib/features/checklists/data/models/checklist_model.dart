import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum ChecklistType {
  departure('departure'),
  arrival('arrival'),
  vehicleDaily('vehicle_daily'),
  chainTensioner('chain_tensioner');

  const ChecklistType(this.value);

  final String value;

  static ChecklistType fromFirestore(String value) {
    return ChecklistType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => throw FormatException('Invalid checklist type: $value'),
    );
  }
}

final class ChecklistItems {
  const ChecklistItems({
    required this.tires,
    required this.brakes,
    required this.lights,
    required this.oil,
    required this.notes,
  });

  final bool tires;
  final bool brakes;
  final bool lights;
  final bool oil;
  final String notes;

  factory ChecklistItems.fromFirestore(Map<String, dynamic> json) {
    return ChecklistItems(
      tires: json['tires'] as bool,
      brakes: json['brakes'] as bool,
      lights: json['lights'] as bool,
      oil: json['oil'] as bool,
      notes: (json['notes'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'tires': tires,
      'brakes': brakes,
      'lights': lights,
      'oil': oil,
      'notes': notes,
    };
  }
}

final class Checklist {
  const Checklist({
    required this.id,
    required this.tripId,
    required this.driverId,
    required this.vehicleId,
    required this.type,
    required this.kmRegistered,
    required this.items,
    required this.photoUrls,
    required this.signatureUrl,
    required this.createdAt,
    this.category,
    this.vehiclePlate,
    this.driverName,
    this.location,
    this.answers,
    this.approvalStatus,
    this.hasCriticalFailure,
  });

  final String id;
  final String tripId;
  final String driverId;
  final String vehicleId;
  final ChecklistType type;
  final num kmRegistered;
  final ChecklistItems items;
  final List<String> photoUrls;
  final String signatureUrl;
  final DateTime createdAt;
  final String? category;
  final String? vehiclePlate;
  final String? driverName;
  final Map<String, dynamic>? location;
  final Map<String, dynamic>? answers;
  final String? approvalStatus;
  final bool? hasCriticalFailure;

  factory Checklist.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Checklist document ${doc.id} has no data.');
    }
    return Checklist.fromFirestore(data, documentId: doc.id);
  }

  factory Checklist.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return Checklist(
      id: (json['id'] as String?) ?? documentId ?? '',
      tripId: json['tripId'] as String,
      driverId: json['driverId'] as String,
      vehicleId: json['vehicleId'] as String,
      type: ChecklistType.fromFirestore(json['type'] as String),
      kmRegistered: json['kmRegistered'] as num,
      items: ChecklistItems.fromFirestore(readMap(json, 'items')),
      photoUrls: readStringList(json, 'photoUrls'),
      signatureUrl: json['signatureUrl'] as String,
      createdAt: readDateTime(json, 'createdAt'),
      category: json['category'] as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
      driverName: json['driverName'] as String?,
      location: json['location'] == null ? null : readMap(json, 'location'),
      answers: json['answers'] == null ? null : readMap(json, 'answers'),
      approvalStatus: json['approvalStatus'] as String?,
      hasCriticalFailure: json['hasCriticalFailure'] as bool?,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'tripId': tripId,
      'driverId': driverId,
      'vehicleId': vehicleId,
      'type': type.value,
      'kmRegistered': kmRegistered,
      'items': items.toFirestore(),
      'photoUrls': photoUrls,
      'signatureUrl': signatureUrl,
      'createdAt': writeTimestamp(createdAt),
      if (category != null) 'category': category,
      if (vehiclePlate != null) 'vehiclePlate': vehiclePlate,
      if (driverName != null) 'driverName': driverName,
      if (location != null) 'location': location,
      if (answers != null) 'answers': answers,
      if (approvalStatus != null) 'approvalStatus': approvalStatus,
      if (hasCriticalFailure != null) 'hasCriticalFailure': hasCriticalFailure,
    };
  }
}
