import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../../firebase_options.dart';
import '../errors/firebase_failure.dart';

abstract final class FirebaseInitializer {
  static Future<FirebaseApp> initialize({
    String envFileName = '.env',
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      await dotenv.load(fileName: envFileName, isOptional: true);

      final app = await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      ).timeout(timeout);

      FirebaseFirestore.instance.settings = const Settings(
        persistenceEnabled: true,
        cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
      );

      return app;
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }
}
