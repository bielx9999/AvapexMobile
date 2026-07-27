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
    required this.type,
    required this.tagNumber,
    required this.status,
    this.description,
  });

  final String id;
  final String driverId;
  final DriverEquipmentType type;
  final String tagNumber;
  final String status;
  final String? description;

  bool get isAvailable => status == 'available' || status == 'active';

  factory DriverEquipment.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    if (data == null) {
      throw StateError('Driver equipment document ${doc.id} has no data.');
    }

    return DriverEquipment(
      id: (data['id'] as String?) ?? doc.id,
      driverId: data['driverId'] as String,
      type: DriverEquipmentType.fromFirestore(data['type'] as String),
      tagNumber: data['tagNumber'] as String,
      status: (data['status'] as String?) ?? 'available',
      description: data['description'] as String?,
    );
  }
}
