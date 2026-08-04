import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';
import '../../../../core/models/logistics_value_objects.dart';

enum RouteStatus {
  draft('draft'),
  planned('planned'),
  assigned('assigned'),
  inProgress('in_progress'),
  completed('completed'),
  cancelled('cancelled');

  const RouteStatus(this.value);
  final String value;

  static RouteStatus fromFirestore(Object? value) => RouteStatus.values
      .firstWhere((status) => status.value == value, orElse: () => draft);
}

enum RouteOptimizationStatus {
  notRequested('not_requested'),
  processing('processing'),
  optimized('optimized'),
  failed('failed');

  const RouteOptimizationStatus(this.value);
  final String value;

  static RouteOptimizationStatus fromFirestore(Object? value) =>
      RouteOptimizationStatus.values.firstWhere(
        (status) => status.value == value,
        orElse: () => notRequested,
      );
}

final class RouteOptimization {
  const RouteOptimization({
    this.status = RouteOptimizationStatus.notRequested,
    this.provider = '',
    this.requestId = '',
    this.optimizedAt,
    this.errorMessage = '',
  });

  final RouteOptimizationStatus status;
  final String provider;
  final String requestId;
  final DateTime? optimizedAt;
  final String errorMessage;

  factory RouteOptimization.fromMap(Object? value) {
    if (value == null) {
      return const RouteOptimization();
    }
    final map = readObjectMap(value, 'optimization');
    return RouteOptimization(
      status: RouteOptimizationStatus.fromFirestore(map['status']),
      provider: readMapString(map, 'provider'),
      requestId: readMapString(map, 'requestId'),
      optimizedAt: readNestedNullableDate(map['optimizedAt']),
      errorMessage: readMapString(map, 'errorMessage'),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'status': status.value,
    'provider': provider,
    'requestId': requestId,
    'optimizedAt': writeNullableTimestamp(optimizedAt),
    'errorMessage': errorMessage,
  };
}

final class RoutePlan {
  const RoutePlan({
    required this.id,
    required this.code,
    required this.serviceDate,
    required this.status,
    required this.startAddress,
    required this.endAddress,
    this.driverId = '',
    this.driverName = '',
    this.vehicleId = '',
    this.vehiclePlate = '',
    this.fleetId = '',
    this.carrierId = '',
    this.carrierName = '',
    this.operationTypeId = '',
    this.operationTypeName = '',
    this.regionIds = const [],
    this.deliveryCount = 0,
    this.completedDeliveryCount = 0,
    this.plannedDistanceMeters = 0,
    this.plannedDurationSeconds = 0,
    this.plannedCost = 0,
    this.actualDistanceMeters = 0,
    this.actualDurationSeconds = 0,
    this.actualCost = 0,
    this.optimization = const RouteOptimization(),
    this.currentLocation,
    this.startedAt,
    this.completedAt,
    this.createdAt,
    this.createdBy = '',
    this.updatedAt,
    this.updatedBy = '',
  });

  final String id;
  final String code;
  final DateTime serviceDate;
  final RouteStatus status;
  final String driverId;
  final String driverName;
  final String vehicleId;
  final String vehiclePlate;
  final String fleetId;
  final String carrierId;
  final String carrierName;
  final String operationTypeId;
  final String operationTypeName;
  final List<String> regionIds;
  final AddressSnapshot startAddress;
  final AddressSnapshot endAddress;
  final int deliveryCount;
  final int completedDeliveryCount;
  final double plannedDistanceMeters;
  final double plannedDurationSeconds;
  final double plannedCost;
  final double actualDistanceMeters;
  final double actualDurationSeconds;
  final double actualCost;
  final RouteOptimization optimization;
  final GeoLocation? currentLocation;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final DateTime? createdAt;
  final String createdBy;
  final DateTime? updatedAt;
  final String updatedBy;

  factory RoutePlan.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    if (data == null) {
      throw StateError('Route ${document.id} has no data.');
    }
    return RoutePlan.fromFirestore(data, documentId: document.id);
  }

  factory RoutePlan.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return RoutePlan(
      id: (json['id'] as String?) ?? documentId ?? '',
      code: (json['code'] as String?) ?? '',
      serviceDate: readDateTime(json, 'serviceDate'),
      status: RouteStatus.fromFirestore(json['status']),
      driverId: (json['driverId'] as String?) ?? '',
      driverName: (json['driverName'] as String?) ?? '',
      vehicleId: (json['vehicleId'] as String?) ?? '',
      vehiclePlate: (json['vehiclePlate'] as String?) ?? '',
      fleetId: (json['fleetId'] as String?) ?? '',
      carrierId: (json['carrierId'] as String?) ?? '',
      carrierName: (json['carrierName'] as String?) ?? '',
      operationTypeId: (json['operationTypeId'] as String?) ?? '',
      operationTypeName: (json['operationTypeName'] as String?) ?? '',
      regionIds: readStringList(json, 'regionIds'),
      startAddress: AddressSnapshot.fromMap(json['startAddress']),
      endAddress: AddressSnapshot.fromMap(json['endAddress']),
      deliveryCount: _readInt(json['deliveryCount']),
      completedDeliveryCount: _readInt(json['completedDeliveryCount']),
      plannedDistanceMeters: _readDouble(json['plannedDistanceMeters']),
      plannedDurationSeconds: _readDouble(json['plannedDurationSeconds']),
      plannedCost: _readDouble(json['plannedCost']),
      actualDistanceMeters: _readDouble(json['actualDistanceMeters']),
      actualDurationSeconds: _readDouble(json['actualDurationSeconds']),
      actualCost: _readDouble(json['actualCost']),
      optimization: RouteOptimization.fromMap(json['optimization']),
      currentLocation: json['currentLocation'] == null
          ? null
          : GeoLocation.fromMap(json['currentLocation']),
      startedAt: readNullableDateTime(json, 'startedAt'),
      completedAt: readNullableDateTime(json, 'completedAt'),
      createdAt: readNullableDateTime(json, 'createdAt'),
      createdBy: (json['createdBy'] as String?) ?? '',
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
    'id': id,
    'code': code,
    'serviceDate': writeTimestamp(serviceDate),
    'status': status.value,
    'driverId': driverId,
    'driverName': driverName,
    'vehicleId': vehicleId,
    'vehiclePlate': vehiclePlate,
    'fleetId': fleetId,
    'carrierId': carrierId,
    'carrierName': carrierName,
    'operationTypeId': operationTypeId,
    'operationTypeName': operationTypeName,
    'regionIds': regionIds,
    'startAddress': startAddress.toFirestore(),
    'endAddress': endAddress.toFirestore(),
    'deliveryCount': deliveryCount,
    'completedDeliveryCount': completedDeliveryCount,
    'plannedDistanceMeters': plannedDistanceMeters,
    'plannedDurationSeconds': plannedDurationSeconds,
    'plannedCost': plannedCost,
    'actualDistanceMeters': actualDistanceMeters,
    'actualDurationSeconds': actualDurationSeconds,
    'actualCost': actualCost,
    'optimization': optimization.toFirestore(),
    if (currentLocation != null)
      'currentLocation': currentLocation!.toFirestore(),
    'startedAt': writeNullableTimestamp(startedAt),
    'completedAt': writeNullableTimestamp(completedAt),
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
