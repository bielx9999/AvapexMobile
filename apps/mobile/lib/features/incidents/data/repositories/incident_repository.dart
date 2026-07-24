import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/incident_model.dart';

final class IncidentRepository {
  IncidentRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Incident> get _incidents {
    return _firestore
        .collection(FirestoreCollections.incidents)
        .withConverter<Incident>(
          fromFirestore: (snapshot, _) => Incident.fromDocument(snapshot),
          toFirestore: (incident, _) => incident.toFirestore(),
        );
  }

  Future<void> reportForCurrentDriver(Incident incident) async {
    try {
      final uid = _requireCurrentUserId();
      if (incident.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Ocorrencia nao pertence ao motorista atual.',
        );
      }

      await _incidents
          .doc(incident.id)
          .set(incident, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Stream<List<Incident>> watchCurrentDriverIncidents() {
    final uid = _requireCurrentUserId();

    return _incidents
        .where('driverId', isEqualTo: uid)
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
