import 'package:firebase_storage/firebase_storage.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/trip_model.dart';

final class TripDocumentService {
  const TripDocumentService._();

  static Future<bool> openCtePdf(
    TripDocument document, {
    FirebaseStorage? storage,
  }) async {
    if (document.storagePath.isEmpty) {
      return false;
    }
    final downloadUrl = await (storage ?? FirebaseStorage.instance)
        .ref(document.storagePath)
        .getDownloadURL()
        .timeout(const Duration(seconds: 20));
    return launchUrl(
      Uri.parse(downloadUrl),
      mode: LaunchMode.externalApplication,
    );
  }
}
