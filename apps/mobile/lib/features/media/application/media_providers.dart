import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/services/media_upload_service.dart';
import '../data/services/pending_media_queue.dart';

final pendingMediaQueueProvider = Provider<PendingMediaQueue>((ref) {
  return PendingMediaQueue();
});

final mediaUploadServiceProvider = Provider<MediaUploadService>((ref) {
  return MediaUploadService(
    storage: ref.watch(firebaseStorageProvider),
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
    pendingQueue: ref.watch(pendingMediaQueueProvider),
  );
});
