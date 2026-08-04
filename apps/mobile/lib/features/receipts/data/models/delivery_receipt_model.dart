import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum DeliveryReceiptReviewStatus {
  pending('pending'),
  delivered('delivered'),
  failed('failed');

  const DeliveryReceiptReviewStatus(this.value);
  final String value;

  static DeliveryReceiptReviewStatus fromFirestore(Object? value) {
    return DeliveryReceiptReviewStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => pending,
    );
  }
}

final class DeliveryReceipt {
  const DeliveryReceipt({
    required this.id,
    required this.driverId,
    required this.driverName,
    required this.cteAccessKey,
    required this.cteNumber,
    required this.receiverName,
    required this.receiverDocument,
    required this.location,
    required this.signaturePoints,
    required this.physicalProofPhotoUrls,
    required this.pendingPhysicalProofLocalPaths,
    required this.declaration,
    required this.createdAt,
    this.deliveryId = '',
    this.routeId = '',
    this.orderNumber = '',
    this.clientId = '',
    this.clientName = '',
    this.vehicleId = '',
    this.vehiclePlate = '',
    this.adminStatus = DeliveryReceiptReviewStatus.pending,
    this.failureReason = '',
    this.driverNotificationMessage = '',
    this.driverNotificationStatus = 'not_sent',
    this.reviewedAt,
    this.reviewedBy = '',
  });

  final String id;
  final String driverId;
  final String driverName;
  final String cteAccessKey;
  final String cteNumber;
  final String receiverName;
  final String receiverDocument;
  final Map<String, dynamic> location;
  final List<Map<String, double?>> signaturePoints;
  final List<String> physicalProofPhotoUrls;
  final List<String> pendingPhysicalProofLocalPaths;
  final String declaration;
  final DateTime createdAt;
  final String deliveryId;
  final String routeId;
  final String orderNumber;
  final String clientId;
  final String clientName;
  final String vehicleId;
  final String vehiclePlate;
  final DeliveryReceiptReviewStatus adminStatus;
  final String failureReason;
  final String driverNotificationMessage;
  final String driverNotificationStatus;
  final DateTime? reviewedAt;
  final String reviewedBy;

  factory DeliveryReceipt.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Delivery receipt document ${doc.id} has no data.');
    }
    return DeliveryReceipt.fromFirestore(data, documentId: doc.id);
  }

  factory DeliveryReceipt.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return DeliveryReceipt(
      id: (json['id'] as String?) ?? documentId ?? '',
      driverId: json['driverId'] as String,
      driverName: json['driverName'] as String,
      cteAccessKey: json['cteAccessKey'] as String,
      cteNumber: json['cteNumber'] as String,
      receiverName: json['receiverName'] as String,
      receiverDocument: json['receiverDocument'] as String,
      location: readMap(json, 'location'),
      signaturePoints: _readSignaturePoints(json['signaturePoints']),
      physicalProofPhotoUrls: readStringList(json, 'physicalProofPhotoUrls'),
      pendingPhysicalProofLocalPaths: readStringList(
        json,
        'pendingPhysicalProofLocalPaths',
      ),
      declaration: json['declaration'] as String,
      createdAt: readDateTime(json, 'createdAt'),
      deliveryId: (json['deliveryId'] as String?) ?? '',
      routeId: (json['routeId'] as String?) ?? '',
      orderNumber: (json['orderNumber'] as String?) ?? '',
      clientId: (json['clientId'] as String?) ?? '',
      clientName: (json['clientName'] as String?) ?? '',
      vehicleId: (json['vehicleId'] as String?) ?? '',
      vehiclePlate: (json['vehiclePlate'] as String?) ?? '',
      adminStatus: DeliveryReceiptReviewStatus.fromFirestore(
        json['adminStatus'],
      ),
      failureReason: (json['failureReason'] as String?) ?? '',
      driverNotificationMessage:
          (json['driverNotificationMessage'] as String?) ?? '',
      driverNotificationStatus:
          (json['driverNotificationStatus'] as String?) ?? 'not_sent',
      reviewedAt: readNullableDateTime(json, 'reviewedAt'),
      reviewedBy: (json['reviewedBy'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'driverId': driverId,
      'driverName': driverName,
      'cteAccessKey': cteAccessKey,
      'cteNumber': cteNumber,
      'receiverName': receiverName,
      'receiverDocument': receiverDocument,
      'location': location,
      'signaturePoints': signaturePoints,
      'physicalProofPhotoUrls': physicalProofPhotoUrls,
      'pendingPhysicalProofLocalPaths': pendingPhysicalProofLocalPaths,
      'declaration': declaration,
      'createdAt': writeTimestamp(createdAt),
      'deliveryId': deliveryId,
      'routeId': routeId,
      'orderNumber': orderNumber,
      'clientId': clientId,
      'clientName': clientName,
      'vehicleId': vehicleId,
      'vehiclePlate': vehiclePlate,
      'adminStatus': adminStatus.value,
      'failureReason': failureReason,
      'driverNotificationMessage': driverNotificationMessage,
      'driverNotificationStatus': driverNotificationStatus,
      'reviewedAt': writeNullableTimestamp(reviewedAt),
      'reviewedBy': reviewedBy,
    };
  }

  static List<Map<String, double?>> _readSignaturePoints(Object? value) {
    if (value == null) {
      return const [];
    }
    if (value is! Iterable) {
      throw FormatException('Invalid signature points field: $value');
    }

    return value
        .map((point) {
          if (point is! Map) {
            throw FormatException('Invalid signature point: $point');
          }
          final x = point['x'];
          final y = point['y'];
          return {
            'x': x == null ? null : (x as num).toDouble(),
            'y': y == null ? null : (y as num).toDouble(),
          };
        })
        .toList(growable: false);
  }
}
