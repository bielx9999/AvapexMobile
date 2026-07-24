import 'package:firebase_core/firebase_core.dart';

import 'core/config/firebase_environment.dart';

abstract final class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return FirebaseEnvironment.currentPlatform;
  }
}
