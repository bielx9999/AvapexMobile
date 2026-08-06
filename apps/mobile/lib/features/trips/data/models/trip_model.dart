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

enum DriverTripResponse {
  pending('pending'),
  accepted('accepted'),
  rejected('rejected');

  const DriverTripResponse(this.value);

  final String value;

  static DriverTripResponse fromFirestore(Object? value) {
    return DriverTripResponse.values.firstWhere(
      (response) => response.value == value,
      orElse: () => DriverTripResponse.pending,
    );
  }
}

final class TripRejection {
  const TripRejection({
    required this.reasonCode,
    required this.reasonLabel,
    this.notes = '',
  });

  final String reasonCode;
  final String reasonLabel;
  final String notes;

  factory TripRejection.fromMap(Object? value) {
    if (value is! Map) {
      return const TripRejection(reasonCode: '', reasonLabel: '');
    }
    final map = Map<String, dynamic>.from(value);
    return TripRejection(
      reasonCode: (map['reasonCode'] as String?) ?? '',
      reasonLabel: (map['reasonLabel'] as String?) ?? '',
      notes: (map['notes'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
    'reasonCode': reasonCode,
    'reasonLabel': reasonLabel,
    'notes': notes,
  };
}

final class TripDocument {
  const TripDocument({
    required this.number,
    this.id = '',
    this.series = '',
    this.branch = '',
    this.issuedAt,
    this.sender = '',
    this.storagePath = '',
    this.fileName = '',
    this.contentType = '',
    this.sizeBytes = 0,
    this.uploadedAt,
    this.uploadedBy = '',
  });

  final String id;
  final String number;
  final String series;
  final String branch;
  final DateTime? issuedAt;
  final String sender;
  final String storagePath;
  final String fileName;
  final String contentType;
  final int sizeBytes;
  final DateTime? uploadedAt;
  final String uploadedBy;

  factory TripDocument.fromMap(Object? value) {
    if (value is! Map) {
      return TripDocument(number: value?.toString() ?? '');
    }
    final map = Map<String, dynamic>.from(value);
    return TripDocument(
      id: (map['id'] as String?) ?? '',
      number: (map['number'] as String?) ?? '',
      series: (map['series'] as String?) ?? '',
      branch: (map['branch'] as String?) ?? '',
      issuedAt: readNullableDateTime(map, 'issuedAt'),
      sender: (map['sender'] as String?) ?? '',
      storagePath: (map['storagePath'] as String?) ?? '',
      fileName: (map['fileName'] as String?) ?? '',
      contentType: (map['contentType'] as String?) ?? '',
      sizeBytes: (map['sizeBytes'] as num?)?.toInt() ?? 0,
      uploadedAt: readNullableDateTime(map, 'uploadedAt'),
      uploadedBy: (map['uploadedBy'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
    'id': id,
    'number': number,
    'series': series,
    'branch': branch,
    'issuedAt': writeNullableTimestamp(issuedAt),
    'sender': sender,
    'storagePath': storagePath,
    'fileName': fileName,
    'contentType': contentType,
    'sizeBytes': sizeBytes,
    'uploadedAt': writeNullableTimestamp(uploadedAt),
    'uploadedBy': uploadedBy,
  };
}

final class TripStop {
  const TripStop({
    required this.name,
    required this.address,
    this.latitude,
    this.longitude,
    this.locationId = '',
    this.order,
  });

  final String name;
  final String address;
  final double? latitude;
  final double? longitude;
  final String locationId;
  final int? order;

  factory TripStop.fromMap(Object? value) {
    if (value is! Map) {
      return TripStop(name: '', address: value?.toString() ?? '');
    }
    final map = Map<String, dynamic>.from(value);
    return TripStop(
      name: (map['name'] as String?) ?? '',
      address: (map['address'] as String?) ?? '',
      latitude: (map['latitude'] as num?)?.toDouble(),
      longitude: (map['longitude'] as num?)?.toDouble(),
      locationId: (map['locationId'] as String?) ?? '',
      order: (map['order'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'address': address,
    if (latitude != null) 'latitude': latitude,
    if (longitude != null) 'longitude': longitude,
    if (locationId.isNotEmpty) 'locationId': locationId,
    if (order != null) 'order': order,
  };
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
    this.driverResponse = DriverTripResponse.pending,
    this.driverRespondedAt,
    this.driverResponseDriverId = '',
    this.driverRejection,
    this.assignedAt,
    this.clientName = '',
    this.fleetNumber = '',
    this.cteDocuments = const [],
    this.routeStops = const [],
    this.routeId = '',
    this.routeName = '',
    this.originLocation = const {},
    this.destinationLocation = const {},
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
  final DriverTripResponse driverResponse;
  final DateTime? driverRespondedAt;
  final String driverResponseDriverId;
  final TripRejection? driverRejection;
  final DateTime? assignedAt;
  final String clientName;
  final String fleetNumber;
  final List<TripDocument> cteDocuments;
  final List<TripStop> routeStops;
  final String routeId;
  final String routeName;
  final Map<String, dynamic> originLocation;
  final Map<String, dynamic> destinationLocation;

  bool canDriverRespondAt(DateTime now) {
    return driverResponse == DriverTripResponse.pending &&
        status == TripStatus.pending &&
        scheduledAt.isAfter(now);
  }

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
      driverResponse: DriverTripResponse.fromFirestore(json['driverResponse']),
      driverRespondedAt: readNullableDateTime(json, 'driverRespondedAt'),
      driverResponseDriverId: (json['driverResponseDriverId'] as String?) ?? '',
      driverRejection: json['driverRejection'] == null
          ? null
          : TripRejection.fromMap(json['driverRejection']),
      assignedAt: readNullableDateTime(json, 'assignedAt'),
      clientName: (json['clientName'] as String?) ?? '',
      fleetNumber: (json['fleetNumber'] as String?) ?? '',
      cteDocuments: _readTripDocuments(json),
      routeStops: _readTripStops(json['routeStops']),
      routeId: (json['routeId'] as String?) ?? '',
      routeName: (json['routeName'] as String?) ?? '',
      originLocation: json['originLocation'] is Map
          ? Map<String, dynamic>.from(json['originLocation'] as Map)
          : const {},
      destinationLocation: json['destinationLocation'] is Map
          ? Map<String, dynamic>.from(json['destinationLocation'] as Map)
          : const {},
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
      'driverResponse': driverResponse.value,
      'driverRespondedAt': writeNullableTimestamp(driverRespondedAt),
      'driverResponseDriverId': driverResponseDriverId,
      'driverRejection': driverRejection?.toFirestore(),
      'assignedAt': writeNullableTimestamp(assignedAt),
      'clientName': clientName,
      'fleetNumber': fleetNumber,
      'cteDocuments': cteDocuments
          .map((document) => document.toFirestore())
          .toList(growable: false),
      'routeStops': routeStops
          .map((stop) => stop.toFirestore())
          .toList(growable: false),
      'routeId': routeId,
      'routeName': routeName,
      if (originLocation.isNotEmpty) 'originLocation': originLocation,
      if (destinationLocation.isNotEmpty)
        'destinationLocation': destinationLocation,
    };
  }
}

List<TripDocument> _readTripDocuments(Map<String, dynamic> json) {
  final documents = json['cteDocuments'];
  if (documents is Iterable) {
    return documents
        .map(TripDocument.fromMap)
        .where((document) => document.number.isNotEmpty)
        .toList(growable: false);
  }
  final legacyNumber = json['cteNumber'];
  if (legacyNumber is String && legacyNumber.trim().isNotEmpty) {
    return [TripDocument(number: legacyNumber.trim())];
  }
  return const [];
}

List<TripStop> _readTripStops(Object? value) {
  if (value is! Iterable) {
    return const [];
  }
  return value
      .map(TripStop.fromMap)
      .where((stop) => stop.address.isNotEmpty)
      .toList(growable: false);
}
