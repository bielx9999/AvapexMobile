import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';

enum FuelType {
  diesel('diesel', 'Diesel'),
  arla('arla', 'Arla');

  const FuelType(this.value, this.label);

  final String value;
  final String label;

  static FuelType fromFirestore(String value) {
    return FuelType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => throw FormatException('Invalid fuel type: $value'),
    );
  }
}

enum FuelingNotificationStatus {
  pendingWhatsapp('pending_whatsapp'),
  sentWhatsapp('sent_whatsapp'),
  failedWhatsapp('failed_whatsapp');

  const FuelingNotificationStatus(this.value);

  final String value;

  static FuelingNotificationStatus fromFirestore(String value) {
    return FuelingNotificationStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () =>
          throw FormatException('Invalid fueling notification status: $value'),
    );
  }
}

final class FuelingRecord {
  const FuelingRecord({
    required this.id,
    required this.driverId,
    required this.driverName,
    required this.vehicleId,
    required this.vehiclePlate,
    required this.vehicleModel,
    required this.kmRegistered,
    required this.fuelType,
    required this.receiptPhotoUrls,
    required this.odometerPhotoUrls,
    required this.pendingReceiptPhotoLocalPaths,
    required this.pendingOdometerPhotoLocalPaths,
    required this.notificationStatus,
    required this.createdAt,
  });

  final String id;
  final String driverId;
  final String driverName;
  final String vehicleId;
  final String vehiclePlate;
  final String vehicleModel;
  final num kmRegistered;
  final FuelType fuelType;
  final List<String> receiptPhotoUrls;
  final List<String> odometerPhotoUrls;
  final List<String> pendingReceiptPhotoLocalPaths;
  final List<String> pendingOdometerPhotoLocalPaths;
  final FuelingNotificationStatus notificationStatus;
  final DateTime createdAt;

  factory FuelingRecord.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Fueling record document ${doc.id} has no data.');
    }
    return FuelingRecord.fromFirestore(data, documentId: doc.id);
  }

  factory FuelingRecord.fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    return FuelingRecord(
      id: (json['id'] as String?) ?? documentId ?? '',
      driverId: json['driverId'] as String,
      driverName: json['driverName'] as String,
      vehicleId: json['vehicleId'] as String,
      vehiclePlate: json['vehiclePlate'] as String,
      vehicleModel: json['vehicleModel'] as String,
      kmRegistered: json['kmRegistered'] as num,
      fuelType: FuelType.fromFirestore(json['fuelType'] as String),
      receiptPhotoUrls: readStringList(json, 'receiptPhotoUrls'),
      odometerPhotoUrls: readStringList(json, 'odometerPhotoUrls'),
      pendingReceiptPhotoLocalPaths: readStringList(
        json,
        'pendingReceiptPhotoLocalPaths',
      ),
      pendingOdometerPhotoLocalPaths: readStringList(
        json,
        'pendingOdometerPhotoLocalPaths',
      ),
      notificationStatus: FuelingNotificationStatus.fromFirestore(
        json['notificationStatus'] as String,
      ),
      createdAt: readDateTime(json, 'createdAt'),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'driverId': driverId,
      'driverName': driverName,
      'vehicleId': vehicleId,
      'vehiclePlate': vehiclePlate,
      'vehicleModel': vehicleModel,
      'kmRegistered': kmRegistered,
      'fuelType': fuelType.value,
      'receiptPhotoUrls': receiptPhotoUrls,
      'odometerPhotoUrls': odometerPhotoUrls,
      'pendingReceiptPhotoLocalPaths': pendingReceiptPhotoLocalPaths,
      'pendingOdometerPhotoLocalPaths': pendingOdometerPhotoLocalPaths,
      'notificationStatus': notificationStatus.value,
      'createdAt': writeTimestamp(createdAt),
    };
  }
}
