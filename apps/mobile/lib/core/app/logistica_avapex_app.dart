import 'package:flutter/material.dart';

import '../../features/auth/presentation/auth_gate.dart';
import '../errors/firebase_failure.dart';
import '../theme/app_theme.dart';

final class LogisticaAvapexApp extends StatelessWidget {
  const LogisticaAvapexApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Logistica Avapex',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const AuthGate(),
    );
  }
}

final class InitializationFailureApp extends StatelessWidget {
  const InitializationFailureApp({required this.failure, super.key});

  final FirebaseFailure failure;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Logistica Avapex',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(
                      Icons.cloud_off_outlined,
                      size: 48,
                      color: Color(0xFF111111),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Firebase nao inicializado',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      failure.message,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Configure o .env local ou use --dart-define com as variaveis FIREBASE_*.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
