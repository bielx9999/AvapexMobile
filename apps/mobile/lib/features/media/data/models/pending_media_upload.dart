import 'driver_media_type.dart';

final class PendingMediaUpload {
  const PendingMediaUpload({
    required this.id,
    required this.localPath,
    required this.mediaType,
    required this.ownerEntityId,
    required this.createdAt,
    this.lastAttemptAt,
    this.uploadedUrl,
    this.attempts = 0,
  });

  final String id;
  final String localPath;
  final DriverMediaType mediaType;
  final String ownerEntityId;
  final DateTime createdAt;
  final DateTime? lastAttemptAt;
  final String? uploadedUrl;
  final int attempts;

  factory PendingMediaUpload.create({
    required String localPath,
    required DriverMediaType mediaType,
    required String ownerEntityId,
  }) {
    return PendingMediaUpload(
      id: '${DateTime.now().microsecondsSinceEpoch}-$ownerEntityId',
      localPath: localPath,
      mediaType: mediaType,
      ownerEntityId: ownerEntityId,
      createdAt: DateTime.now(),
    );
  }

  factory PendingMediaUpload.fromJson(Map<String, dynamic> json) {
    return PendingMediaUpload(
      id: json['id'] as String,
      localPath: json['localPath'] as String,
      mediaType: DriverMediaType.values.firstWhere(
        (type) => type.name == json['mediaType'],
        orElse: () => throw FormatException(
          'Invalid pending media type: ${json['mediaType']}',
        ),
      ),
      ownerEntityId: json['ownerEntityId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastAttemptAt: json['lastAttemptAt'] == null
          ? null
          : DateTime.parse(json['lastAttemptAt'] as String),
      uploadedUrl: json['uploadedUrl'] as String?,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    );
  }

  PendingMediaUpload markAttempted() {
    return PendingMediaUpload(
      id: id,
      localPath: localPath,
      mediaType: mediaType,
      ownerEntityId: ownerEntityId,
      createdAt: createdAt,
      lastAttemptAt: DateTime.now(),
      uploadedUrl: uploadedUrl,
      attempts: attempts + 1,
    );
  }

  PendingMediaUpload markUploaded(String url) {
    return PendingMediaUpload(
      id: id,
      localPath: localPath,
      mediaType: mediaType,
      ownerEntityId: ownerEntityId,
      createdAt: createdAt,
      lastAttemptAt: lastAttemptAt,
      uploadedUrl: url,
      attempts: attempts,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'localPath': localPath,
      'mediaType': mediaType.name,
      'ownerEntityId': ownerEntityId,
      'createdAt': createdAt.toIso8601String(),
      'lastAttemptAt': lastAttemptAt?.toIso8601String(),
      'uploadedUrl': uploadedUrl,
      'attempts': attempts,
    };
  }
}
