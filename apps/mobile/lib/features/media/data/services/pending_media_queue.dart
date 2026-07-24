import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../models/pending_media_upload.dart';

final class PendingMediaQueue {
  static const _storageKey = 'pending_driver_media_uploads';

  Future<List<PendingMediaUpload>> all() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final values = prefs.getStringList(_storageKey) ?? const [];
      return values
          .map((value) => jsonDecode(value) as Map<String, dynamic>)
          .map(PendingMediaUpload.fromJson)
          .toList(growable: false);
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> add(PendingMediaUpload upload) async {
    final uploads = await all();
    await _save([...uploads, upload]);
  }

  Future<void> remove(String id) async {
    final uploads = await all();
    await _save(
      uploads.where((upload) => upload.id != id).toList(growable: false),
    );
  }

  Future<void> replace(PendingMediaUpload upload) async {
    final uploads = await all();
    await _save(
      uploads
          .map((item) => item.id == upload.id ? upload : item)
          .toList(growable: false),
    );
  }

  Future<void> _save(List<PendingMediaUpload> uploads) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(
        _storageKey,
        uploads.map((upload) => jsonEncode(upload.toJson())).toList(),
      );
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }
}
