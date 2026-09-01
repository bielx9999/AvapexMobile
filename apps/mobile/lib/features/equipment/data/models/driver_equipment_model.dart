import 'package:cloud_firestore/cloud_firestore.dart';

enum DriverEquipmentType {
  strap('strap', 'Cinta'),
  ratchet('ratchet', 'Catraca'),
  chain('chain', 'Corrente'),
  tensioner('tensioner', 'Tensionador');

  const DriverEquipmentType(this.value, this.label);

  final String value;
  final String label;

  static DriverEquipmentType fromFirestore(String value) {
    return DriverEquipmentType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => throw FormatException('Invalid equipment type: $value'),
    );
  }
}

final class DriverEquipment {
  const DriverEquipment({
    required this.id,
    required this.driverId,
    required this.vehicleId,
    required this.vehiclePlate,
    required this.type,
    required this.tagNumber,
    required this.status,
    this.description,
  });

  final String id;
  final String driverId;
  final String vehicleId;
  final String vehiclePlate;
  final DriverEquipmentType type;
  final String tagNumber;
  final String status;
  final String? description;

  bool get isAvailable => status == 'assigned' || status == 'in_use';

  factory DriverEquipment.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Driver equipment document ${doc.id} has no data.');
    }

    return DriverEquipment(
      id: (data['id'] as String?) ?? doc.id,
      driverId: (data['currentDriverId'] as String?) ??
          (data['driverId'] as String?) ??
          '',
      vehicleId: (data['currentVehicleId'] as String?) ?? '',
      vehiclePlate: (data['currentVehiclePlate'] as String?) ?? '',
      type: DriverEquipmentType.fromFirestore(data['type'] as String),
      tagNumber: (data['code'] as String?) ??
          (data['tagNumber'] as String?) ??
          '',
      status: (data['status'] as String?) ?? 'assigned',
      description: data['description'] as String?,
    );
  }
}
