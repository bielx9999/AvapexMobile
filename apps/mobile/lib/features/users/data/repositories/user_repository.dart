import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/app_user_model.dart';

final class UserRepository {
  UserRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<AppUser> get _users {
    return _firestore
        .collection(FirestoreCollections.users)
        .withConverter<AppUser>(
          fromFirestore: (snapshot, _) => AppUser.fromDocument(snapshot),
          toFirestore: (user, _) => user.toFirestore(),
        );
  }

  Stream<AppUser?> watchCurrentUserProfile() {
    final uid = _requireCurrentUserId();

    return _users
        .doc(uid)
        .snapshots()
        .map((snapshot) {
          return snapshot.data();
        })
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
  }

  Future<AppUser?> getCurrentUserProfile() async {
    try {
      final uid = _requireCurrentUserId();
      final snapshot = await _users
          .doc(uid)
          .get()
          .timeout(const Duration(seconds: 10));
      return snapshot.data();
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  String _requireCurrentUserId() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw const FirebaseFailure(
        code: FirebaseFailureCode.unauthenticated,
        message: 'Usuario nao autenticado.',
      );
    }
    return uid;
  }
}
