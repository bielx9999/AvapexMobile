import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app/logistica_avapex_app.dart';
import 'core/config/firebase_initializer.dart';
import 'core/errors/firebase_failure.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: FirebaseBootstrapApp()));
}

final class FirebaseBootstrapApp extends StatefulWidget {
  const FirebaseBootstrapApp({super.key});

  @override
  State<FirebaseBootstrapApp> createState() => _FirebaseBootstrapAppState();
}

final class _FirebaseBootstrapAppState extends State<FirebaseBootstrapApp> {
  late final Future<void> _initialization = _initializeFirebase();

  Future<void> _initializeFirebase() async {
    try {
      await FirebaseInitializer.initialize();
    } on FirebaseFailure catch (failure) {
      FlutterError.reportError(
        FlutterErrorDetails(
          exception: failure,
          stack: failure.stackTrace,
          library: 'firebase_bootstrap',
        ),
      );
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _initialization,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          final error = snapshot.error;
          return InitializationFailureApp(
            failure: error is FirebaseFailure
                ? error
                : FirebaseFailure.fromException(
                    error ?? StateError('Falha desconhecida.'),
                    snapshot.stackTrace ?? StackTrace.current,
                  ),
          );
        }

        if (snapshot.connectionState == ConnectionState.done) {
          return const LogisticaAvapexApp();
        }

        return const MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(body: Center(child: CircularProgressIndicator())),
        );
      },
    );
  }
}
