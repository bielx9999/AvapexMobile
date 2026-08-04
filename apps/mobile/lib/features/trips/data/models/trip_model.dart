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
      orElse: () => TripStatus.pending,
    );
  }
}

enum TripOperationType {
  loading('loading'),
  unloading('unloading');

  const TripOperationType(this.value);

  final String value;

  static TripOperationType fromFirestore(Object? value) {
    return value == unloading.value ? unloading : loading;
  }
}

enum TripProgrammingStatus {
  loading('loading'),
  inTransit('in_transit'),
  unloading('unloading'),
  awaitingInvoice('awaiting_invoice'),
  released('released');

  const TripProgrammingStatus(this.value);

  final String value;

  static TripProgrammingStatus fromFirestore(Object? value) {
    return TripProgrammingStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => TripProgrammingStatus.loading,
    );
  }
}

enum TripProgress {
  transitToLoading(
    'transit_to_loading',
    'Em transito para carga',
    TripProgrammingStatus.inTransit,
    TripOperationType.loading,
    TripStatus.inProgress,
  ),
  waitingLoading(
    'waiting_loading',
    'Aguardando carregar',
    TripProgrammingStatus.loading,
    TripOperationType.loading,
    TripStatus.pending,
  ),
  loading(
    'loading',
    'Carregando',
    TripProgrammingStatus.loading,
    TripOperationType.loading,
    TripStatus.inProgress,
  ),
  releasedLoading(
    'released_loading',
    'Liberado da carga',
    TripProgrammingStatus.released,
    TripOperationType.loading,
    TripStatus.completed,
  ),
  transitToUnloading(
    'transit_to_unloading',
    'Em transito para descarga',
    TripProgrammingStatus.inTransit,
    TripOperationType.unloading,
    TripStatus.inProgress,
  ),
  waitingUnloading(
    'waiting_unloading',
    'Aguardando descarga',
    TripProgrammingStatus.unloading,
    TripOperationType.unloading,
    TripStatus.inProgress,
  ),
  unloading(
    'unloading',
    'Descarregando',
    TripProgrammingStatus.unloading,
    TripOperationType.unloading,
    TripStatus.inProgress,
  ),
  awaitingInvoice(
    'awaiting_invoice',
    'Aguardando NF',
    TripProgrammingStatus.awaitingInvoice,
    TripOperationType.unloading,
    TripStatus.inProgress,
  ),
  releasedUnloading(
    'released_unloading',
    'Liberado da descarga',
    TripProgrammingStatus.released,
    TripOperationType.unloading,
    TripStatus.completed,
  );

  const TripProgress(
    this.value,
    this.label,
    this.programmingStatus,
    this.operationType,
    this.tripStatus,
  );

  final String value;
  final String label;
  final TripProgrammingStatus programmingStatus;
  final TripOperationType operationType;
  final TripStatus tripStatus;

  String? get operationalStatusValue =>
      this == TripProgress.awaitingInvoice ? null : value;

  bool get isFinished =>
      this == TripProgress.releasedLoading ||
      this == TripProgress.releasedUnloading;

  static List<TripProgress> optionsFor(TripOperationType operationType) {
    return TripProgress.values
        .where((progress) => progress.operationType == operationType)
        .toList(growable: false);
  }

  static TripProgress fromFirestore(Map<String, dynamic> json) {
    final programmingStatus = TripProgrammingStatus.fromFirestore(
      json['programmingStatus'],
    );
    final operationType = TripOperationType.fromFirestore(
      json['operationType'],
    );
    final operationalStatus = json['operationalStatus'];

    if (programmingStatus == TripProgrammingStatus.awaitingInvoice) {
      return TripProgress.awaitingInvoice;
    }
    if (operationalStatus is String) {
      for (final progress in TripProgress.values) {
        if (progress.value == operationalStatus) {
          return progress;
        }
      }
    }
    if (programmingStatus == TripProgrammingStatus.released) {
      return operationType == TripOperationType.loading
          ? TripProgress.releasedLoading
          : TripProgress.releasedUnloading;
    }
    if (programmingStatus == TripProgrammingStatus.inTransit) {
      return operationType == TripOperationType.loading
          ? TripProgress.transitToLoading
          : TripProgress.transitToUnloading;
    }
    if (programmingStatus == TripProgrammingStatus.unloading) {
      return TripProgress.waitingUnloading;
    }
    return TripProgress.waitingLoading;
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
    required this.operationType,
    required this.programmingStatus,
    required this.progress,
    this.startedAt,
    this.completedAt,
    this.customerRequestNumber = '',
    this.driverName = '',
    this.vehiclePlate = '',
    this.vehicleModel = '',
    this.expectedArrivalAt,
    this.gpsLocation = const {},
    this.lastGpsUpdateAt,
    this.statusUpdatedAt,
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
  final TripOperationType operationType;
  final TripProgrammingStatus programmingStatus;
  final TripProgress progress;
  final String customerRequestNumber;
  final String driverName;
  final String vehiclePlate;
  final String vehicleModel;
  final DateTime? expectedArrivalAt;
  final Map<String, dynamic> gpsLocation;
  final DateTime? lastGpsUpdateAt;
  final DateTime? statusUpdatedAt;

  factory Trip.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Trip document ${doc.id} has no data.');
    }
    return Trip.fromFirestore(data, documentId: doc.id);
  }

  factory Trip.fromFirestore(Map<String, dynamic> json, {String? documentId}) {
    final operationType = TripOperationType.fromFirestore(
      json['operationType'],
    );
    final programmingStatus = TripProgrammingStatus.fromFirestore(
      json['programmingStatus'],
    );

    return Trip(
      id: (json['id'] as String?) ?? documentId ?? '',
      driverId: json['driverId'] as String,
      vehicleId: json['vehicleId'] as String,
      origin: json['origin'] as String,
      destination: json['destination'] as String,
      status: TripStatus.fromFirestore(
        (json['status'] as String?) ?? TripStatus.pending.value,
      ),
      scheduledAt: readDateTime(json, 'scheduledAt'),
      startedAt: readNullableDateTime(json, 'startedAt'),
      completedAt: readNullableDateTime(json, 'completedAt'),
      deliveryDocs: readStringList(json, 'deliveryDocs'),
      operationType: operationType,
      programmingStatus: programmingStatus,
      progress: TripProgress.fromFirestore(json),
      customerRequestNumber: (json['customerRequestNumber'] as String?) ?? '',
      driverName: (json['driverName'] as String?) ?? '',
      vehiclePlate: (json['vehiclePlate'] as String?) ?? '',
      vehicleModel: (json['vehicleModel'] as String?) ?? '',
      expectedArrivalAt: readNullableDateTime(json, 'expectedArrivalAt'),
      gpsLocation: json['gpsLocation'] == null
          ? const {}
          : readMap(json, 'gpsLocation'),
      lastGpsUpdateAt: readNullableDateTime(json, 'lastGpsUpdateAt'),
      statusUpdatedAt: readNullableDateTime(json, 'statusUpdatedAt'),
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
      'operationType': operationType.value,
      'programmingStatus': programmingStatus.value,
      'operationalStatus': progress.operationalStatusValue,
      'customerRequestNumber': customerRequestNumber,
      'driverName': driverName,
      'vehiclePlate': vehiclePlate,
      'vehicleModel': vehicleModel,
      'expectedArrivalAt': writeNullableTimestamp(expectedArrivalAt),
      if (gpsLocation.isNotEmpty) 'gpsLocation': gpsLocation,
      if (lastGpsUpdateAt != null)
        'lastGpsUpdateAt': writeTimestamp(lastGpsUpdateAt!),
      if (statusUpdatedAt != null)
        'statusUpdatedAt': writeTimestamp(statusUpdatedAt!),
    };
  }
}
