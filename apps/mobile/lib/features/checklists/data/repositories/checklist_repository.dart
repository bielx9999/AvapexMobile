import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/checklist_model.dart';

final class ChecklistRepository {
  ChecklistRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Checklist> get _checklists {
    return _firestore
        .collection(FirestoreCollections.checklists)
        .withConverter<Checklist>(
          fromFirestore: (snapshot, _) => Checklist.fromDocument(snapshot),
          toFirestore: (checklist, _) => checklist.toFirestore(),
        );
  }

  Future<void> saveForCurrentDriver(Checklist checklist) async {
    try {
      final uid = _requireCurrentUserId();
      if (checklist.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Checklist nao pertence ao motorista atual.',
        );
      }

      await _checklists
          .doc(checklist.id)
          .set(checklist, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Stream<List<Checklist>> watchByTripForCurrentDriver(String tripId) {
    final uid = _requireCurrentUserId();

    return _checklists
        .where('driverId', isEqualTo: uid)
        .where('tripId', isEqualTo: tripId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((document) => document.data())
              .toList(growable: false),
        )
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
  }

  Stream<List<Checklist>> watchHistoryForCurrentDriver() {
    final uid = _requireCurrentUserId();

    return _checklists
        .where('driverId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
          final checklists = snapshot.docs
              .map((document) => document.data())
              .toList(growable: false);
          checklists.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return checklists;
        })
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
  }

  String _requireCurrentUserId() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw const FirebaseFailure(
        code: FirebaseFailureCode.unauthenticated,
        message: 'Motorista nao autenticado.',
      );
    }
    return uid;
  }
}
