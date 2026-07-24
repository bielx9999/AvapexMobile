import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class FirebaseEnvironment {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return _web;
    }

    return switch (defaultTargetPlatform) {
      TargetPlatform.android => _android,
      TargetPlatform.iOS => _ios,
      _ => throw UnsupportedError(
        'Firebase mobile configurado apenas para Android e iOS.',
      ),
    };
  }

  static FirebaseOptions get _web {
    return FirebaseOptions(
      apiKey: _required('FIREBASE_WEB_API_KEY'),
      appId: _required('FIREBASE_WEB_APP_ID'),
      messagingSenderId: _required('FIREBASE_WEB_MESSAGING_SENDER_ID'),
      projectId: _required('FIREBASE_WEB_PROJECT_ID'),
      authDomain: _required('FIREBASE_WEB_AUTH_DOMAIN'),
      storageBucket: _required('FIREBASE_WEB_STORAGE_BUCKET'),
    );
  }

  static FirebaseOptions get _android {
    return FirebaseOptions(
      apiKey: _required('FIREBASE_ANDROID_API_KEY'),
      appId: _required('FIREBASE_ANDROID_APP_ID'),
      messagingSenderId: _required('FIREBASE_ANDROID_MESSAGING_SENDER_ID'),
      projectId: _required('FIREBASE_ANDROID_PROJECT_ID'),
      storageBucket: _required('FIREBASE_ANDROID_STORAGE_BUCKET'),
    );
  }

  static FirebaseOptions get _ios {
    return FirebaseOptions(
      apiKey: _required('FIREBASE_IOS_API_KEY'),
      appId: _required('FIREBASE_IOS_APP_ID'),
      messagingSenderId: _required('FIREBASE_IOS_MESSAGING_SENDER_ID'),
      projectId: _required('FIREBASE_IOS_PROJECT_ID'),
      storageBucket: _required('FIREBASE_IOS_STORAGE_BUCKET'),
      iosBundleId: _required('FIREBASE_IOS_BUNDLE_ID'),
    );
  }

  static String _required(String key) {
    final envValue = dotenv.env[key];
    final value = envValue == null || envValue.trim().isEmpty
        ? _compileTimeValue(key)
        : envValue;
    if (value.trim().isEmpty) {
      throw StateError('Variavel de ambiente obrigatoria ausente: $key');
    }
    return value;
  }

  static String _compileTimeValue(String key) {
    return switch (key) {
      'FIREBASE_ANDROID_API_KEY' => const String.fromEnvironment(
        'FIREBASE_ANDROID_API_KEY',
      ),
      'FIREBASE_ANDROID_APP_ID' => const String.fromEnvironment(
        'FIREBASE_ANDROID_APP_ID',
      ),
      'FIREBASE_ANDROID_MESSAGING_SENDER_ID' => const String.fromEnvironment(
        'FIREBASE_ANDROID_MESSAGING_SENDER_ID',
      ),
      'FIREBASE_ANDROID_PROJECT_ID' => const String.fromEnvironment(
        'FIREBASE_ANDROID_PROJECT_ID',
      ),
      'FIREBASE_ANDROID_STORAGE_BUCKET' => const String.fromEnvironment(
        'FIREBASE_ANDROID_STORAGE_BUCKET',
      ),
      'FIREBASE_IOS_API_KEY' => const String.fromEnvironment(
        'FIREBASE_IOS_API_KEY',
      ),
      'FIREBASE_IOS_APP_ID' => const String.fromEnvironment(
        'FIREBASE_IOS_APP_ID',
      ),
      'FIREBASE_IOS_MESSAGING_SENDER_ID' => const String.fromEnvironment(
        'FIREBASE_IOS_MESSAGING_SENDER_ID',
      ),
      'FIREBASE_IOS_PROJECT_ID' => const String.fromEnvironment(
        'FIREBASE_IOS_PROJECT_ID',
      ),
      'FIREBASE_IOS_STORAGE_BUCKET' => const String.fromEnvironment(
        'FIREBASE_IOS_STORAGE_BUCKET',
      ),
      'FIREBASE_IOS_BUNDLE_ID' => const String.fromEnvironment(
        'FIREBASE_IOS_BUNDLE_ID',
      ),
      'FIREBASE_WEB_API_KEY' => const String.fromEnvironment(
        'FIREBASE_WEB_API_KEY',
      ),
      'FIREBASE_WEB_APP_ID' => const String.fromEnvironment(
        'FIREBASE_WEB_APP_ID',
      ),
      'FIREBASE_WEB_MESSAGING_SENDER_ID' => const String.fromEnvironment(
        'FIREBASE_WEB_MESSAGING_SENDER_ID',
      ),
      'FIREBASE_WEB_PROJECT_ID' => const String.fromEnvironment(
        'FIREBASE_WEB_PROJECT_ID',
      ),
      'FIREBASE_WEB_AUTH_DOMAIN' => const String.fromEnvironment(
        'FIREBASE_WEB_AUTH_DOMAIN',
      ),
      'FIREBASE_WEB_STORAGE_BUCKET' => const String.fromEnvironment(
        'FIREBASE_WEB_STORAGE_BUCKET',
      ),
      _ => '',
    };
  }
}
