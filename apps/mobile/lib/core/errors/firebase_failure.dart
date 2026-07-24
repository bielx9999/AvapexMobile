import 'dart:async';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';

enum FirebaseFailureCode {
  networkUnavailable,
  timeout,
  permissionDenied,
  unauthenticated,
  initializationFailed,
  unknown,
}

final class FirebaseFailure implements Exception {
  const FirebaseFailure({
    required this.code,
    required this.message,
    this.originalError,
    this.stackTrace,
  });

  final FirebaseFailureCode code;
  final String message;
  final Object? originalError;
  final StackTrace? stackTrace;

  static FirebaseFailure fromException(Object error, StackTrace stackTrace) {
    if (error is FirebaseFailure) {
      return error;
    }

    if (error is TimeoutException) {
      return FirebaseFailure(
        code: FirebaseFailureCode.timeout,
        message: 'Tempo limite excedido ao comunicar com o Firebase.',
        originalError: error,
        stackTrace: stackTrace,
      );
    }

    if (error is SocketException) {
      return FirebaseFailure(
        code: FirebaseFailureCode.networkUnavailable,
        message: 'Sem conexao de rede disponivel.',
        originalError: error,
        stackTrace: stackTrace,
      );
    }

    if (error is FirebaseAuthException) {
      return FirebaseFailure(
        code: _authCode(error.code),
        message: error.message ?? 'Erro de autenticacao no Firebase.',
        originalError: error,
        stackTrace: stackTrace,
      );
    }

    if (error is FirebaseException) {
      return FirebaseFailure(
        code: _firebaseCode(error.code),
        message: error.message ?? 'Erro ao comunicar com o Firebase.',
        originalError: error,
        stackTrace: stackTrace,
      );
    }

    return FirebaseFailure(
      code: FirebaseFailureCode.unknown,
      message: 'Erro inesperado ao executar operacao Firebase.',
      originalError: error,
      stackTrace: stackTrace,
    );
  }

  static FirebaseFailureCode _authCode(String code) {
    return switch (code) {
      'user-disabled' ||
      'user-not-found' ||
      'wrong-password' => FirebaseFailureCode.unauthenticated,
      'network-request-failed' => FirebaseFailureCode.networkUnavailable,
      _ => FirebaseFailureCode.unknown,
    };
  }

  static FirebaseFailureCode _firebaseCode(String code) {
    return switch (code) {
      'permission-denied' => FirebaseFailureCode.permissionDenied,
      'unauthenticated' => FirebaseFailureCode.unauthenticated,
      'unavailable' || 'deadline-exceeded' => FirebaseFailureCode.timeout,
      'network-request-failed' => FirebaseFailureCode.networkUnavailable,
      _ => FirebaseFailureCode.unknown,
    };
  }

  @override
  String toString() => 'FirebaseFailure($code): $message';
}
