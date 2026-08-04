import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/firebase/firestore_serializers.dart';
import '../../../../core/models/logistics_value_objects.dart';

sealed class OperationalSettings {
  const OperationalSettings({
    required this.id,
    required this.version,
    required this.updatedAt,
    required this.updatedBy,
  });

  final String id;
  final int version;
  final DateTime? updatedAt;
  final String updatedBy;

  Map<String, dynamic> toFirestore();

  static OperationalSettings fromFirestore(
    Map<String, dynamic> json, {
    String? documentId,
  }) {
    final kind = (json['kind'] as String?) ?? documentId ?? '';
    return switch (kind) {
      'delivery' => DeliverySettings.fromFirestore(json),
      'routes' => RouteSettings.fromFirestore(json),
      'permissions' => PermissionSettings.fromFirestore(json),
      'imports' => ImportSettings.fromFirestore(json),
      _ => throw FormatException('Invalid operational settings kind: $kind'),
    };
  }
}

final class DeliveryFailureReasonSetting {
  const DeliveryFailureReasonSetting({
    required this.code,
    required this.label,
    this.active = true,
    this.requireNotes = true,
    this.requirePhoto = false,
  });

  final String code;
  final String label;
  final bool active;
  final bool requireNotes;
  final bool requirePhoto;

  factory DeliveryFailureReasonSetting.fromMap(Object? value) {
    final map = readObjectMap(value, 'failureReason');
    return DeliveryFailureReasonSetting(
      code: readMapString(map, 'code'),
      label: readMapString(map, 'label'),
      active: readMapBool(map, 'active', true),
      requireNotes: readMapBool(map, 'requireNotes', true),
      requirePhoto: readMapBool(map, 'requirePhoto'),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'code': code,
    'label': label,
    'active': active,
    'requireNotes': requireNotes,
    'requirePhoto': requirePhoto,
  };
}

final class DeliverySettings extends OperationalSettings {
  const DeliverySettings({
    required super.version,
    required super.updatedAt,
    required super.updatedBy,
    required this.defaultProofRequirements,
    this.checkInRadiusMeters = 150,
    this.failureReasons = const [],
    this.statusTransitions = const {},
  }) : super(id: 'delivery');

  final int checkInRadiusMeters;
  final DeliveryProofRequirements defaultProofRequirements;
  final List<DeliveryFailureReasonSetting> failureReasons;
  final Map<String, List<String>> statusTransitions;

  factory DeliverySettings.fromFirestore(Map<String, dynamic> json) {
    return DeliverySettings(
      version: _readInt(json['version'], 1),
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
      checkInRadiusMeters: _readInt(json['checkInRadiusMeters'], 150),
      defaultProofRequirements: DeliveryProofRequirements.fromMap(
        json['defaultProofRequirements'],
      ),
      failureReasons: _readList(
        json['failureReasons'],
      ).map(DeliveryFailureReasonSetting.fromMap).toList(growable: false),
      statusTransitions: _readStringListMap(json['statusTransitions']),
    );
  }

  @override
  Map<String, dynamic> toFirestore() => {
    'id': id,
    'kind': 'delivery',
    'version': version,
    'checkInRadiusMeters': checkInRadiusMeters,
    'defaultProofRequirements': defaultProofRequirements.toFirestore(),
    'failureReasons': failureReasons
        .map((reason) => reason.toFirestore())
        .toList(growable: false),
    'statusTransitions': statusTransitions,
    'updatedAt': updatedAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(updatedAt!),
    'updatedBy': updatedBy,
  };
}

final class RouteSettings extends OperationalSettings {
  const RouteSettings({
    required super.version,
    required super.updatedAt,
    required super.updatedBy,
    this.gpsUpdateIntervalSeconds = 60,
    this.gpsOfflineAfterSeconds = 180,
    this.allowDriverReorderStops = false,
    this.allowRouteEditAfterStart = false,
    this.statusTransitions = const {},
  }) : super(id: 'routes');

  final int gpsUpdateIntervalSeconds;
  final int gpsOfflineAfterSeconds;
  final bool allowDriverReorderStops;
  final bool allowRouteEditAfterStart;
  final Map<String, List<String>> statusTransitions;

  factory RouteSettings.fromFirestore(Map<String, dynamic> json) {
    return RouteSettings(
      version: _readInt(json['version'], 1),
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
      gpsUpdateIntervalSeconds: _readInt(json['gpsUpdateIntervalSeconds'], 60),
      gpsOfflineAfterSeconds: _readInt(json['gpsOfflineAfterSeconds'], 180),
      allowDriverReorderStops:
          json['allowDriverReorderStops'] as bool? ?? false,
      allowRouteEditAfterStart:
          json['allowRouteEditAfterStart'] as bool? ?? false,
      statusTransitions: _readStringListMap(json['statusTransitions']),
    );
  }

  @override
  Map<String, dynamic> toFirestore() => {
    'id': id,
    'kind': 'routes',
    'version': version,
    'gpsUpdateIntervalSeconds': gpsUpdateIntervalSeconds,
    'gpsOfflineAfterSeconds': gpsOfflineAfterSeconds,
    'allowDriverReorderStops': allowDriverReorderStops,
    'allowRouteEditAfterStart': allowRouteEditAfterStart,
    'statusTransitions': statusTransitions,
    'updatedAt': updatedAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(updatedAt!),
    'updatedBy': updatedBy,
  };
}

final class PermissionSettings extends OperationalSettings {
  const PermissionSettings({
    required super.version,
    required super.updatedAt,
    required super.updatedBy,
    this.rolePermissions = const {},
  }) : super(id: 'permissions');

  final Map<String, List<String>> rolePermissions;

  factory PermissionSettings.fromFirestore(Map<String, dynamic> json) {
    return PermissionSettings(
      version: _readInt(json['version'], 1),
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
      rolePermissions: _readStringListMap(json['rolePermissions']),
    );
  }

  @override
  Map<String, dynamic> toFirestore() => {
    'id': id,
    'kind': 'permissions',
    'version': version,
    'rolePermissions': rolePermissions,
    'updatedAt': updatedAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(updatedAt!),
    'updatedBy': updatedBy,
  };
}

final class ImportSettings extends OperationalSettings {
  const ImportSettings({
    required super.version,
    required super.updatedAt,
    required super.updatedBy,
    this.maxRows = 1000,
    this.requiredColumns = const [],
    this.duplicateKey = 'orderNumber',
    this.allowPartialImport = false,
  }) : super(id: 'imports');

  final int maxRows;
  final List<String> requiredColumns;
  final String duplicateKey;
  final bool allowPartialImport;

  factory ImportSettings.fromFirestore(Map<String, dynamic> json) {
    return ImportSettings(
      version: _readInt(json['version'], 1),
      updatedAt: readNullableDateTime(json, 'updatedAt'),
      updatedBy: (json['updatedBy'] as String?) ?? '',
      maxRows: _readInt(json['maxRows'], 1000),
      requiredColumns: readStringList(json, 'requiredColumns'),
      duplicateKey: (json['duplicateKey'] as String?) ?? 'orderNumber',
      allowPartialImport: json['allowPartialImport'] as bool? ?? false,
    );
  }

  @override
  Map<String, dynamic> toFirestore() => {
    'id': id,
    'kind': 'imports',
    'version': version,
    'maxRows': maxRows,
    'requiredColumns': requiredColumns,
    'duplicateKey': duplicateKey,
    'allowPartialImport': allowPartialImport,
    'updatedAt': updatedAt == null
        ? FieldValue.serverTimestamp()
        : writeTimestamp(updatedAt!),
    'updatedBy': updatedBy,
  };
}

int _readInt(Object? value, int fallback) =>
    value is num ? value.toInt() : fallback;

List<Object?> _readList(Object? value) =>
    value is Iterable ? value.toList(growable: false) : const [];

Map<String, List<String>> _readStringListMap(Object? value) {
  final map = value is Map ? Map<String, dynamic>.from(value) : const {};
  return map.map(
    (key, item) => MapEntry(
      key,
      item is Iterable
          ? item.map((entry) => entry.toString()).toList(growable: false)
          : const <String>[],
    ),
  );
}
