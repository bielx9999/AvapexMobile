import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';
import '../../../../core/models/logistics_value_objects.dart';

enum DeliveryStatus {
  pending('pending'),
  inRoute('in_route'),
  arrived('arrived'),
  delivered('delivered'),
  notDelivered('not_delivered'),
  cancelled('cancelled');

  const DeliveryStatus(this.value);
  final String value;

  static DeliveryStatus fromFirestore(Object? value) => DeliveryStatus.values
      .firstWhere((status) => status.value == value, orElse: () => pending);
}

enum DeliveryProofStatus {
  pending('pending'),
  submitted('submitted'),
  approved('approved'),
  rejected('rejected');

  const DeliveryProofStatus(this.value);
  final String value;

  static DeliveryProofStatus fromFirestore(Object? value) => DeliveryProofStatus
      .values
      .firstWhere((status) => status.value == value, orElse: () => pending);
}

final class DeliveryFailure {
  const DeliveryFailure({
    required this.reasonCode,
    required this.reasonLabel,
    this.notes = '',
    this.registeredAt,
  });

  final String reasonCode;
  final String reasonLabel;
  final String notes;
  final DateTime? registeredAt;

  factory DeliveryFailure.fromMap(Object? value) {
    final map = readObjectMap(value, 'failure');
    return DeliveryFailure(
      reasonCode: readMapString(map, 'reasonCode'),
      reasonLabel: readMapString(map, 'reasonLabel'),
      notes: readMapString(map, 'notes'),
      registeredAt: readNestedNullableDate(map['registeredAt']),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'reasonCode': reasonCode,
    'reasonLabel': reasonLabel,
    'notes': notes,
    'registeredAt': registeredAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(registeredAt!),
  };
}

final class Delivery {
  const Delivery({
    required this.id,
    required this.orderNumber,
    required this.address,
    required this.scheduledAt,
    this.routeId = '',
    this.cteAccessKey = '',
    this.cteNumber = '',
    this.clientId = '',
    this.clientName = '',
    this.carrierId = '',
    this.carrierName = '',
    this.regionId = '',
    this.regionName = '',
    this.driverId = '',
    this.driverName = '',
    this.vehicleId = '',
    this.vehiclePlate = '',
    this.sequence = 0,
    this.status = DeliveryStatus.pending,
    this.timeWindowStart,
    this.timeWindowEnd,
    this.estimatedArrivalAt,
    this.arrivedAt,
    this.deliveredAt,
    this.packageCount = 0,
    this.weightKg = 0,
    this.volumeM3 = 0,
    this.notes = '',
    this.proofRequirements = const DeliveryProofRequirements(),
    this.proofStatus = DeliveryProofStatus.pending,
    this.deliveryProofId = '',
    this.checkInLocation,
    this.failure,
    this.createdAt,
    this.createdBy = '',
    this.updatedAt,
    this.updatedBy = '',
  });

  final String id;
  final String routeId;
  final String orderNumber;
  final String cteAccessKey;
  final String cteNumber;
  final String clientId;
  final String clientName;
  final String carrierId;
  final String carrierName;
  final String regionId;
  final String regionName;
  final String driverId;
  final String driverName;
  final String vehicleId;
  final String vehiclePlate;
  final int sequence;
  final DeliveryStatus status;
  final AddressSnapshot address;
  final DateTime scheduledAt;
  final DateTime? timeWindowStart;
  final DateTime? timeWindowEnd;
  final DateTime? estimatedArrivalAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final int packageCount;
  final double weightKg;
  final double volumeM3;
  final String notes;
  final DeliveryProofRequirements proofRequirements;
  final DeliveryProofStatus proofStatus;
  final String deliveryProofId;
  final GeoLocation? checkInLocation;
  final DeliveryFailure? failure;
  final DateTime? createdAt;
  final String createdBy;
  final DateTime? updatedAt;
  final String updatedBy;

  factory Delivery.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    if (data == null) {
      throw StateError('Delivery ${document.id} has no data.');
    }
    return Delivery.fromFirestore(data, documentId: document.id);
  }

  factory Delivery.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return Delivery(
      id: (json['id'] as String?) ?? documentId ?? '',
      routeId: (json['routeId'] as String?) ?? '',
      orderNumber: (json['orderNumber'] as String?) ?? '',
      cteAccessKey: (json['cteAccessKey'] as String?) ?? '',
      cteNumber: (json['cteNumber'] as String?) ?? '',
      clientId: (json['clientId'] as String?) ?? '',
      clientName: (json['clientName'] as String?) ?? '',
      carrierId: (json['carrierId'] as String?) ?? '',
      carrierName: (json['carrierName'] as String?) ?? '',
      regionId: (json['regionId'] as String?) ?? '',
      regionName: (json['regionName'] as String?) ?? '',
      driverId: (json['driverId'] as String?) ?? '',
      driverName: (json['driverName'] as String?) ?? '',
      vehicleId: (json['vehicleId'] as String?) ?? '',
      vehiclePlate: (json['vehiclePlate'] as String?) ?? '',
      sequence: _readInt(json['sequence']),
      status: DeliveryStatus.fromFirestore(json['status']),
      address: AddressSnapshot.fromMap(json['address']),
      scheduledAt: readDateTime(json, 'scheduledAt'),
      timeWindowStart: readNullableDateTime(json, 'timeWindowStart'),
      timeWindowEnd: readNullableDateTime(json, 'timeWindowEnd'),
      estimatedArrivalAt: readNullableDateTime(json, 'estimatedArrivalAt'),
      arrivedAt: readNullableDateTime(json, 'arrivedAt'),
      deliveredAt: readNullableDateTime(json, 'deliveredAt'),
      packageCount: _readInt(json['packageCount']),
      weightKg: _readDouble(json['weightKg']),
      volumeM3: _readDouble(json['volumeM3']),
      notes: (json['notes'] as String?) ?? '',
      proofRequirements: DeliveryProofRequirements.fromMap(
        json['proofRequirements'],
      ),
      proofStatus: DeliveryProofStatus.fromFirestore(json['proofStatus']),
      deliveryProofId: (json['deliveryProofId'] as String?) ?? '',
      checkInLocation: json['checkInLocation'] == null
          ? null
          : GeoLocation.fromMap(json['checkInLocation']),
      failure: json['failure'] == null
          ? null
          : DeliveryFailure.fromMap(json['failure']),
      createdAt: readNullableDateTime(json, 'createdAt'),
      createdBy: (json['createdBy'] as String?) ?? '',
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
    'id': id,
    'routeId': routeId,
    'orderNumber': orderNumber,
    'cteAccessKey': cteAccessKey,
    'cteNumber': cteNumber,
    'clientId': clientId,
    'clientName': clientName,
    'carrierId': carrierId,
    'carrierName': carrierName,
    'regionId': regionId,
    'regionName': regionName,
    'driverId': driverId,
    'driverName': driverName,
    'vehicleId': vehicleId,
    'vehiclePlate': vehiclePlate,
    'sequence': sequence,
    'status': status.value,
    'address': address.toFirestore(),
    'scheduledAt': writeTimestamp(scheduledAt),
    'timeWindowStart': writeNullableTimestamp(timeWindowStart),
    'timeWindowEnd': writeNullableTimestamp(timeWindowEnd),
    'estimatedArrivalAt': writeNullableTimestamp(estimatedArrivalAt),
    'arrivedAt': writeNullableTimestamp(arrivedAt),
    'deliveredAt': writeNullableTimestamp(deliveredAt),
    'packageCount': packageCount,
    'weightKg': weightKg,
    'volumeM3': volumeM3,
    'notes': notes,
    'proofRequirements': proofRequirements.toFirestore(),
    'proofStatus': proofStatus.value,
    'deliveryProofId': deliveryProofId,
    if (checkInLocation != null)
      'checkInLocation': checkInLocation!.toFirestore(),
    if (failure != null) 'failure': failure!.toFirestore(),
    'createdAt': createdAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(createdAt!),
    'createdBy': createdBy,
    'updatedAt': updatedAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(updatedAt!),
    'updatedBy': updatedBy,
  };
}

int _readInt(Object? value) => value is num ? value.toInt() : 0;
double _readDouble(Object? value) => value is num ? value.toDouble() : 0;
