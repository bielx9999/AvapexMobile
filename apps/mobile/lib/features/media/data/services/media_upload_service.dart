import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/driver_media_type.dart';
import '../models/pending_media_upload.dart';
import 'pending_media_queue.dart';

final class MediaUploadService {
  MediaUploadService({
    FirebaseStorage? storage,
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
    PendingMediaQueue? pendingQueue,
  }) : _storage = storage ?? FirebaseStorage.instance,
       _firestore = firestore ?? FirebaseFirestore.instance,
       _auth = auth ?? FirebaseAuth.instance,
       _pendingQueue = pendingQueue ?? PendingMediaQueue();

  final FirebaseStorage _storage;
  final FirebaseFirestore _firestore;
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
        var url = pending.uploadedUrl;
        if (url == null || url.isEmpty) {
          final file = File(pending.localPath);
          if (!file.existsSync()) {
            await _pendingQueue.remove(pending.id);
            continue;
          }

          url = await uploadDriverImage(
            localFile: file,
            mediaType: pending.mediaType,
            ownerEntityId: pending.ownerEntityId,
          );
          await _pendingQueue.replace(attempted.markUploaded(url));
        }

        await _attachUploadedUrl(pending, url);
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

  Future<void> _attachUploadedUrl(
    PendingMediaUpload pending,
    String url,
  ) async {
    final update = switch (pending.mediaType) {
      DriverMediaType.deliveryDocument => (
        collection: FirestoreCollections.deliveryReceipts,
        data: <String, Object>{
          'physicalProofPhotoUrls': FieldValue.arrayUnion([url]),
          'pendingPhysicalProofLocalPaths': FieldValue.arrayRemove([
            pending.localPath,
          ]),
        },
      ),
      DriverMediaType.fuelingReceipt => (
        collection: FirestoreCollections.fuelingRecords,
        data: <String, Object>{
          'receiptPhotoUrls': FieldValue.arrayUnion([url]),
          'pendingReceiptPhotoLocalPaths': FieldValue.arrayRemove([
            pending.localPath,
          ]),
        },
      ),
      DriverMediaType.fuelingOdometer => (
        collection: FirestoreCollections.fuelingRecords,
        data: <String, Object>{
          'odometerPhotoUrls': FieldValue.arrayUnion([url]),
          'pendingOdometerPhotoLocalPaths': FieldValue.arrayRemove([
            pending.localPath,
          ]),
        },
      ),
      DriverMediaType.incident => (
        collection: FirestoreCollections.incidents,
        data: <String, Object>{
          'photoUrl': url,
          'pendingPhotoLocalPath': FieldValue.delete(),
        },
      ),
      DriverMediaType.checklist => (
        collection: FirestoreCollections.checklists,
        data: <String, Object>{
          'photoUrls': FieldValue.arrayUnion([url]),
        },
      ),
      DriverMediaType.signature => (
        collection: FirestoreCollections.checklists,
        data: <String, Object>{'signatureUrl': url},
      ),
      DriverMediaType.profile => (
        collection: FirestoreCollections.users,
        data: <String, Object>{'photoUrl': url},
      ),
    };

    await _firestore
        .collection(update.collection)
        .doc(pending.ownerEntityId)
        .update(update.data)
        .timeout(const Duration(seconds: 15));
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
