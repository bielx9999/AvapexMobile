import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';
import '../../../../core/models/logistics_value_objects.dart';

enum RouteEventSource {
  admin('admin'),
  driver('driver'),
  system('system');

  const RouteEventSource(this.value);
  final String value;

  static RouteEventSource fromFirestore(Object? value) => RouteEventSource
      .values
      .firstWhere((source) => source.value == value, orElse: () => admin);
}

enum RouteEventType {
  routeCreated('route_created'),
  routeAssigned('route_assigned'),
  routeStarted('route_started'),
  routeCompleted('route_completed'),
  routeCancelled('route_cancelled'),
  deliveryCheckIn('delivery_check_in'),
  deliveryCompleted('delivery_completed'),
  deliveryFailed('delivery_failed'),
  deliveryCancelled('delivery_cancelled'),
  statusChanged('status_changed'),
  noteAdded('note_added');

  const RouteEventType(this.value);
  final String value;

  static RouteEventType fromFirestore(Object? value) => RouteEventType.values
      .firstWhere((type) => type.value == value, orElse: () => noteAdded);
}

final class RouteEvent {
  const RouteEvent({
    required this.id,
    required this.routeId,
    required this.type,
    required this.source,
    required this.actorId,
    required this.occurredAt,
    this.deliveryId = '',
    this.driverId = '',
    this.vehicleId = '',
    this.actorName = '',
    this.fromStatus = '',
    this.toStatus = '',
    this.message = '',
    this.metadata = const {},
    this.location,
    this.createdAt,
  });

  final String id;
  final String routeId;
  final String deliveryId;
  final String driverId;
  final String vehicleId;
  final RouteEventType type;
  final RouteEventSource source;
  final String actorId;
  final String actorName;
  final String fromStatus;
  final String toStatus;
  final String message;
  final Map<String, dynamic> metadata;
  final GeoLocation? location;
  final DateTime occurredAt;
  final DateTime? createdAt;

  factory RouteEvent.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    if (data == null) {
      throw StateError('Route event ${document.id} has no data.');
    }
    return RouteEvent.fromFirestore(data, documentId: document.id);
  }

  factory RouteEvent.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return RouteEvent(
      id: (json['id'] as String?) ?? documentId ?? '',
      routeId: (json['routeId'] as String?) ?? '',
      deliveryId: (json['deliveryId'] as String?) ?? '',
      driverId: (json['driverId'] as String?) ?? '',
      vehicleId: (json['vehicleId'] as String?) ?? '',
      type: RouteEventType.fromFirestore(json['type']),
      source: RouteEventSource.fromFirestore(json['source']),
      actorId: (json['actorId'] as String?) ?? '',
      actorName: (json['actorName'] as String?) ?? '',
      fromStatus: (json['fromStatus'] as String?) ?? '',
      toStatus: (json['toStatus'] as String?) ?? '',
      message: (json['message'] as String?) ?? '',
      metadata: json['metadata'] == null ? const {} : readMap(json, 'metadata'),
      location: json['location'] == null
          ? null
          : GeoLocation.fromMap(json['location']),
      occurredAt: readDateTime(json, 'occurredAt'),
      createdAt: readNullableDateTime(json, 'createdAt'),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'id': id,
    'routeId': routeId,
    'deliveryId': deliveryId,
    'driverId': driverId,
    'vehicleId': vehicleId,
    'type': type.value,
    'source': source.value,
    'actorId': actorId,
    'actorName': actorName,
    'fromStatus': fromStatus,
    'toStatus': toStatus,
    'message': message,
    'metadata': metadata,
    if (location != null) 'location': location!.toFirestore(),
    'occurredAt': writeTimestamp(occurredAt),
    'createdAt': createdAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(createdAt!),
  };
}
