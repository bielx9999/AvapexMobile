import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../models/driver_media_type.dart';
import '../models/pending_media_upload.dart';
import 'pending_media_queue.dart';

final class MediaUploadService {
  MediaUploadService({
    FirebaseStorage? storage,
    FirebaseAuth? auth,
    PendingMediaQueue? pendingQueue,
  }) : _storage = storage ?? FirebaseStorage.instance,
       _auth = auth ?? FirebaseAuth.instance,
       _pendingQueue = pendingQueue ?? PendingMediaQueue();

  final FirebaseStorage _storage;
  final FirebaseAuth _auth;
  final PendingMediaQueue _pendingQueue;

  Future<String?> uploadOrQueueDriverImage({
    required File localFile,
    required DriverMediaType mediaType,
    required String ownerEntityId,
  }) async {
    final pending = await queueDriverImage(
      localFile: localFile,
      mediaType: mediaType,
      ownerEntityId: ownerEntityId,
    );

    try {
      final url = await uploadDriverImage(
        localFile: localFile,
        mediaType: mediaType,
        ownerEntityId: ownerEntityId,
      );
      await _pendingQueue.remove(pending.id);
      return url;
    } on FirebaseFailure catch (failure) {
      if (failure.code == FirebaseFailureCode.permissionDenied ||
          failure.code == FirebaseFailureCode.unauthenticated) {
        await _pendingQueue.remove(pending.id);
        rethrow;
      }
      return null;
    }
  }

  Future<PendingMediaUpload> queueDriverImage({
    required File localFile,
    required DriverMediaType mediaType,
    required String ownerEntityId,
  }) async {
    final pending = PendingMediaUpload.create(
      localPath: localFile.path,
      mediaType: mediaType,
      ownerEntityId: ownerEntityId,
    );
    await _pendingQueue.add(pending);
    return pending;
  }

  Future<List<String>> flushPendingUploads() async {
    final uploadedUrls = <String>[];
    final pendingUploads = await _pendingQueue.all();

    for (final pending in pendingUploads) {
      final attempted = pending.markAttempted();
      await _pendingQueue.replace(attempted);

      try {
        final file = File(pending.localPath);
        if (!file.existsSync()) {
          await _pendingQueue.remove(pending.id);
          continue;
        }

        final url = await uploadDriverImage(
          localFile: file,
          mediaType: pending.mediaType,
          ownerEntityId: pending.ownerEntityId,
        );
        uploadedUrls.add(url);
        await _pendingQueue.remove(pending.id);
      } on FirebaseFailure catch (failure) {
        if (failure.code == FirebaseFailureCode.permissionDenied ||
            failure.code == FirebaseFailureCode.unauthenticated) {
          rethrow;
        }
      }
    }

    return uploadedUrls;
  }

  Future<String> uploadDriverImage({
    required File localFile,
    required DriverMediaType mediaType,
    required String ownerEntityId,
    int quality = 78,
    int maxWidth = 1920,
    int maxHeight = 1920,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      final bytes = await _compressImage(
        localFile,
        quality: quality,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
      );

      final fileName = '${DateTime.now().microsecondsSinceEpoch}.jpg';
      final path =
          'drivers/$uid/${mediaType.pathSegment}/$ownerEntityId/$fileName';
      final metadata = SettableMetadata(
        contentType: 'image/jpeg',
        customMetadata: {
          'driverId': uid,
          'ownerEntityId': ownerEntityId,
          'sourcePath': localFile.path,
        },
      );

      final task = _storage.ref(path).putData(bytes, metadata);
      final snapshot = await task.timeout(const Duration(seconds: 45));
      return await snapshot.ref.getDownloadURL().timeout(
        const Duration(seconds: 15),
      );
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<Uint8List> _compressImage(
    File file, {
    required int quality,
    required int maxWidth,
    required int maxHeight,
  }) async {
    final result = await FlutterImageCompress.compressWithFile(
      file.absolute.path,
      minWidth: maxWidth,
      minHeight: maxHeight,
      quality: quality,
      format: CompressFormat.jpeg,
      autoCorrectionAngle: true,
      keepExif: false,
    );

    if (result == null || result.isEmpty) {
      throw const FirebaseFailure(
        code: FirebaseFailureCode.unknown,
        message: 'Falha ao comprimir imagem antes do upload.',
      );
    }

    return result;
  }

  String _requireCurrentUserId() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw const FirebaseFailure(
        code: FirebaseFailureCode.unauthenticated,
        message: 'Motorista nao autenticado.',
      );
    }
    return uid;
  }
}
