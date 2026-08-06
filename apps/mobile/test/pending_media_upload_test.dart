import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/features/media/data/models/driver_media_type.dart';
import 'package:logistica_avapex_mobile/features/media/data/models/pending_media_upload.dart';

void main() {
  test('reads queues created before uploadedUrl was introduced', () {
    final upload = PendingMediaUpload.fromJson({
      'id': 'pending-1',
      'localPath': '/tmp/photo.jpg',
      'mediaType': DriverMediaType.incident.name,
      'ownerEntityId': 'incident-1',
      'createdAt': '2026-08-06T10:00:00.000',
      'lastAttemptAt': null,
      'attempts': 0,
    });

    expect(upload.uploadedUrl, isNull);
    expect(upload.mediaType, DriverMediaType.incident);
  });

  test('preserves an uploaded URL while Firestore attachment is pending', () {
    final pending = PendingMediaUpload.create(
      localPath: '/tmp/photo.jpg',
      mediaType: DriverMediaType.fuelingReceipt,
      ownerEntityId: 'fueling-1',
    ).markAttempted().markUploaded('https://storage.example/photo.jpg');

    final restored = PendingMediaUpload.fromJson(pending.toJson());

    expect(restored.uploadedUrl, 'https://storage.example/photo.jpg');
    expect(restored.attempts, 1);
  });
}
