import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

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
    required this.declaration,
    required this.createdAt,
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
  final String declaration;
  final DateTime createdAt;

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
      declaration: json['declaration'] as String,
      createdAt: readDateTime(json, 'createdAt'),
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
      'declaration': declaration,
      'createdAt': writeTimestamp(createdAt),
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
