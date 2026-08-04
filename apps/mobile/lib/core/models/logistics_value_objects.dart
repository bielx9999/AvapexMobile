import 'package:cloud_firestore/cloud_firestore.dart';

import '../firebase/firestore_serializers.dart';

final class GeoLocation {
  const GeoLocation({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.headingDegrees,
    this.speedKph,
    this.recordedAt,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final double? headingDegrees;
  final double? speedKph;
  final DateTime? recordedAt;

  factory GeoLocation.fromMap(Object? value) {
    final map = _readObjectMap(value, 'location');
    return GeoLocation(
      latitude: _readDouble(map, 'latitude'),
      longitude: _readDouble(map, 'longitude'),
      accuracyMeters: _readNullableDouble(map, 'accuracyMeters'),
      headingDegrees: _readNullableDouble(map, 'headingDegrees'),
      speedKph: _readNullableDouble(map, 'speedKph'),
      recordedAt: _readNullableDate(map['recordedAt']),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'latitude': latitude,
    'longitude': longitude,
    if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
    if (headingDegrees != null) 'headingDegrees': headingDegrees,
    if (speedKph != null) 'speedKph': speedKph,
    if (recordedAt != null) 'recordedAt': writeTimestamp(recordedAt!),
  };
}

final class AddressSnapshot {
  const AddressSnapshot({
    required this.formattedAddress,
    required this.latitude,
    required this.longitude,
    this.placeId = '',
    this.city = '',
    this.state = '',
    this.postalCode = '',
  });

  final String formattedAddress;
  final double latitude;
  final double longitude;
  final String placeId;
  final String city;
  final String state;
  final String postalCode;

  factory AddressSnapshot.fromMap(Object? value) {
    final map = _readObjectMap(value, 'address');
    return AddressSnapshot(
      formattedAddress: _readString(map, 'formattedAddress'),
      latitude: _readDouble(map, 'latitude'),
      longitude: _readDouble(map, 'longitude'),
      placeId: _readString(map, 'placeId'),
      city: _readString(map, 'city'),
      state: _readString(map, 'state'),
      postalCode: _readString(map, 'postalCode'),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'formattedAddress': formattedAddress,
    'latitude': latitude,
    'longitude': longitude,
    'placeId': placeId,
    'city': city,
    'state': state,
    'postalCode': postalCode,
  };
}

final class DeliveryProofRequirements {
  const DeliveryProofRequirements({
    this.requirePhoto = true,
    this.requireReceiverName = true,
    this.requireReceiverDocument = true,
    this.requireSignature = false,
    this.requireLocation = true,
  });

  final bool requirePhoto;
  final bool requireReceiverName;
  final bool requireReceiverDocument;
  final bool requireSignature;
  final bool requireLocation;

  factory DeliveryProofRequirements.fromMap(Object? value) {
    final map = _readObjectMap(value, 'proofRequirements');
    return DeliveryProofRequirements(
      requirePhoto: _readBool(map, 'requirePhoto', true),
      requireReceiverName: _readBool(map, 'requireReceiverName', true),
      requireReceiverDocument: _readBool(map, 'requireReceiverDocument', true),
      requireSignature: _readBool(map, 'requireSignature', false),
      requireLocation: _readBool(map, 'requireLocation', true),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'requirePhoto': requirePhoto,
    'requireReceiverName': requireReceiverName,
    'requireReceiverDocument': requireReceiverDocument,
    'requireSignature': requireSignature,
    'requireLocation': requireLocation,
  };
}

Map<String, dynamic> readObjectMap(Object? value, String field) =>
    _readObjectMap(value, field);

DateTime? readNestedNullableDate(Object? value) => _readNullableDate(value);

double readMapDouble(Map<String, dynamic> map, String field) =>
    _readDouble(map, field);

String readMapString(Map<String, dynamic> map, String field) =>
    _readString(map, field);

bool readMapBool(
  Map<String, dynamic> map,
  String field, [
  bool fallback = false,
]) => _readBool(map, field, fallback);

Map<String, dynamic> _readObjectMap(Object? value, String field) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  throw FormatException('Invalid map field "$field": $value');
}

String _readString(Map<String, dynamic> map, String field) {
  final value = map[field];
  return value is String ? value : '';
}

double _readDouble(Map<String, dynamic> map, String field) {
  final value = map[field];
  if (value is num) {
    return value.toDouble();
  }
  return 0;
}

double? _readNullableDouble(Map<String, dynamic> map, String field) {
  final value = map[field];
  return value is num ? value.toDouble() : null;
}

bool _readBool(Map<String, dynamic> map, String field, bool fallback) {
  final value = map[field];
  return value is bool ? value : fallback;
}

DateTime? _readNullableDate(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is Timestamp) {
    return value.toDate();
  }
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.tryParse(value);
  }
  throw FormatException('Invalid nested timestamp: $value');
}
