import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../../core/errors/firebase_failure.dart';

final class AuthRepository {
  AuthRepository({FirebaseAuth? auth, GoogleSignIn? googleSignIn})
    : _auth = auth ?? FirebaseAuth.instance,
      _googleSignIn = googleSignIn ?? GoogleSignIn.instance;

  final FirebaseAuth _auth;
  final GoogleSignIn _googleSignIn;
  Future<void>? _googleInitialization;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      return await _auth
          .signInWithEmailAndPassword(email: email, password: password)
          .timeout(const Duration(seconds: 15));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<UserCredential> signInWithGoogle() async {
    try {
      await _initializeGoogleSignIn();

      if (!_googleSignIn.supportsAuthenticate()) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Login com Google indisponivel neste dispositivo.',
        );
      }

      final googleUser = await _googleSignIn.authenticate().timeout(
        const Duration(seconds: 30),
      );
      final googleAuth = googleUser.authentication;

      if (googleAuth.idToken == null) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Nao foi possivel validar a conta Google.',
        );
      }

      final credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
      );

      return await _auth
          .signInWithCredential(credential)
          .timeout(const Duration(seconds: 20));
    } on FirebaseFailure {
      rethrow;
    } on GoogleSignInException catch (error, stackTrace) {
      throw FirebaseFailure(
        code: FirebaseFailureCode.unknown,
        message: _googleSignInMessage(error),
        originalError: error,
        stackTrace: stackTrace,
      );
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> _initializeGoogleSignIn() {
    return _googleInitialization ??= _googleSignIn.initialize();
  }

  String _googleSignInMessage(GoogleSignInException error) {
    return switch (error.code) {
      GoogleSignInExceptionCode.canceled => 'Login com Google cancelado.',
      GoogleSignInExceptionCode.clientConfigurationError =>
        'Configuracao do login com Google invalida. Verifique SHA e OAuth no Firebase.',
      GoogleSignInExceptionCode.providerConfigurationError =>
        'Google Play Services indisponivel ou mal configurado neste dispositivo.',
      GoogleSignInExceptionCode.uiUnavailable =>
        'Nao foi possivel abrir a tela de login do Google neste dispositivo.',
      _ => error.description ?? 'Nao foi possivel concluir o login com Google.',
    };
  }

  Future<void> signOut() async {
    try {
      await _initializeGoogleSignIn();
      await _googleSignIn.signOut().timeout(const Duration(seconds: 10));
      await _auth.signOut().timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }
}
